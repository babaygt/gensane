/**
 * The syntax tree produced by the parser and consumed by the renderer.
 *
 * The set of node kinds is fixed, so it is a discriminated union on `kind`: code
 * that switches over it gets a compile error if a kind is forgotten. Nodes are
 * readonly; later stages build new trees instead of changing this one.
 *
 * Headings and paragraphs keep their raw inline text for now. Inline syntax
 * (emphasis, links, code spans) is parsed in a later stage.
 */
import type { SourceSpan } from "../diagnostics/index.ts";
import type { HeadingLevel } from "./block-rules.ts";

export type { HeadingLevel };

export interface Heading {
  readonly kind: "heading";
  readonly level: HeadingLevel;
  readonly text: string;
  readonly span: SourceSpan;
}

export interface Paragraph {
  readonly kind: "paragraph";
  readonly text: string;
  readonly span: SourceSpan;
}

export interface CodeBlock {
  readonly kind: "code";
  /** Everything after the opening fence, e.g. `ts title=demo`. */
  readonly info: string;
  /** First word of `info`; absent when there is no info string. */
  readonly lang?: string;
  /** Content lines, each ending in `\n`. */
  readonly text: string;
  readonly span: SourceSpan;
}

export interface ThematicBreak {
  readonly kind: "thematic-break";
  readonly span: SourceSpan;
}

export type Block = Heading | Paragraph | CodeBlock | ThematicBreak;

export interface Document {
  readonly kind: "document";
  readonly children: readonly Block[];
  readonly span: SourceSpan;
}
