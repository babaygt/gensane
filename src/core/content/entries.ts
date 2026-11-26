import type { SourceSpan } from "../../diagnostics/index.ts";
import type { ContentFields, ContentType } from "../../frontmatter/index.ts";
import type { TableOfContentsEntry } from "../../markdown/index.ts";

interface EntryDetails {
  /** The path inside the content folder, such as `blog/2026-11-17-hello.md`. */
  readonly file: string;
  readonly slug: string;
  /** Talks, experience and education are only shown in lists, so they have no URL. */
  readonly url: string | undefined;
  /** Where the URL was chosen: the `slug:` field, or else the start of the file. */
  readonly urlSpan: SourceSpan;
  /** Fields that the type of content doesn't define, for templates. */
  readonly extra: Readonly<Record<string, unknown>>;
  readonly html: string;
  /** The body as it is written, for the Markdown copies of `llms.txt`. */
  readonly markdown: string;
  readonly tableOfContents: readonly TableOfContentsEntry[];
  readonly excerpt: string;
  /** In minutes. */
  readonly readingTime: number;
  /** Code blocks in a language the highlighter didn't color, such as ```elixir, where they are written. */
  readonly plainCode: readonly PlainCode[];
}

export interface PlainCode {
  readonly language: string;
  readonly span: SourceSpan;
}

/** One content file, read and checked. Its `type` decides which `fields` it has. */
export type ContentEntry = {
  readonly [Type in ContentType]: EntryDetails & {
    readonly type: Type;
    readonly fields: ContentFields<Type>;
  };
}[ContentType];

export type { EntryDetails };

export type EntryOf<Type extends ContentType> = Extract<ContentEntry, { readonly type: Type }>;
