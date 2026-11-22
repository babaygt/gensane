/**
 * Pages in a folder of `pages/` form a section, such as documentation: `pages/docs/` is the section
 * `docs`, its subfolders are its parts, and a folder's `index.md` is the folder's own page. The tree
 * is what a sidebar shows, and its reading order gives each page the one before and after it.
 */
import type { EntryOf } from "../content/entries.ts";
import { compareOrder, compareStrings, compareText } from "./order.ts";

type Page = EntryOf<"page">;

export interface SectionFolder {
  readonly kind: "folder";
  /** The folder's name, such as `guides`. */
  readonly name: string;
  /** From the folder's `index.md`, or else its name with a capital letter. */
  readonly title: string;
  /** The folder's own page, its `index.md`, when it has one. */
  readonly page: Page | undefined;
  readonly items: readonly SectionItem[];
}

export type SectionItem = SectionFolder | { readonly kind: "page"; readonly page: Page };

/** The folders a page is in, inside `pages/`: `pages/docs/cli/init.md` → `docs`, `cli`. */
export function foldersOf(page: Page): readonly string[] {
  return page.file.split("/").slice(1, -1);
}

function isIndex(page: Page): boolean {
  return page.file.endsWith("/index.md");
}

function orderOf(item: SectionItem): number | undefined {
  return item.page?.fields.order;
}

function titleOf(item: SectionItem): string {
  return item.kind === "folder" ? item.title : item.page.fields.title;
}

/** By `order`, then by title, then by file, so the order never changes between builds. */
function byPlace(first: SectionItem, second: SectionItem): number {
  return (
    compareOrder(orderOf(first), orderOf(second)) ||
    compareText(titleOf(first), titleOf(second)) ||
    compareStrings(first.page?.file ?? first.kind, second.page?.file ?? second.kind)
  );
}

function folderOf(name: string, pages: readonly Page[], depth: number): SectionFolder {
  const own = pages.find((page) => isIndex(page) && foldersOf(page).length === depth);
  const items: SectionItem[] = [];
  const subfolders = new Map<string, Page[]>();
  for (const page of pages) {
    if (page === own) continue;
    const folders = foldersOf(page);
    if (folders.length === depth) {
      items.push({ kind: "page", page });
    } else {
      const sub = folders[depth] ?? "";
      subfolders.set(sub, [...(subfolders.get(sub) ?? []), page]);
    }
  }
  for (const [sub, inside] of subfolders) items.push(folderOf(sub, inside, depth + 1));
  return {
    kind: "folder",
    name,
    title: own?.fields.title ?? name.charAt(0).toUpperCase() + name.slice(1),
    page: own,
    items: items.toSorted(byPlace),
  };
}

/** Every section of the site, by the name of its folder. */
export function sectionsOf(pages: readonly Page[]): ReadonlyMap<string, SectionFolder> {
  const byFolder = new Map<string, Page[]>();
  for (const page of pages) {
    const [top] = foldersOf(page);
    if (top !== undefined) byFolder.set(top, [...(byFolder.get(top) ?? []), page]);
  }
  return new Map([...byFolder].map(([name, inside]) => [name, folderOf(name, inside, 1)]));
}

/** The pages of a section as a reader goes through them: each folder's own page, then what is in it. */
export function readingOrder(folder: SectionFolder): readonly Page[] {
  return [
    ...(folder.page === undefined ? [] : [folder.page]),
    ...folder.items.flatMap((item) => (item.kind === "page" ? [item.page] : readingOrder(item))),
  ];
}

/** The folders from the section down to the page, without the page itself. */
export function foldersAbove(section: SectionFolder, page: Page): readonly SectionFolder[] {
  const path: SectionFolder[] = [section];
  for (const name of foldersOf(page).slice(1)) {
    const next = path
      .at(-1)
      ?.items.find((item): item is SectionFolder => item.kind === "folder" && item.name === name);
    if (next === undefined) break;
    path.push(next);
  }
  return isIndex(page) ? path.slice(0, -1) : path;
}
