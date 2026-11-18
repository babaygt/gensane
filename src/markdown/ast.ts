/**
 * The syntax tree produced by the parser and consumed by the renderer.
 *
 * The set of node kinds is fixed, so it is a discriminated union on `kind`: code
 * that switches over it gets a compile error if a kind is forgotten. Nodes are
 * readonly; later stages build new trees instead of changing this one.
 *
 * The type is recursive: block quotes and list items contain blocks themselves.
 *
 * Blocks with text keep it raw at first. A later stage parses it and fills `inlines`.
 */
import type { SourcePosition, SourceSpan } from "../diagnostics/index.ts";
import type { HeadingLevel } from "./block-rules.ts";
import type { TableAlignment } from "./table-rules.ts";

export type { HeadingLevel, TableAlignment };

/** Maps part of a block's text back to the file: `text[index]` is at `position`. */
export interface TextSegment {
  readonly index: number;
  readonly position: SourcePosition;
}

export interface Text {
  readonly kind: "text";
  readonly text: string;
  readonly span: SourceSpan;
}

export interface CodeSpan {
  readonly kind: "code-span";
  readonly text: string;
  readonly span: SourceSpan;
}

export interface Emphasis {
  readonly kind: "emphasis";
  readonly children: readonly Inline[];
  readonly span: SourceSpan;
}

export interface Strong {
  readonly kind: "strong";
  readonly children: readonly Inline[];
  readonly span: SourceSpan;
}

export interface Strikethrough {
  readonly kind: "strikethrough";
  readonly children: readonly Inline[];
  readonly span: SourceSpan;
}

export interface LineBreak {
  readonly kind: "hard-break" | "soft-break";
  readonly span: SourceSpan;
}

export interface Link {
  readonly kind: "link";
  readonly url: string;
  readonly title?: string;
  readonly children: readonly Inline[];
  readonly span: SourceSpan;
}

export interface Image {
  readonly kind: "image";
  readonly url: string;
  readonly title?: string;
  /** The image description; rendered as plain text in the `alt` attribute. */
  readonly children: readonly Inline[];
  readonly span: SourceSpan;
}

export interface RawHtml {
  readonly kind: "raw-html";
  readonly text: string;
  readonly span: SourceSpan;
}

export interface FootnoteReference {
  readonly kind: "footnote-reference";
  readonly label: string;
  /** The number of the note. Set once references are connected to their definitions. */
  readonly number?: number;
  /** 1 for the first reference to a note, 2 for the second, and so on. */
  readonly referenceIndex?: number;
  readonly span: SourceSpan;
}

export type Inline =
  | FootnoteReference
  | RawHtml
  | Text
  | CodeSpan
  | Emphasis
  | Strong
  | Strikethrough
  | LineBreak
  | Link
  | Image;

export interface Heading {
  readonly kind: "heading";
  readonly level: HeadingLevel;
  /** Unique within the document; used as the target of links to this section. */
  readonly id?: string;
  readonly text: string;
  readonly segments: readonly TextSegment[];
  readonly inlines?: readonly Inline[];
  readonly span: SourceSpan;
}

export interface Paragraph {
  readonly kind: "paragraph";
  readonly text: string;
  readonly segments: readonly TextSegment[];
  readonly inlines?: readonly Inline[];
  readonly span: SourceSpan;
}

export interface CodeBlock {
  readonly kind: "code";
  /** Everything after the opening fence, e.g. `ts title=demo`. */
  readonly infoString: string;
  /** First word of `infoString`; absent when there is no info string. */
  readonly language?: string;
  /** Content lines, each ending in `\n`. */
  readonly text: string;
  readonly span: SourceSpan;
}

export interface ThematicBreak {
  readonly kind: "thematic-break";
  readonly span: SourceSpan;
}

/** `[^label]: text` where it was written. These move to `Document.footnotes` in a later pass. */
export interface FootnoteDefinition {
  readonly kind: "footnote-definition";
  readonly label: string;
  readonly children: readonly Block[];
  readonly span: SourceSpan;
}

/** A referenced note, in the numbered list at the end of the document. */
export interface Footnote {
  readonly kind: "footnote";
  readonly label: string;
  readonly number: number;
  readonly referenceCount: number;
  readonly children: readonly Block[];
  readonly span: SourceSpan;
}

export interface HtmlBlock {
  readonly kind: "html-block";
  readonly text: string;
  readonly span: SourceSpan;
}

export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";

export interface BlockQuote {
  readonly kind: "block-quote";
  /** Set when the quote starts with a marker such as `[!NOTE]`. */
  readonly callout?: CalloutKind;
  readonly children: readonly Block[];
  readonly span: SourceSpan;
}

interface ListBase {
  readonly kind: "list";
  /** Tight lists have no blank lines between items; their paragraphs render without `<p>`. */
  readonly tight: boolean;
  readonly items: readonly ListItem[];
  readonly span: SourceSpan;
}

/** `ordered` is the discriminant: only ordered lists have a start number. */
export type List =
  | (ListBase & { readonly ordered: false })
  | (ListBase & { readonly ordered: true; readonly start: number });

export interface ListItem {
  readonly kind: "list-item";
  /** Set on task list items: `[x]` is checked and `[ ]` is not. */
  readonly checked?: boolean;
  readonly children: readonly Block[];
  readonly span: SourceSpan;
}

export interface TableCell {
  readonly kind: "table-cell";
  readonly text: string;
  readonly segments: readonly TextSegment[];
  readonly inlines?: readonly Inline[];
  readonly span: SourceSpan;
}

export interface TableRow {
  readonly kind: "table-row";
  /** Always one cell per column: short rows are filled up, long rows are cut off. */
  readonly cells: readonly TableCell[];
  readonly span: SourceSpan;
}

export interface Table {
  readonly kind: "table";
  readonly alignments: readonly TableAlignment[];
  readonly header: TableRow;
  readonly rows: readonly TableRow[];
  readonly span: SourceSpan;
}

export type Block =
  | FootnoteDefinition
  | HtmlBlock
  | Heading
  | Paragraph
  | CodeBlock
  | ThematicBreak
  | BlockQuote
  | List
  | Table;

export interface Document {
  readonly kind: "document";
  readonly children: readonly Block[];
  /** The notes of the document in display order; absent when there are none. */
  readonly footnotes?: readonly Footnote[];
  readonly span: SourceSpan;
}
