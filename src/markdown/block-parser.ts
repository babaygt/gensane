/**
 * Stage 2 of the compiler: group lines into blocks (headings, paragraphs, code, ...).
 *
 * Markdown has no syntax errors: every input is a valid document. So instead of
 * failing, the parser always returns a document, plus warnings for input that is
 * probably a mistake (an unclosed code fence) or uses syntax gensane deliberately
 * does not support. One run reports every warning in the file.
 */
import {
  type Diagnostic,
  type DiagnosticCode,
  InternalError,
  type SourcePosition,
  type SourceSpan,
  positionAt,
} from "../diagnostics/index.ts";
import type { Block, CodeBlock, Document, Paragraph } from "./ast.ts";
import {
  type FenceOpen,
  isFenceClose,
  isSetextUnderline,
  isThematicBreak,
  matchAtxHeading,
  matchFenceOpen,
} from "./block-rules.ts";
import { DiagnosticCodes } from "./diagnostic-codes.ts";
import { type SourceLine, isBlank, leadingIndent, splitLines } from "./lines.ts";

export interface BlockParseResult {
  readonly document: Document;
  readonly diagnostics: readonly Diagnostic[];
}

/** Parses the block structure of a Markdown file. `file` is only used in source spans. */
export function parseBlocks(source: string, file: string): BlockParseResult {
  return new BlockParser(source, file).parse();
}

/** Indentation at which CommonMark would start an indented code block. */
const CODE_INDENT = 4;

/**
 * Single-use parser. The cursor and output lists are private mutable state, but they
 * never escape: `parseBlocks` creates a parser, runs it once and returns plain data.
 */
class BlockParser {
  readonly #source: string;
  readonly #file: string;
  readonly #lines: readonly SourceLine[];
  readonly #blocks: Block[] = [];
  readonly #diagnostics: Diagnostic[] = [];
  #index = 0;

  constructor(source: string, file: string) {
    this.#source = source;
    this.#file = file;
    this.#lines = splitLines(source);
  }

  parse(): BlockParseResult {
    while (this.#index < this.#lines.length) {
      const line = this.#current();
      if (isBlank(line.text)) {
        this.#index++;
      } else {
        this.#blocks.push(this.#parseBlock(line));
      }
    }
    const document: Document = {
      kind: "document",
      children: this.#blocks,
      span: {
        file: this.#file,
        start: positionAt(this.#source, 0),
        end: positionAt(this.#source, this.#source.length),
      },
    };
    return { document, diagnostics: this.#diagnostics };
  }

  #parseBlock(line: SourceLine): Block {
    const fence = matchFenceOpen(line.text);
    if (fence !== undefined) return this.#parseFencedCode(fence);

    const heading = matchAtxHeading(line.text);
    if (heading !== undefined) {
      this.#index++;
      return {
        kind: "heading",
        level: heading.level,
        text: heading.content,
        span: this.#span(line, line),
      };
    }

    if (isThematicBreak(line.text)) {
      this.#index++;
      return { kind: "thematic-break", span: this.#span(line, line) };
    }

    return this.#parseParagraph();
  }

  #parseFencedCode(open: FenceOpen): CodeBlock {
    const first = this.#current();
    const content: string[] = [];
    let last = first;
    let closed = false;
    this.#index++;

    while (this.#index < this.#lines.length) {
      const line = this.#current();
      this.#index++;
      last = line;
      if (isFenceClose(line.text, open)) {
        closed = true;
        break;
      }
      content.push(removeSpaces(line.text, open.indent));
    }

    if (!closed) {
      const fence = open.char.repeat(open.length);
      this.#warn(
        DiagnosticCodes.unclosedCodeFence,
        first,
        "code block is never closed",
        `add a line with ${fence} after the last line of code; until then, the rest of the file is treated as code`,
      );
    }

    const lang = open.info.split(/[ \t]/)[0];
    return {
      kind: "code",
      info: open.info,
      ...(lang ? { lang } : {}),
      text: content.map((l) => `${l}\n`).join(""),
      span: this.#span(first, last),
    };
  }

  #parseParagraph(): Paragraph {
    const first = this.#current();
    if (leadingIndent(first.text).width >= CODE_INDENT) {
      this.#warn(
        DiagnosticCodes.indentedCode,
        first,
        "indented code blocks are not supported; this is read as a normal paragraph",
        "wrap code in ``` fences, or remove the indentation if this is text",
      );
    }

    const texts = [withoutIndent(first.text)];
    let last = first;
    this.#index++;

    while (this.#index < this.#lines.length) {
      const line = this.#current();
      if (isBlank(line.text)) break;

      const underline = isSetextUnderline(line.text);
      const interrupts = this.#startsBlock(line);
      if (underline !== undefined) this.#warnSetext(line, interrupts);
      if (interrupts) break;

      texts.push(withoutIndent(line.text));
      last = line;
      this.#index++;
    }

    return { kind: "paragraph", text: texts.join("\n").trimEnd(), span: this.#span(first, last) };
  }

  /** Lines that end a paragraph even without a blank line before them. */
  #startsBlock(line: SourceLine): boolean {
    return (
      matchFenceOpen(line.text) !== undefined ||
      matchAtxHeading(line.text) !== undefined ||
      isThematicBreak(line.text)
    );
  }

  /** `Title` followed by `===` or `---` is a heading in CommonMark, but not in gensane. */
  #warnSetext(line: SourceLine, readAsBreak: boolean): void {
    const message = readAsBreak
      ? "`---` directly under text is read as a horizontal rule, not as a heading underline"
      : "underlined (setext) headings are not supported; this line is read as text";
    const hint = readAsBreak
      ? "for a heading write `## Title`; for a horizontal rule, put a blank line before `---`"
      : "write the heading as `# Title` instead";
    this.#warn(DiagnosticCodes.setextHeading, line, message, hint);
  }

  #warn(code: DiagnosticCode, line: SourceLine, message: string, hint: string): void {
    this.#diagnostics.push({
      code,
      severity: "warning",
      message,
      span: this.#span(line, line),
      hint,
    });
  }

  #current(): SourceLine {
    const line = this.#lines[this.#index];
    if (line === undefined) throw new InternalError(`no line at index ${this.#index}`);
    return line;
  }

  /** From the start of `first` to the end of `last`. Positions are computed from the lines directly. */
  #span(first: SourceLine, last: SourceLine): SourceSpan {
    return { file: this.#file, start: position(first, first.start), end: position(last, last.end) };
  }
}

function position(line: SourceLine, offset: number): SourcePosition {
  return { line: line.number, column: offset - line.start + 1, offset };
}

function withoutIndent(text: string): string {
  return text.slice(leadingIndent(text).length);
}

/** Removes up to `count` leading spaces (used for content inside an indented fence). */
function removeSpaces(text: string, count: number): string {
  let i = 0;
  while (i < count && text[i] === " ") i++;
  return text.slice(i);
}
