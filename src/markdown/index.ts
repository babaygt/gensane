import type { Diagnostic } from "../diagnostics/index.ts";
import { type BlockParseResult, parseBlocks } from "./block-parser.ts";
import { escapeRawHtml } from "./escape-raw-html.ts";
import { renderHtml } from "./render-html.ts";
import { resolveInlines } from "./resolve-inlines.ts";

export type {
  Block,
  BlockQuote,
  CodeBlock,
  CodeSpan,
  Document,
  Emphasis,
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
export { escapeHtml, renderHtml } from "./render-html.ts";

export type ParseResult = BlockParseResult;

export interface MarkdownOptions {
  /** `"allow"` (default) passes HTML in Markdown through; `"escape"` shows it as text. */
  readonly rawHtml?: "allow" | "escape";
}

/** Parses Markdown into a syntax tree: block structure first, then the text inside blocks. */
export function parseMarkdown(
  source: string,
  file: string,
  options: MarkdownOptions = {},
): ParseResult {
  const { document, diagnostics } = parseBlocks(source, file);
  const resolved = resolveInlines(document);
  return {
    document: options.rawHtml === "escape" ? escapeRawHtml(resolved) : resolved,
    diagnostics,
  };
}

export interface CompileResult {
  readonly html: string;
  readonly diagnostics: readonly Diagnostic[];
}

/** Parses and renders in one step. */
export function markdownToHtml(
  source: string,
  file: string,
  options: MarkdownOptions = {},
): CompileResult {
  const { document, diagnostics } = parseMarkdown(source, file, options);
  return { html: renderHtml(document), diagnostics };
}
