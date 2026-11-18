import type { SourcePosition } from "../../diagnostics/index.ts";

/** One line of the file, without its line ending. */
export interface SourceLine {
  readonly text: string;
  /** Offset of the line's first character in the file. */
  readonly start: number;
  /** Offset where the next line starts. */
  readonly nextStart: number;
  /** 1-based line number. */
  readonly number: number;
}

/** Splits on `\n`, `\r\n` or `\r`. */
export function splitSourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const lineEnding = /\r\n|\n|\r/g;
  let start = 0;
  for (const match of source.matchAll(lineEnding)) {
    const nextStart = match.index + match[0].length;
    const text = source.slice(start, match.index);
    lines.push({ text, start, nextStart, number: lines.length + 1 });
    start = nextStart;
  }
  if (start < source.length) {
    const text = source.slice(start);
    lines.push({ text, start, nextStart: source.length, number: lines.length + 1 });
  }
  return lines;
}

export function positionInLine(line: SourceLine, offset: number): SourcePosition {
  return { line: line.number, column: offset - line.start + 1, offset };
}
