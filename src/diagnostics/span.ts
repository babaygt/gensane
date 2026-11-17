/** A point in a source file. `line` and `column` are 1-based; `offset` is a 0-based UTF-16 index. */
export interface SourcePosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

/** A half-open range `[start, end)` in a source file. */
export interface SourceSpan {
  readonly file: string;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

/**
 * Converts a 0-based offset into a position, counting `\n` as the line break.
 * Offsets past the end of the text are clamped to the end.
 */
export function positionAt(text: string, offset: number): SourcePosition {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: clamped - lineStart + 1, offset: clamped };
}

/** Builds a span from two offsets into `text`. */
export function spanOf(
  file: string,
  text: string,
  startOffset: number,
  endOffset: number,
): SourceSpan {
  return { file, start: positionAt(text, startOffset), end: positionAt(text, endOffset) };
}
