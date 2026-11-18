/**
 * Stage 2 of the compiler: group lines into blocks (headings, paragraphs, code, ...).
 *
 * Markdown has no syntax errors: every input is a valid document. So instead of
 * failing, the parser always returns a document, plus warnings for input that is
 * probably a mistake (an unclosed code fence) or uses syntax gensane deliberately
 * does not support. One run reports every warning in the file.
 *
 * Block quotes and list items are parsed recursively: the parser collects the lines
 * that belong to the container, strips the `>` markers or the indentation, and runs
 * a new parser on those lines. Stripped lines keep their original offsets, so spans
 * at any depth point into the original file.
 *
 * Lazy lines (`> a` followed by `b`) are only provisionally part of a container. The
 * nested parser accepts them as paragraph text, or stops at the first one it can't
 * use and reports how many lines it consumed; the container then ends there.
 */
import {
  type Diagnostic,
  type DiagnosticCode,
  InternalError,
  type SourcePosition,
  type SourceSpan,
  positionAt,
} from "../../diagnostics/index.ts";
import type {
  Block,
  BlockQuote,
  CodeBlock,
  Document,
  FootnoteDefinition,
  HtmlBlock,
  List,
  ListItem,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextSegment,
} from "../ast.ts";
import {
  type FenceOpen,
  type FootnoteDefinitionMatch,
  type ListMarkerMatch,
  isFenceClose,
  isSameListType,
  isSetextUnderline,
  isThematicBreak,
  matchAtxHeading,
  matchBlockQuote,
  matchFenceOpen,
  matchFootnoteDefinition,
  matchListMarker,
} from "./block-rules.ts";
import { DiagnosticCodes } from "../diagnostic-codes.ts";
import { type HtmlBlockType, endsHtmlBlock, matchHtmlBlockStart } from "./html-rules.ts";
import {
  type SourceLine,
  isBlank,
  leadingIndent,
  sliceLine,
  splitLines,
  stripColumns,
} from "./lines.ts";
import { type TableAlignment, matchDelimiterRow, splitTableRow } from "./table-rules.ts";

export interface BlockParseResult {
  readonly document: Document;
  readonly diagnostics: readonly Diagnostic[];
}

/** Parses the block structure of a Markdown file. `file` is only used in source spans. */
export function parseBlocks(source: string, file: string): BlockParseResult {
  const { blocks, diagnostics } = parseLines(splitLines(source), file, 0);
  const document: Document = {
    kind: "document",
    children: blocks,
    span: { file, start: positionAt(source, 0), end: positionAt(source, source.length) },
  };
  return { document, diagnostics };
}

interface LinesParseResult {
  readonly blocks: readonly Block[];
  readonly diagnostics: readonly Diagnostic[];
  /** Lines used. Fewer than given when parsing stopped at a lazy line it could not use. */
  readonly consumed: number;
}

function parseLines(lines: readonly SourceLine[], file: string, depth: number): LinesParseResult {
  return new BlockParser(lines, file, depth).parse();
}

/** Indentation at which CommonMark would start an indented code block. */
const INDENTED_CODE_WIDTH = 4;

const FOOTNOTE_CONTENT_COLUMN = 4;

const HTML_BLOCK_END_NAMES: Partial<Record<HtmlBlockType, string>> = {
  1: "the closing tag",
  2: "`-->`",
  3: "`?>`",
  4: "`>`",
  5: "`]]>`",
};

/** Containers are parsed recursively, so unlimited nesting would overflow the call stack. */
const MAX_NESTING_DEPTH = 256;

/**
 * Single-use parser. The cursor and output lists are private mutable state, but they
 * never escape: `parseLines` creates a parser, runs it once and returns plain data.
 */
class BlockParser {
  readonly #file: string;
  readonly #lines: readonly SourceLine[];
  readonly #depth: number;
  readonly #blocks: Block[] = [];
  readonly #diagnostics: Diagnostic[] = [];
  #index = 0;

  constructor(lines: readonly SourceLine[], file: string, depth: number) {
    this.#lines = lines;
    this.#file = file;
    this.#depth = depth;
  }

