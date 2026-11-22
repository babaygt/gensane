// Turns the repository's `docs/` into gensane.dev's documentation pages, by the structure in
// `website/docs-structure.ts`. The pages in `docs/` stay as they are, so they keep being tested and read
// on GitHub; here each one gets a title and an order, links between pages become their addresses on
// the site, other files of `docs/`, such as pictures, are copied into the site, links to the code lead
// to it on GitHub, and each page knows where it is edited.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { DOCS, type DocsNode } from "../website/docs-structure.ts";

export const REPOSITORY = "https://github.com/babaygt/gensane";

interface Placed {
  readonly node: DocsNode;
  /** The address on the site, such as `/docs/reference/commands/init/`. */
  readonly url: string;
  /** The page's file inside the website's content, such as `pages/docs/reference/commands/init.md`. */
  readonly file: string;
  readonly order: number;
}

/** Every page and folder of the structure, with its address, its file and its place, in reading order. */
export function placesOf(root: DocsNode = DOCS): readonly Placed[] {
  const placed: Placed[] = [];
  const visit = (node: DocsNode, folders: readonly string[]) => {
    const path = [...folders, node.slug];
    const isFolder = node.children !== undefined;
    placed.push({
      node,
      url: `/${path.join("/")}/`,
      file: `pages/${isFolder ? `${path.join("/")}/index` : path.join("/")}.md`,
      order: placed.length + 1,
    });
    for (const child of node.children ?? []) visit(child, path);
  };
  visit(root, []);
  return placed;
}

/** The address of each page of `docs/`, by its file. */
function addressesOf(placed: readonly Placed[]): ReadonlyMap<string, string> {
  return new Map(
    placed.flatMap(({ node, url }) => (node.from === undefined ? [] : [[node.from, url]])),
  );
}

/** A link of a page in `docs/`, as it leads on gensane.dev. */
export function rewriteLink(
  target: string,
  from: string,
  addresses: ReadonlyMap<string, string>,
): string {
  if (/^[a-z]+:|^#|^\//i.test(target)) return target;
  const [path = "", part] = target.split("#");
  const inRepository = posix.normalize(posix.join("docs", posix.dirname(from), path));
  const hash = part === undefined ? "" : `#${part}`;
  if (inRepository.startsWith("docs/") && inRepository.endsWith(".md")) {
    const address = addresses.get(inRepository.slice("docs/".length));
    if (address === undefined)
      throw new Error(`${from} links to ${target}, which isn't in the documentation's structure`);
    return `${address}${hash}`;
  }
  // Pictures and other files of the documentation are copied into the site, at the same path.
  if (inRepository.startsWith("docs/")) return `/${inRepository}${hash}`;
  const kind = /\.[a-z0-9]+$/i.test(inRepository) ? "blob" : "tree";
  return `${REPOSITORY}/${kind}/main/${inRepository}${hash}`;
}

/**
 * Changes the text of a line but not its inline code, which starts with a run of backticks and ends
 * with a run of the same length, as Markdown has it: `` ` `` is code that shows one backtick.
 */
export function outsideCode(line: string, change: (text: string) => string): string {
  let result = "";
  let text = "";
  let index = 0;
  while (index < line.length) {
    const run = /^`+/.exec(line.slice(index))?.[0];
    if (run === undefined) {
      text += line[index];
      index += 1;
      continue;
    }
    const close = new RegExp(`(?<!\`)${run}(?!\`)`, "g");
    close.lastIndex = index + run.length;
    const end = close.exec(line);
    if (end === null) {
      text += run;
      index += run.length;
      continue;
    }
    result += change(text) + line.slice(index, end.index + run.length);
    text = "";
    index = end.index + run.length;
  }
  return result + change(text);
}

/** The page without its first heading, which becomes its title, and with its links rewritten; code is left alone. */
function contentOf(markdown: string, from: string, addresses: ReadonlyMap<string, string>) {
  const lines = markdown.split("\n");
  const heading = lines[0]?.startsWith("# ") ? lines.shift()?.slice(2).trim() : undefined;
  let fence: string | undefined;
  const body = lines.map((line) => {
    const opening = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === undefined && opening !== undefined) {
      fence = opening;
      return line;
    }
    if (fence !== undefined) {
      if (line.startsWith(fence)) fence = undefined;
      return line;
    }
    // Inline code is left as it is; links outside it are rewritten.
    return outsideCode(line, (text) =>
      text.replaceAll(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_, link: string, title: string) => {
        return `](${rewriteLink(link, from, addresses)}${title})`;
      }),
    );
  });
  return { heading, body: body.join("\n").replace(/^\n+/, "") };
}

function frontmatterOf(fields: Readonly<Record<string, string | number>>): string {
  const lines = Object.entries(fields).map(([name, value]) => `${name}: ${JSON.stringify(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

/**
 * Writes the documentation into the website's content folder, and its other files into the website's
 * public folder, replacing what an earlier import wrote.
 */
export async function importDocs(repository: string, content: string): Promise<number> {
  const placed = placesOf();
  const addresses = addressesOf(placed);
  await rm(join(content, "pages", "docs"), { recursive: true, force: true });
  const files = join(content, "..", "public", "docs");
  await rm(files, { recursive: true, force: true });
  await cp(join(repository, "docs"), files, {
    recursive: true,
    filter: (source) => !source.endsWith(".md"),
  });
  for (const { node, file, order } of placed) {
    let page: string;
    if (node.from === undefined) {
      const items = (node.children ?? []).map((child) => {
        const childUrl = placed.find((other) => other.node === child)?.url ?? "";
        return `- [${child.title ?? child.slug}](${childUrl})`;
      });
      page =
        frontmatterOf({
          title: node.title ?? node.slug,
          description: node.description ?? "",
          order,
        }) + `${items.join("\n")}\n`;
    } else {
      const markdown = await readFile(join(repository, "docs", node.from), "utf8");
      const { heading, body } = contentOf(markdown, node.from, addresses);
      page =
        frontmatterOf({
          title: node.title ?? heading ?? node.slug,
          ...(node.description === undefined ? {} : { description: node.description }),
          order,
          edit: `${REPOSITORY}/edit/main/docs/${node.from}`,
        }) + body;
    }
    const target = join(content, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, page);
  }
  return placed.length;
}
