import type { DiagnosticCode } from "../diagnostics/index.ts";

/** Codes for problems found in templates. Templates use the GS3xx range. */
export const TemplateCodes = {
  unclosedDelimiter: "GS301",
  unclosedComment: "GS302",
  unterminatedString: "GS303",
  invalidEscape: "GS304",
  unexpectedCharacter: "GS305",
  expectedValue: "GS310",
  unexpectedToken: "GS311",
  unknownTag: "GS312",
  nestingTooDeep: "GS313",
  expressionTooLong: "GS314",
  chainedComparison: "GS315",
  unknownFilter: "GS320",
  wrongArgumentCount: "GS321",
  unknownVariable: "GS330",
  missingField: "GS331",
  wrongOperand: "GS332",
  divisionByZero: "GS333",
  filterFailed: "GS334",
  notPrintable: "GS335",
  invalidIndex: "GS336",
} as const satisfies Record<string, DiagnosticCode>;