  parse(): LinesParseResult {
    while (this.#index < this.#lines.length) {
      const line = this.#current();
      // A lazy line here would start a new block, so it doesn't belong to this container.
      if (line.lazy) break;
      if (isBlank(line.text)) {
        this.#index++;
      } else {
        this.#blocks.push(this.#parseBlock(line));
      }
    }
    return { blocks: this.#blocks, diagnostics: this.#diagnostics, consumed: this.#index };
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
        segments: [
          {
            index: 0,
            position: position(
              line,
              line.start +
                line.text.indexOf(heading.content, leadingIndent(line.text).length + heading.level),
            ),
          },
        ],
        span: this.#span(line, line),
      };
    }

    // Before lists: `* * *` is a thematic break, not a list item.
    if (isThematicBreak(line.text)) {
      this.#index++;
      return { kind: "thematic-break", span: this.#span(line, line) };
    }

    const marker = matchListMarker(line.text);
    const footnote = matchFootnoteDefinition(line.text);
    const isContainer =
      marker !== undefined || footnote !== undefined || matchBlockQuote(line.text) !== undefined;
    if (isContainer && this.#depth >= MAX_NESTING_DEPTH) {
      this.#warn(
        DiagnosticCodes.nestingTooDeep,
        line,
        `blocks are nested more than ${MAX_NESTING_DEPTH} levels deep; this line is read as text`,
        "reduce the nesting of block quotes and lists",
      );
      return this.#parseParagraph();
    }
    if (marker !== undefined) return this.#parseList(marker);
    if (footnote !== undefined) return this.#parseFootnoteDefinition(footnote);
    if (isContainer) return this.#parseBlockQuote();

    const htmlType = matchHtmlBlockStart(line.text);
    if (htmlType !== undefined) return this.#parseHtmlBlock(htmlType);

