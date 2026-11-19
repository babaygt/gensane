import type { SourcePosition } from "../../diagnostics/index.ts";

/**
 * Returns a function that turns an offset into a position. Looking lines up in a table keeps
 * this fast for templates with very many tokens. A line ends at `\n`, `\r\n` or a lone `\r`.
 */
export function createPositionFinder(source: string): (offset: number) => SourcePosition {
  const lineStarts = [0, ...[...source.matchAll(/\r\n|\n|\r/g)].map((m) => m.index + m[0].length)];

  return (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((lineStarts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1, offset };
  };
}
