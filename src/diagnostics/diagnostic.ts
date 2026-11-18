import type { SourceSpan } from "./span.ts";

export type Severity = "error" | "warning";

/** Stable, documented error code such as `GS012`. */
export type DiagnosticCode = `GS${number}`;

/** A problem in user input, reported with its exact source location. */
export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: Severity;
  readonly message: string;
  readonly span: SourceSpan;
  readonly hint?: string;
}

/** Thrown for states that should be impossible. Signals a bug in gensane, never a user mistake. */
export class InternalError extends Error {
  override readonly name = "InternalError";
}

/** Exhaustiveness check for discriminated unions: the call only type-checks if every case was handled. */
export function assertNever(value: never): never {
  throw new InternalError(`Unhandled case: ${JSON.stringify(value)}`);
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
