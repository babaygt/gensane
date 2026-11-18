/**
 * Stage 1 of the compiler: split the source into lines.
 *
 * Markdown's block structure is decided line by line, so instead of producing a
 * stream of tokens like a typical lexer, this stage produces a list of lines that
 * remember exactly where they came from in the original text.
 */

/** One line of source text, without its line ending. */
export interface SourceLine {
  readonly text: string;
  /** Offset of the first character of the line in the source. */
  readonly start: number;
  /** Offset just past the last character (the line ending is not included). */
  readonly end: number;
  /** 1-based line number. */
  readonly number: number;
  /**
   * Offset where the physical line begins. Differs from `start` once container
   * markers such as `> ` have been stripped; columns are counted from here.
   */
  readonly lineStart: number;
  /**
   * Set by a container (block quote, list item) on a line that may continue a
   * paragraph inside it without repeating the container's marker or indentation.
   * The nested parser accepts it only as paragraph text, and otherwise stops there.
   */
  readonly lazy?: boolean;
}

/** Splits on `\n`, `\r\n` or `\r`. A trailing line ending does not start a new line. */
export function splitLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === "\n" || character === "\r") {
      lines.push({
        text: source.slice(start, index),
        start,
        end: index,
        number: lines.length + 1,
        lineStart: start,
      });
      index += character === "\r" && source[index + 1] === "\n" ? 2 : 1;
      start = index;
    } else {
      index++;
    }
  }
  if (start < source.length) {
    lines.push({
      text: source.slice(start),
      start,
      end: source.length,
      number: lines.length + 1,
      lineStart: start,
    });
  }
  return lines;
}

const TAB_STOP = 4;

export interface Indent {
  /** Visual width of the leading whitespace, with tabs expanded to the next multiple of 4. */
  readonly width: number;
  /** Number of whitespace characters at the start of the line. */
  readonly length: number;
}

/** Measures leading spaces and tabs. Markdown rules care about the visual width. */
export function leadingIndent(text: string): Indent {
  let width = 0;
  let length = 0;
  for (const character of text) {
    if (character === " ") width += 1;
    else if (character === "\t") width += TAB_STOP - (width % TAB_STOP);
    else break;
    length++;
  }
  return { width, length };
}

export function isBlank(text: string): boolean {
  return leadingIndent(text).length === text.length;
}

/** Drops the first `count` characters, keeping offsets pointing into the original source. */
export function sliceLine(line: SourceLine, count: number): SourceLine {
  return { ...line, text: line.text.slice(count), start: line.start + count };
}

/** Removes leading whitespace up to `columns` wide (used for content inside list items). */
export function stripColumns(line: SourceLine, columns: number): SourceLine {
  let width = 0;
  let index = 0;
  for (const character of line.text) {
    if (width >= columns) break;
    if (character === " ") width += 1;
    else if (character === "\t") width += TAB_STOP - (width % TAB_STOP);
    else break;
    index++;
  }
  return sliceLine(line, index);
}
