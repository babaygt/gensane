/**
 * Checks that links and images lead somewhere: every link in the content, every `cover`, and
 * every link written into a template. A link can lead to a page, the feed, the sitemap, or a file
 * from the `public` folder, and a link to a part of a page needs an element with that id.
 */
import {
  type Diagnostic,
  type SourceSpan,
  closestMatch,
  positionAt,
} from "../../diagnostics/index.ts";
import type { ContentEntry } from "../content/entries.ts";
import { CoreCodes } from "../diagnostic-codes.ts";
import { problem, startOf } from "../problems.ts";

export interface LinkCheckInput {
  /** Every entry that was read, so that a link to a draft can be explained. */
  readonly entries: readonly ContentEntry[];
  /** Whether drafts are published, for a preview. */
  readonly drafts: boolean;
  readonly contentFolder: string;
  /** The content files and templates as they were written, to find each link in them. */
  readonly content: Readonly<Record<string, string>>;
  readonly templates: Readonly<Record<string, string>>;
  /** The files the site writes, by path. */
  readonly files: ReadonlyMap<string, string>;
  readonly publicFiles: readonly string[];
}

const LINK = /<(?:a|img)\b[^>]*?\s(?:href|src)="([^"]*)"/gi;
const ID = /\sid="([^"]*)"/g;
const SCHEME = /^[a-z][a-z\d+.-]*:/i;
/** Only used to resolve relative links; it never appears in output. */
const BASE = "https://site.invalid";

const ENTITIES: ReadonlyMap<string, string> = new Map([
  ["&amp;", "&"],
  ["&quot;", '"'],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&#39;", "'"],
]);

