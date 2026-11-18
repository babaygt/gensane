import type { DiagnosticCode } from "../diagnostics/index.ts";

/**
 * Codes for problems found in Markdown. Codes are stable so users can search for
 * them; Markdown uses the GS1xx range.
 */
export const DiagnosticCodes = {
  unclosedCodeFence: "GS101",
  setextHeading: "GS102",
  indentedCode: "GS103",
  tableColumnMismatch: "GS104",
  nestingTooDeep: "GS105",
  unclosedHtmlBlock: "GS106",
} as const satisfies Record<string, DiagnosticCode>;