    const alignments = this.#tableAlignmentsAt(this.#index);
    if (alignments !== undefined) return this.#parseTable(alignments);

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
      if (line.lazy) break;
      this.#index++;
      last = line;
      if (isFenceClose(line.text, open)) {
        closed = true;
        break;
      }
      content.push(removeSpaces(line.text, open.indent));
    }

    if (!closed) {
      const fence = open.character.repeat(open.length);
      this.#warn(
        DiagnosticCodes.unclosedCodeFence,
        first,
        "code block is never closed",
        `add a line with ${fence} after the last line of code; until then, everything after it is treated as code`,
      );
    }

    const language = open.infoString.split(/[ \t]/)[0];
    return {
      kind: "code",
      infoString: open.infoString,
      ...(language ? { language } : {}),
      text: content.map((contentLine) => `${contentLine}\n`).join(""),
      span: this.#span(first, last),
    };
  }

  #parseParagraph(): Paragraph {
    const first = this.#current();
    if (leadingIndent(first.text).width >= INDENTED_CODE_WIDTH) {
      this.#warn(
        DiagnosticCodes.indentedCode,
        first,
        "indented code blocks are not supported; this is read as a normal paragraph",
        "wrap code in ``` fences, or remove the indentation if this is text",
      );
    }

    this.#warnIfColumnsDiffer(this.#index);
    const texts = [withoutIndent(first.text)];
    const segments = [contentSegment(first, 0)];
    let textLength = (texts[0] ?? "").length;
    let last = first;
    this.#index++;

    while (this.#index < this.#lines.length) {
      const line = this.#current();
      if (isBlank(line.text)) break;

      const underline = isSetextUnderline(line.text);
      const interrupts = interruptsParagraph(line.text);
      if (underline !== undefined) this.#warnSetext(line, interrupts);
      if (interrupts || this.#tableAlignmentsAt(this.#index) !== undefined) break;

      this.#warnIfColumnsDiffer(this.#index);
      const text = withoutIndent(line.text);
      segments.push(contentSegment(line, textLength + 1));
      textLength += text.length + 1;
      texts.push(text);
      last = line;
      this.#index++;
    }

    return {
      kind: "paragraph",
      text: texts.join("\n").trimEnd(),
      segments,
      span: this.#span(first, last),
    };
  }

  /** Lines are kept exactly as written; Markdown inside an HTML block is not parsed. */
  #parseHtmlBlock(type: HtmlBlockType): HtmlBlock {
    const first = this.#current();
    const endsAtBlankLine = type === 6 || type === 7;
    const texts: string[] = [];
    let last = first;
    let closed = endsAtBlankLine;

    while (this.#index < this.#lines.length) {
      const line = this.#current();
      if (line.lazy || (endsAtBlankLine && isBlank(line.text))) break;
      texts.push(line.text);
      last = line;
      this.#index++;
      if (type !== 6 && type !== 7 && endsHtmlBlock(type, line.text)) {
        closed = true;
        break;
      }
    }

    if (!closed) {
      this.#warn(
        DiagnosticCodes.unclosedHtmlBlock,
        first,
        "HTML block is never closed",
        `add ${HTML_BLOCK_END_NAMES[type] ?? "its closing marker"} where the block ends; until then, everything after it is raw HTML`,
      );
    }
    return { kind: "html-block", text: texts.join("\n"), span: this.#span(first, last) };
  }

  #parseTable(alignments: readonly TableAlignment[]): Table {
    const first = this.#current();
    const header = this.#parseTableRow(first, alignments.length);
    let last = this.#lineAt(this.#index + 1);
    this.#index += 2;

    const rows: TableRow[] = [];
    while (this.#index < this.#lines.length) {
      const line = this.#current();
      if (line.lazy || isBlank(line.text) || startsBlock(line.text)) break;
      rows.push(this.#parseTableRow(line, alignments.length));
      last = line;
      this.#index++;
    }
    return { kind: "table", alignments, header, rows, span: this.#span(first, last) };
  }

  #parseTableRow(line: SourceLine, columns: number): TableRow {
    const parsed = splitTableRow(line.text);
    const cells = Array.from({ length: columns }, (_, column): TableCell => {
      const cell = parsed[column];
      const start = cell === undefined ? line.end : line.start + cell.start;
      const end = cell === undefined ? line.end : line.start + cell.end;
      return {
        kind: "table-cell",
        text: cell?.text ?? "",
        segments: cellSegments(line, start, end),
        span: { file: this.#file, start: position(line, start), end: position(line, end) },
      };
    });
    return { kind: "table-row", cells, span: this.#span(line, line) };
  }

  /** The delimiter row after the line at `index`, if the two could start a table. */
  #delimiterAfter(
    index: number,
  ): { line: SourceLine; alignments: TableAlignment[]; headerCells: number } | undefined {
    const header = this.#lines[index];
    const line = this.#lines[index + 1];
    if (header === undefined || line === undefined || header.lazy || line.lazy) return undefined;
    if (leadingIndent(header.text).width >= INDENTED_CODE_WIDTH || interruptsParagraph(line.text)) {
      return undefined;
    }
    const alignments = matchDelimiterRow(line.text);
    if (alignments === undefined) return undefined;
    return { line, alignments, headerCells: splitTableRow(header.text).length };
  }

  /** A table starts here only if the header has exactly one cell per delimiter cell. */
  #tableAlignmentsAt(index: number): TableAlignment[] | undefined {
    const delimiter = this.#delimiterAfter(index);
    if (delimiter === undefined) return undefined;
    return delimiter.headerCells === delimiter.alignments.length ? delimiter.alignments : undefined;
  }

  #warnIfColumnsDiffer(index: number): void {
    const delimiter = this.#delimiterAfter(index);
    if (delimiter === undefined || delimiter.headerCells === delimiter.alignments.length) return;
    this.#warn(
      DiagnosticCodes.tableColumnMismatch,
      delimiter.line,
      `table header has ${delimiter.headerCells} columns but this row has ${delimiter.alignments.length}; this is read as text`,
      "give the header row and the row of dashes the same number of columns",
    );
  }

  #parseBlockQuote(): BlockQuote {
    const outer: SourceLine[] = [];
    const inner: SourceLine[] = [];

    while (this.#index < this.#lines.length) {
      const line = this.#current();
      const marker = matchBlockQuote(line.text);
      if (marker !== undefined) inner.push(sliceLine(line, marker));
      else if (isLazyCandidate(line, inner)) inner.push({ ...line, lazy: true });
      else break;
      outer.push(line);
      this.#index++;
    }

    const { children, last } = this.#parseContainer(outer, inner);
    return { kind: "block-quote", children, span: this.#span(this.#first(outer), last) };
  }

  #parseList(firstMarker: ListMarkerMatch): List {
    const first = this.#current();
    const items: ListItem[] = [];
    let marker = firstMarker;
    let tight = true;
    let last = first;

    while (true) {
      const parsed = this.#parseListItem(marker);
      items.push(parsed.item);
      last = parsed.last;
      if (hasBlankLineBetweenChildren(parsed.item)) tight = false;

      // The next item may follow after blank lines; those make the list loose.
      let next = this.#index;
      while (next < this.#lines.length && isBlank(this.#lineAt(next).text)) next++;
      if (next >= this.#lines.length) break;
      const nextLine = this.#lineAt(next);
      const nextMarker = isThematicBreak(nextLine.text)
        ? undefined
        : matchListMarker(nextLine.text);
      if (nextMarker === undefined || !isSameListType(nextMarker.type, marker.type)) break;

      if (next > this.#index) tight = false;
      this.#index = next;
      marker = nextMarker;
    }

    const span = this.#span(first, last);
    return firstMarker.type.kind === "ordered"
      ? { kind: "list", ordered: true, start: firstMarker.type.start, tight, items, span }
      : { kind: "list", ordered: false, tight, items, span };
  }

  /**
   * A list item owns the lines indented at least to its content column, blank lines
   * between them, and lazy continuation lines of an open paragraph.
   */
  #parseListItem(marker: ListMarkerMatch): { item: ListItem; last: SourceLine } {
    const first = this.#current();
    const outer: SourceLine[] = [first];
    const inner: SourceLine[] = [sliceLine(first, marker.contentStart)];
    this.#index++;

    // An item may start with at most one blank line: "-" followed by a blank is empty.
    const startsEmpty =
      marker.empty && (this.#index >= this.#lines.length || isBlank(this.#current().text));
    if (!startsEmpty) this.#collectIndentedLines(marker.contentColumn, outer, inner);

    const { children, last } = this.#parseContainer(outer, inner);
    return { item: { kind: "list-item", children, span: this.#span(first, last) }, last };
  }

  /** Appends continuation lines to `outer` (original) and `inner` (stripped). */
  #collectIndentedLines(contentColumn: number, outer: SourceLine[], inner: SourceLine[]): void {
    let blanks: SourceLine[] = [];
    while (this.#index < this.#lines.length) {
      const line = this.#current();
      if (isBlank(line.text)) {
        blanks.push(line);
      } else if (leadingIndent(line.text).width >= contentColumn) {
        outer.push(...blanks, line);
        inner.push(...blanks, stripColumns(line, contentColumn));
        blanks = [];
      } else if (blanks.length === 0 && isLazyCandidate(line, inner)) {
        outer.push(line);
        inner.push({ ...line, lazy: true });
      } else {
        break;
      }
      this.#index++;
    }
    // Trailing blank lines belong to whatever comes after the item.
    this.#index -= blanks.length;
  }

  /** Like a list item: the note continues on lines indented by four spaces. */
  #parseFootnoteDefinition(match: FootnoteDefinitionMatch): FootnoteDefinition {
    const first = this.#current();
    const outer: SourceLine[] = [first];
    const inner: SourceLine[] = [sliceLine(first, match.contentStart)];
    this.#index++;
    this.#collectIndentedLines(FOOTNOTE_CONTENT_COLUMN, outer, inner);

    const { children, last } = this.#parseContainer(outer, inner);
    return {
      kind: "footnote-definition",
      label: match.label,
      children,
      span: this.#span(first, last),
    };
  }

  /**
   * Parses a container's content. `outer[i]` is the original line for `inner[i]`. If the
   * nested parser stops early at a lazy line, the container ends before it and the
   * cursor moves back so that line is parsed again out here.
   */
  #parseContainer(
    outer: readonly SourceLine[],
    inner: readonly SourceLine[],
  ): { children: Block[]; last: SourceLine } {
    const { blocks, diagnostics, consumed } = parseLines(inner, this.#file, this.#depth + 1);
    this.#diagnostics.push(...diagnostics);
    this.#index -= inner.length - consumed;
    const last = outer[consumed - 1] ?? this.#first(outer);
    return { children: [...blocks], last };
  }

  #first(lines: readonly SourceLine[]): SourceLine {
    const first = lines[0];
    if (first === undefined) throw new InternalError("container without lines");
    return first;
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
    return this.#lineAt(this.#index);
  }

  #lineAt(index: number): SourceLine {
    const line = this.#lines[index];
    if (line === undefined) throw new InternalError(`no line at index ${index}`);
    return line;
  }

  /** From the start of `first` to the end of `last`. Positions are computed from the lines directly. */
  #span(first: SourceLine, last: SourceLine): SourceSpan {
    return { file: this.#file, start: position(first, first.start), end: position(last, last.end) };
  }
}

