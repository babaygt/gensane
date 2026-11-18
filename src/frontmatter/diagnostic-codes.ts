import type { DiagnosticCode } from "../diagnostics/index.ts";

/** Codes for problems found in frontmatter. Frontmatter uses the GS2xx range. */
export const FrontmatterCodes = {
  unclosedFrontmatter: "GS201",
  tabIndentation: "GS202",
  invalidEntry: "GS203",
  duplicateKey: "GS204",
  unterminatedString: "GS205",
  invalidEscape: "GS206",
  unterminatedList: "GS207",
  unexpectedIndentation: "GS208",
  unsupportedSyntax: "GS209",
  invalidDate: "GS210",
  nestingTooDeep: "GS211",
  valueNeedsQuotes: "GS212",
  textAfterValue: "GS213",
} as const satisfies Record<string, DiagnosticCode>;
