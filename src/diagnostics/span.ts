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
 * Converts a 0-based offset into a position. Line breaks are `\n`, `\r\n` or a lone
 * `\r`, the same rule the Markdown parser uses to split lines.
 * Offsets past the end of the text are clamped to the end.
 */
export function positionAt(text: string, offset: number): SourcePosition {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < clamped; index++) {
    const character = text[index];
    // In `\r\n` only the `\n` counts, so the pair is one line break.
    const isBreak = character === "\n" || (character === "\r" && text[index + 1] !== "\n");
    if (isBreak) {
      line++;
      lineStart = index + 1;
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
