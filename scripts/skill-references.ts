// Makes the reference files of the agent skill in `skills/gensane/references/` from the documentation, so
// they are as true as the documentation, which the tests run. Each one is a page (or several) of `docs/`
// without its examples: the headings, the text and the tables, with links leading to gensane.dev.
// `pnpm skill` runs it after those pages change; a test fails while the files are out of date.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { addressesOf, withLinksRewritten } from "./import-docs.ts";

export const SKILL_FOLDER = join("skills", "gensane");
const SITE = "https://gensane.dev";

export interface Reference {
  /** The file in `references/`. */
  readonly file: string;
  readonly title: string;
  /** One line about it, under the title. */
  readonly about: string;
  /** Pages of `docs/`, each under a heading of its own when there are several. */
  readonly sources: readonly { readonly from: string; readonly heading?: string }[];
}

export const REFERENCES: readonly Reference[] = [
  {
    file: "content-types.md",
    title: "Content types",
    about: "Every kind of content, its folder, and every field of its frontmatter.",
    sources: [{ from: "frontmatter/content-types.md" }],
  },
  {
    file: "config.md",
    title: "The config",
    about: "Every setting of `gensane.config.ts`.",
    sources: [{ from: "cli/config.md" }],
  },
  {
    file: "templates.md",
    title: "Template variables",
    about: "What each template of a theme can show.",
    sources: [{ from: "core/templates.md" }],
  },
  {
    file: "problems.md",
    title: "Problems",
    about: "Every problem gensane reports, by its code, with what it means and how to fix it.",
    sources: [
      { from: "cli/problems.md", heading: "The config (GS5xx)" },
      { from: "frontmatter/diagnostics.md", heading: "Frontmatter (GS2xx)" },
      { from: "markdown-compiler/diagnostics.md", heading: "Markdown (GS1xx)" },
      { from: "template/diagnostics.md", heading: "Templates (GS3xx)" },
      { from: "core/diagnostics.md", heading: "The site (GS4xx)" },
    ],
  },
];

/**
 * A page of `docs/` without its title, its examples and the comments that mark them; links lead to
 * gensane.dev or GitHub; headings go `deeper` levels down, to fit under a heading of their own.
 */
export function withoutExamples(
  markdown: string,
  from: string,
  addresses: ReadonlyMap<string, string>,
  deeper = 0,
): string {
  const kept: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.split("\n").slice(markdown.startsWith("# ") ? 1 : 0)) {
    const opening = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence !== undefined) {
      if (line.startsWith(fence) && line.trim() === fence) fence = undefined;
      continue;
    }
    if (opening !== undefined) {
      fence = opening;
      continue;
    }
    if (/^<!--.*-->$/.test(line.trim())) continue;
    const linked = withLinksRewritten(line, from, addresses).replaceAll("](/", `](${SITE}/`);
    kept.push(/^#{2,} /.test(linked) ? `${"#".repeat(deeper)}${linked}` : linked);
  }
  // A sentence that led into an example ends with a full stop now, unless a list or a table follows.
  const ended = kept.map((line, index) => {
    const next = kept.slice(index + 1).find((later) => later.trim() !== "") ?? "";
    return line.endsWith(":") && !/^\s*([-*|]|\d+\.)/.test(next) ? `${line.slice(0, -1)}.` : line;
  });
  // An example often had text before and after it, which now meet with too many empty lines.
  return `${ended
    .join("\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

export async function referenceText(repository: string, reference: Reference): Promise<string> {
  const addresses = addressesOf();
  const parts: string[] = [];
  for (const { from, heading } of reference.sources) {
    const markdown = await readFile(join(repository, "docs", from), "utf8");
    const page = withoutExamples(markdown, from, addresses, heading === undefined ? 0 : 1);
    const url = `${SITE}${addresses.get(from) ?? ""}`;
    parts.push(heading === undefined ? page : `## ${heading}\n\nFrom [${url}](${url}).\n\n${page}`);
  }
  const source = reference.sources.map(({ from }) => `docs/${from}`).join(", ");
  return [
    `<!-- Made by scripts/skill.ts from ${source}; change those and run pnpm skill. -->`,
    "",
    `# ${reference.title}`,
    "",
    reference.about,
    "",
    parts.join("\n"),
  ].join("\n");
}

export async function writeReferences(repository: string): Promise<void> {
  for (const reference of REFERENCES) {
    const text = await referenceText(repository, reference);
    await writeFile(join(repository, SKILL_FOLDER, "references", reference.file), text);
  }
}
