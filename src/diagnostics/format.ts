/**
 * Turns a problem into the text a person reads in the terminal: the problem, where it is, its line of
 * source with a mark under it, and the hint.
 */
import type { Diagnostic } from "./diagnostic.ts";

export interface FormatOptions {
  /** Colors only help in a terminal; in a log file they are noise. */
  readonly color: boolean;
}

const RESET = "\u001B[0m";
const BOLD = "\u001B[1m";
const BLUE = "\u001B[34m";
const SEVERITY_COLORS = { error: "\u001B[1;31m", warning: "\u001B[1;33m" } as const;

/** The same line breaks as positions use: `\n`, `\r\n` or a lone `\r`. */
const LINE_BREAK = /\r\n|\r|\n/;

/** The characters before the mark, as spaces, but tabs stay tabs so the mark lines up. */
function blankedOut(text: string): string {
  return text.replaceAll(/[^\t]/g, " ");
}

export function formatDiagnostic(
  diagnostic: Diagnostic,
  source: string | undefined,
  { color }: FormatOptions,
): string {
  const paint = (code: string, text: string) => (color ? `${code}${text}${RESET}` : text);
  const { severity, code, message, span, hint } = diagnostic;
  const { start, end } = span;

  const sourceLine = source?.split(LINE_BREAK)[start.line - 1];
  const frame = sourceLine !== undefined;
  const number = String(start.line);
  const gutter = " ".repeat(frame ? number.length + 1 : 2);
  const bar = paint(BLUE, "│");

  const lines = [
    `${paint(SEVERITY_COLORS[severity], `${severity}[${code}]`)}${paint(BOLD, `: ${message}`)}`,
    `${gutter}${paint(BLUE, "┌─")} ${span.file}${frame || source !== undefined ? `:${start.line}:${start.column}` : ""}`,
  ];
  if (frame) {
    const width =
      end.line === start.line ? end.column - start.column : sourceLine.length - start.column + 1;
    const mark = "^".repeat(Math.max(1, width));
    lines.push(
      `${gutter}${bar}`,
      `${paint(BLUE, number)} ${bar} ${sourceLine}`,
      `${gutter}${bar} ${blankedOut(sourceLine.slice(0, start.column - 1))}${paint(SEVERITY_COLORS[severity], mark)}`,
    );
  }
  if (hint !== undefined) {
    lines.push(`${gutter}${bar}`, `${gutter}${paint(BLUE, "=")} hint: ${hint}`);
  }
  return lines.map((line) => line.trimEnd()).join("\n");
}
