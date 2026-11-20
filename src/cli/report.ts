/** Prints problems with their source, and counts things for the line at the end. */
import { type Diagnostic, formatDiagnostic } from "../diagnostics/index.ts";
import type { Terminal } from "../ports/index.ts";
import type { SiteFiles } from "./site-folder.ts";

const CONTENT = "content/";

/** `1 error`, `2 errors`. */
export function count(amount: number, word: string): string {
  return `${amount} ${word}${amount === 1 ? "" : "s"}`;
}

/**
 * Problems in templates name the template, as `include` does; in the terminal they name its file,
 * in `theme/` or in the default theme, so it can be opened from there.
 */
export function located(diagnostic: Diagnostic, files: SiteFiles | undefined) {
  const { file } = diagnostic.span;
  const template = files?.templates[file];
  const shown = files?.templateFiles[file];
  if (template !== undefined && shown !== undefined) {
    return {
      diagnostic: { ...diagnostic, span: { ...diagnostic.span, file: shown } },
      source: template,
    };
  }
  const content = file.startsWith(CONTENT) ? files?.content[file.slice(CONTENT.length)] : undefined;
  return { diagnostic, source: content };
}

export function printProblems(
  problems: readonly Diagnostic[],
  files: SiteFiles | undefined,
  terminal: Terminal,
): void {
  for (const problem of problems) {
    const { diagnostic, source } = located(problem, files);
    terminal.writeError(`${formatDiagnostic(diagnostic, source, { color: terminal.color })}\n`);
  }
}

export function printUsageError(terminal: Terminal, message: string, hint: string): void {
  terminal.writeError(`error: ${message}\nhint: ${hint}`);
}
