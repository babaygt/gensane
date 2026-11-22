/**
 * `llms.txt` and a Markdown copy of each page, so that AI tools can read the site as text, as
 * https://llmstxt.org/ proposes: the file lists the pages, and each page's copy is beside its HTML,
 * at its URL with `index.md` added.
 */
import type { ContentEntry, EntryOf } from "../content/entries.ts";
import { siteAddressOf } from "../feeds/site-address.ts";
import { readingOrder, sectionsOf } from "../site/sections.ts";
import type { SiteGraph } from "../site/site-graph.ts";

export const LLMS_PATH = "llms.txt";

type Listed = EntryOf<"page"> | EntryOf<"post"> | EntryOf<"project">;

function isDraft(entry: ContentEntry): boolean {
  return "draft" in entry.fields && entry.fields.draft;
}

/** The entries that are there and aren't drafts, which are never listed, even when shown. */
function shown<Entry extends Listed>(entries: readonly (Entry | undefined)[]): Entry[] {
  return entries.filter((entry): entry is Entry => entry !== undefined && !isDraft(entry));
}

/** `/blog/hello/` → `blog/hello/index.md`, and `/` → `index.md`. */
function copyPath(entry: Listed): string {
  return `${(entry.url ?? "/").slice(1)}index.md`;
}

/** Brackets would end the text of the link early. */
function linkText(text: string): string {
  return text.replaceAll(/[[\]\\]/g, (character) => `\\${character}`);
}

function copyOf(entry: Listed): string {
  const { title, description } = entry.fields;
  const lead = description === undefined ? "" : `> ${description}\n\n`;
  const body = entry.markdown.replace(/^\n+/, "");
  return `# ${title}\n\n${lead}${body}${body === "" || body.endsWith("\n") ? "" : "\n"}`;
}

export function llmsFiles(
  site: Readonly<Record<string, unknown>>,
  graph: SiteGraph,
): readonly { readonly path: string; readonly content: string }[] {
  const address = siteAddressOf(site["url"]);
  const linkOf = (entry: Listed) => {
    const { title, description } = entry.fields;
    const url = `${address?.base ?? ""}/${copyPath(entry)}`;
    return `- [${linkText(title)}](${url})${description === undefined ? "" : `: ${description}`}`;
  };

  const home = graph.routes.flatMap((route) => (route.kind === "home" ? [route.page] : []));
  const pages = shown(graph.collections.pages);
  const sections = [...sectionsOf(pages).values()];
  const inSections = new Set(sections.flatMap(readingOrder));
  const groups: [string, readonly Listed[]][] = [
    ["Pages", shown([...home, ...pages.filter((page) => !inSections.has(page))])],
    ...sections.map((section): [string, readonly Listed[]] => [
      section.title,
      shown(readingOrder(section)),
    ]),
    ["Posts", shown(graph.collections.posts)],
    ["Projects", shown(graph.collections.projects)],
  ];

  const title = site["title"];
  const description = site["description"];
  const lines = [`# ${typeof title === "string" ? title : (address?.host ?? "Site")}`];
  if (typeof description === "string") lines.push("", `> ${description}`);
  for (const [name, entries] of groups) {
    if (entries.length > 0) lines.push("", `## ${name}`, "", ...entries.map(linkOf));
  }
  const listed = groups.flatMap(([, entries]) => entries);
  return [
    { path: LLMS_PATH, content: `${lines.join("\n")}\n` },
    ...listed.map((entry) => ({ path: copyPath(entry), content: copyOf(entry) })),
  ];
}
