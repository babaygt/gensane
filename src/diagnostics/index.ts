export type { SourcePosition, SourceSpan } from "./span.ts";
export { positionAt, spanOf } from "./span.ts";
export type { Result, Ok, Err } from "./result.ts";
export { ok, err } from "./result.ts";
export type { Diagnostic, DiagnosticCode, Severity } from "./diagnostic.ts";
export { InternalError, assertNever, hasErrors } from "./diagnostic.ts";
export { closestMatch, editDistance } from "./closest-match.ts";
export type { FormatOptions } from "./format.ts";
export { formatDiagnostic } from "./format.ts";
