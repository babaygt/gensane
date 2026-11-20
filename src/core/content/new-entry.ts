/**
 * The text of a new content file, as `gensane new` writes it: the fields its type needs, so the
 * file is ready to write in.
 */
import { assertNever } from "../../diagnostics/index.ts";
import { type ContentType, parseFrontmatter } from "../../frontmatter/index.ts";
import { folderOf } from "./folders.ts";

export const NEW_ENTRY_TYPES: readonly ContentType[] = [
  "post",
  "project",
  "talk",
  "experience",
  "education",
  "page",
];

export interface NewEntryDetails {
  /** The title, or the company for experience and the school for education. */
  readonly title: string;
  /** What the file is named after. */
  readonly slug: string;
  /** Today, as `YYYY-MM-DD`. */
  readonly today: string;
}

export interface NewEntry {
  /** Inside the content folder, such as `blog/2026-11-20-hello-world.md`. */
  readonly path: string;
  readonly text: string;
  /** Fields left empty, which the site needs filled in before it builds. */
  readonly toFill: readonly string[];
}

/** Written without quotes when frontmatter reads it back as the same text, and in quotes otherwise. */
function yamlText(text: string): string {
  const parsed = parseFrontmatter(`---\nvalue: ${text}\n---\n`, "");
  const value = parsed.ok ? parsed.value.data.entries[0]?.value : undefined;
  return value?.kind === "string" && value.value === text ? text : JSON.stringify(text);
}

const EMPTY = '""';

/** Each field as it is written: the name, and the value as YAML. */
function fieldsOf(type: ContentType, { title, today }: NewEntryDetails): [string, string][] {
  const name = yamlText(title);
  const month = today.slice(0, 7);
  switch (type) {
    case "post":
      return [
        ["title", name],
        ["date", today],
        ["draft", "true"],
      ];
    case "project":
      return [
        ["title", name],
        ["draft", "true"],
      ];
    case "page":
      return [["title", name]];
    case "talk":
      return [
        ["title", name],
        ["event", EMPTY],
        ["date", today],
      ];
    case "experience":
      return [
        ["company", name],
        ["role", EMPTY],
        ["start", month],
      ];
    case "education":
      return [
        ["school", name],
        ["degree", EMPTY],
        ["start", month],
      ];
    default:
      return assertNever(type);
  }
}

export function newEntry(type: ContentType, details: NewEntryDetails): NewEntry {
  const fields = fieldsOf(type, details);
  const name = type === "post" ? `${details.today}-${details.slug}` : details.slug;
  return {
    path: `${folderOf(type)}/${name}.md`,
    text: `---\n${fields.map(([field, value]) => `${field}: ${value}`).join("\n")}\n---\n`,
    toFill: fields.filter(([, value]) => value === EMPTY).map(([field]) => field),
  };
}
