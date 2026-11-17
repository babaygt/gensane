import type { Diagnostic } from "../diagnostics/index.ts";
import { type BlockParseResult, parseBlocks } from "./block-parser.ts";
import { renderHtml } from "./render-html.ts";

export type {
  Block,
  CodeBlock,
  Document,
  Heading,
  HeadingLevel,
  Paragraph,
  ThematicBreak,
} from "./ast.ts";
export { DiagnosticCodes } from "./diagnostic-codes.ts";
export { escapeHtml, renderHtml } from "./render-html.ts";

export type ParseResult = BlockParseResult;

/** Parses Markdown into a syntax tree. Currently block structure only; inline syntax comes next. */
export function parseMarkdown(source: string, file: string): ParseResult {
  return parseBlocks(source, file);
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
