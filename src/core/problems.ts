import type {
  Diagnostic,
  DiagnosticCode,
  SourcePosition,
  SourceSpan,
} from "../diagnostics/index.ts";

export function startOf(file: string): SourceSpan {
  const start: SourcePosition = { line: 1, column: 1, offset: 0 };
  return { file, start, end: start };
}

export function problem(
  code: DiagnosticCode,
  message: string,
  span: SourceSpan,
  hint: string,
  severity: Diagnostic["severity"] = "error",
): Diagnostic {
  return { code, severity, message, span, hint };
}

/** Files in alphabetical order, and the problems of each file in the order they appear. */
export function inFileOrder(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.toSorted(({ span: first }, { span: second }) => {
    if (first.file !== second.file) return first.file < second.file ? -1 : 1;
    return first.start.offset - second.start.offset;
  });
}