/** Lines that end a paragraph even without a blank line before them. */
function interruptsParagraph(text: string): boolean {
  if (
    matchFenceOpen(text) !== undefined ||
    matchAtxHeading(text) !== undefined ||
    isThematicBreak(text) ||
    matchBlockQuote(text) !== undefined ||
    matchFootnoteDefinition(text) !== undefined
  ) {
    return true;
  }
  // A lone tag such as `<span>` (type 7) can be part of a sentence, so it does not interrupt.
  const htmlType = matchHtmlBlockStart(text);
  if (htmlType !== undefined && htmlType !== 7) return true;

  // So that "in 2024. we..." wrapped onto a new line doesn't become a list:
  // only bullets and lists starting at 1 may interrupt, and never an empty item.
  const marker = matchListMarker(text);
  return (
    marker !== undefined &&
    !marker.empty &&
    (marker.type.kind === "bullet" || marker.type.start === 1)
  );
}

/**
 * A line that might continue a paragraph inside a container without the container's
 * marker or indentation. Cheap check only; the nested parser makes the final decision.
 */
function isLazyCandidate(line: SourceLine, inner: readonly SourceLine[]): boolean {
  const previous = inner.at(-1);
  return (
    previous !== undefined &&
    !isBlank(previous.text) &&
    !isBlank(line.text) &&
    !startsBlock(line.text)
  );
}

