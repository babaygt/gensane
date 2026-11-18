import type { Diagnostic } from "../diagnostics/index.ts";
import { type BlockParseResult, parseBlocks } from "./block-parser.ts";
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
  Image,
  Inline,
  LineBreak,
  Link,
  List,
  ListItem,
  Paragraph,
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

/** Parses Markdown into a syntax tree: block structure first, then the text inside blocks. */
export function parseMarkdown(source: string, file: string): ParseResult {
  const { document, diagnostics } = parseBlocks(source, file);
  return { document: resolveInlines(document), diagnostics };
}

export interface CompileResult {
  readonly html: string;
  readonly diagnostics: readonly Diagnostic[];
}

/** Parses and renders in one step. */
export function markdownToHtml(source: string, file: string): CompileResult {
  const { document, diagnostics } = parseMarkdown(source, file);
  return { html: renderHtml(document), diagnostics };
}