function decodeAttribute(value: string): string {
  return value.replace(/&(?:amp|quot|lt|gt|#39);/g, (entity) => ENTITIES.get(entity) ?? entity);
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** `blog/index.html` → `/blog/`, `feed.xml` → `/feed.xml` */
function urlOfFile(path: string): string {
  return `/${path.replace(/(^|\/)index\.html$/, "$1")}`;
}

interface Target {
  readonly path: string;
  readonly fragment: string;
}

/** Links to other sites, and relative links where there is no page to start from, aren't checked. */
function resolve(link: string, page: string | undefined): Target | undefined {
  if (SCHEME.test(link) || link.startsWith("//")) return undefined;
  if (page === undefined && !link.startsWith("/")) return undefined;
  const url = new URL(link, `${BASE}${page ?? "/"}`);
  return { path: decodePath(url.pathname), fragment: decodePath(url.hash.slice(1)) };
}

class LinkChecker {
  readonly #input: LinkCheckInput;
  readonly #targets: ReadonlySet<string>;
  readonly #knownUrls: readonly string[];
  readonly #draftUrls: ReadonlySet<string>;
  readonly #ids = new Map<string, ReadonlySet<string>>();
  readonly #problems: Diagnostic[] = [];

  constructor(input: LinkCheckInput) {
    this.#input = input;
    this.#targets = new Set([...input.files.keys(), ...input.publicFiles]);
    this.#knownUrls = [...this.#targets].map(urlOfFile);
    const drafts = input.entries.filter((entry) => this.#isDraft(entry));
    this.#draftUrls = new Set(
      drafts.flatMap((entry) => (entry.url === undefined ? [] : [entry.url])),
    );
  }

  check(): readonly Diagnostic[] {
    this.#checkPublicFiles();
    for (const entry of this.#input.entries) {
      if (!this.#input.drafts && this.#isDraft(entry)) continue;
      const file = `${this.#input.contentFolder}/${entry.file}`;
      const source = this.#input.content[entry.file] ?? "";
      for (const [, value = ""] of entry.html.matchAll(LINK)) {
        const link = decodeAttribute(value);
        this.#checkLink(link, entry.url, () => this.#spanOf(file, source, link));
      }
      const cover = "cover" in entry.fields ? entry.fields.cover : undefined;
      if (cover !== undefined)
        this.#checkLink(cover, entry.url, () => this.#spanOf(file, source, cover));
    }
    for (const [name, source] of Object.entries(this.#input.templates))
      this.#checkTemplate(name, source);
    return this.#problems;
  }

  #isDraft(entry: ContentEntry): boolean {
    return "draft" in entry.fields && entry.fields.draft;
  }

  /** A link that is written out in full; one that is built with `{{ }}` comes from the pages themselves. */
  #checkTemplate(name: string, source: string): void {
    for (const match of source.matchAll(LINK)) {
      const [whole, value = ""] = match;
      if (value.includes("{{") || value.includes("{%")) continue;
      const start = match.index + whole.length - 1 - value.length;
      const span = (): SourceSpan => ({
        file: name,
        start: positionAt(source, start),
        end: positionAt(source, start + value.length),
      });
      this.#checkLink(decodeAttribute(value), undefined, span);
    }
  }

  /** The first place the link is written in the file, or else the start of the file. */
  #spanOf(file: string, source: string, link: string): SourceSpan {
    const offset = source.indexOf(link);
    if (offset < 0) return startOf(file);
    return {
      file,
      start: positionAt(source, offset),
      end: positionAt(source, offset + link.length),
    };
  }

  #checkLink(link: string, page: string | undefined, spanOf: () => SourceSpan): void {
    const target = resolve(link, page);
    if (target === undefined) return;
    const file = this.#fileOf(target.path);
    if (file === undefined) {
      this.#problems.push(
        problem(
          CoreCodes.brokenLink,
          `"${target.path}" doesn't lead to a page or a file of the site`,
          spanOf(),
          this.#brokenLinkHint(target.path),
        ),
      );
      return;
    }
    const ids = this.#idsOf(file);
    if (target.fragment === "" || ids === undefined || ids.has(target.fragment)) return;
    const suggestion = closestMatch(target.fragment, [...ids]);
    this.#problems.push(
      problem(
        CoreCodes.missingAnchor,
        `"${link}" leads to ${urlOfFile(file)}, which has no element with the id "${target.fragment}"`,
        spanOf(),
        suggestion === undefined
          ? "check the id of the heading or element it should lead to"
          : `did you mean "#${suggestion}"?`,
        "warning",
      ),
    );
  }

  /** `/blog/hello` also leads to `/blog/hello/`, as on most web servers. */
  #fileOf(path: string): string | undefined {
    const relative = path.slice(1);
    const candidates =
      relative === "" || relative.endsWith("/")
        ? [`${relative}index.html`]
        : [relative, `${relative}/index.html`];
    return candidates.find((candidate) => this.#targets.has(candidate));
  }

  #brokenLinkHint(path: string): string {
    if (this.#draftUrls.has(path)) return `"${path}" is a draft, so it isn't published`;
    const suggestion = closestMatch(path, this.#knownUrls);
    return suggestion === undefined
      ? "check the address, or put the file in the `public` folder"
      : `did you mean "${suggestion}"?`;
  }

  /** Only the pages the site writes are looked into, not files from the `public` folder. */
  #idsOf(file: string): ReadonlySet<string> | undefined {
    const html = this.#input.files.get(file);
    if (html === undefined) return undefined;
    const known = this.#ids.get(file);
    if (known !== undefined) return known;
    const ids = new Set([...html.matchAll(ID)].map(([, id = ""]) => decodeAttribute(id)));
    this.#ids.set(file, ids);
    return ids;
  }

  #checkPublicFiles(): void {
    for (const path of this.#input.publicFiles) {
      if (!this.#input.files.has(path)) continue;
      const replaced =
        path === "feed.xml"
          ? "the feed"
          : path === "sitemap.xml"
            ? "the sitemap"
            : `the page ${urlOfFile(path)}`;
      this.#problems.push(
        problem(
          CoreCodes.publicFileClash,
          `"public/${path}" would replace ${replaced}, which the site writes`,
          startOf(`public/${path}`),
          "rename the file, or move it into a folder",
        ),
      );
    }
  }
}

export function checkLinks(input: LinkCheckInput): readonly Diagnostic[] {
  return new LinkChecker(input).check();
}
