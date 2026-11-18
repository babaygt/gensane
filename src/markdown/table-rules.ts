/**
 * Recognisers for GitHub-style tables, which CommonMark itself does not define:
 *
 *   | Name | Age |    header row
 *   | :--- | --: |    delimiter row (colons set the column alignment)
 *   | Ada  |  36 |    body rows
 */
import { leadingIndent } from "./lines.ts";

export type TableAlignment = "none" | "left" | "center" | "right";

export interface RowCell {
  /** Trimmed content, with `\|` turned into `|`. */
  readonly text: string;
  /** Range of the content within the line. */
  readonly start: number;
  readonly end: number;
}

/** Splits a row on unescaped pipes. Leading and trailing pipes are optional. */
export function splitTableRow(text: string): RowCell[] {
  let i = leadingIndent(text).length;
  if (text[i] === "|") i++;

  const ranges: (readonly [number, number])[] = [];
  let cellStart = i;
  while (i < text.length) {
    if (text[i] === "\\") {
      // Skip the escaped character, so `\|` does not separate cells.
      i += 2;
    } else if (text[i] === "|") {
      ranges.push([cellStart, i]);
      i++;
      cellStart = i;
    } else {
      i++;
    }
  }
  // Text after the last pipe is a cell; only whitespace there means a trailing pipe.
  if (ranges.length === 0 || text.slice(cellStart).trim() !== "") {
    ranges.push([cellStart, text.length]);
  }
  return ranges.map(([start, end]) => toCell(text, start, end));
}

function toCell(text: string, rangeStart: number, rangeEnd: number): RowCell {
  const raw = text.slice(rangeStart, rangeEnd);
  const start = rangeStart + (raw.length - raw.trimStart().length);
  const end = Math.max(start, rangeEnd - (raw.length - raw.trimEnd().length));
  const content = text.slice(start, end).replace(/\\\|/g, "|");
  return { text: content, start, end };
}

// Dashes with optional colons: `:--` left, `:-:` center, `--:` right.
const DELIMITER_CELL = /^(:?)-+(:?)$/;

/**
 * The column alignments if this line is a delimiter row. A pipe is required, so that
 * `---` under a line of text stays a horizontal rule.
 */
export function matchDelimiterRow(text: string): TableAlignment[] | undefined {
  if (!text.includes("|") || leadingIndent(text).width > 3) return undefined;
  const alignments: TableAlignment[] = [];
  for (const cell of splitTableRow(text)) {
    const match = DELIMITER_CELL.exec(cell.text);
    if (match === null) return undefined;
    alignments.push(alignmentOf(match[1] === ":", match[2] === ":"));
  }
  return alignments;
}

function alignmentOf(left: boolean, right: boolean): TableAlignment {
  if (left && right) return "center";
  if (left) return "left";
  return right ? "right" : "none";
}