/** Any block start at all, including list items that could not interrupt a paragraph. */
function startsBlock(text: string): boolean {
  return interruptsParagraph(text) || matchListMarker(text) !== undefined;
}

/** A list is loose if any item has a blank line between two of its blocks. */
function hasBlankLineBetweenChildren(item: ListItem): boolean {
  return item.children.some((child, childIndex) => {
    const previous = item.children[childIndex - 1];
    return previous !== undefined && child.span.start.line > previous.span.end.line + 1;
  });
}

function contentSegment(line: SourceLine, index: number): TextSegment {
  return { index, position: position(line, line.start + leadingIndent(line.text).length) };
}

/** An escaped pipe loses its backslash in the cell text, so positions shift after each one. */
function cellSegments(line: SourceLine, start: number, end: number): TextSegment[] {
  const segments: TextSegment[] = [{ index: 0, position: position(line, start) }];
  const raw = line.text.slice(start - line.start, end - line.start);
  let removed = 0;
  for (const match of raw.matchAll(/\\\|/g)) {
    removed++;
    segments.push({
      index: match.index + 1 - removed,
      position: position(line, start + match.index + 1),
    });
  }
  return segments;
}

function position(line: SourceLine, offset: number): SourcePosition {
  return { line: line.number, column: offset - line.lineStart + 1, offset };
}

function withoutIndent(text: string): string {
  return text.slice(leadingIndent(text).length);
}

/** Removes up to `count` leading spaces (used for content inside an indented fence). */
function removeSpaces(text: string, count: number): string {
  let removed = 0;
  while (removed < count && text[removed] === " ") removed++;
  return text.slice(removed);
}
