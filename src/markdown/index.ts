import type { Diagnostic } from "../diagnostics/index.ts";
import type { Document } from "./ast.ts";
import { applyBlockExtensions } from "./passes/block-extensions.ts";
import { type BlockParseResult, parseBlocks } from "./blocks/block-parser.ts";
import { escapeRawHtml } from "./passes/escape-raw-html.ts";
import { type Highlighter, highlightCode } from "./passes/highlight-code.ts";
import { assignHeadingIds } from "./passes/heading-ids.ts";
import { renderHtml } from "./output/render-html.ts";
import { resolveFootnotes } from "./passes/resolve-footnotes.ts";
import { resolveInlines } from "./passes/resolve-inlines.ts";
import { type TableOfContentsEntry, buildTableOfContents } from "./output/table-of-contents.ts";

export type {
  Block,
  BlockQuote,
  CalloutKind,
  CodeBlock,
  CodeSpan,
  Document,
  Emphasis,
  Footnote,
  FootnoteDefinition,
  FootnoteReference,
  Heading,
  HeadingLevel,
  HtmlBlock,
  Image,
  Inline,
  LineBreak,
  Link,
  List,
  ListItem,
  Paragraph,
  RawHtml,
  Strikethrough,
  Strong,
  Table,
  TableAlignment,
  TableCell,
  TableRow,
  Text,
  ThematicBreak,
} from "./ast.ts";
export { DiagnosticCodes } from "./diagnostic-codes.ts";
export type { Highlighter } from "./passes/highlight-code.ts";
export { escapeHtml, renderHtml } from "./output/render-html.ts";
export { type TableOfContentsEntry, buildTableOfContents } from "./output/table-of-contents.ts";

export type ParseResult = BlockParseResult;

export interface MarkdownOptions {
  /** `"allow"` (default) passes HTML in Markdown through; `"escape"` shows it as text. */
  readonly rawHtml?: "allow" | "escape";
  /** Give headings an `id` so links can point at them. Defaults to `true`. */
  readonly headingIds?: boolean;
  /** Colors code blocks at build time: the HTML inside `<code>`, or `undefined` to leave a block as it is. */
  readonly highlight?: Highlighter;
}

/** Highlighting runs after raw HTML is escaped, so the HTML it gives is kept. */
function highlighted(document: Document, highlight: Highlighter | undefined): Document {
  return highlight === undefined ? document : highlightCode(document, highlight);
}

/** Parses Markdown into a syntax tree: block structure first, then the text inside blocks. */
export function parseMarkdown(
  source: string,
  file: string,
  options: MarkdownOptions = {},
): ParseResult {
  const { document, diagnostics } = parseBlocks(source, file);
  const resolved = resolveInlines(applyBlockExtensions(document));
  const withIds = options.headingIds === false ? resolved : assignHeadingIds(resolved);
  const footnotes = resolveFootnotes(withIds);
  return {
    document: highlighted(
      options.rawHtml === "escape" ? escapeRawHtml(footnotes.document) : footnotes.document,
      options.highlight,
    ),
    diagnostics: [...diagnostics, ...footnotes.diagnostics].toSorted(
      (first, second) => first.span.start.offset - second.span.start.offset,
    ),
  };
}

export interface CompileResult {
  readonly html: string;
  readonly tableOfContents: readonly TableOfContentsEntry[];
  readonly diagnostics: readonly Diagnostic[];
}

/** Parses and renders in one step. */
export function markdownToHtml(
  source: string,
  file: string,
  options: MarkdownOptions = {},
): CompileResult {
  const { document, diagnostics } = parseMarkdown(source, file, options);
  return {
    html: renderHtml(document),
    tableOfContents: buildTableOfContents(document),
    diagnostics,
  };
}
