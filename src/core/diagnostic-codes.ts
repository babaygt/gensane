import type { DiagnosticCode } from "../diagnostics/index.ts";

/** Codes for problems found while building a site. The core uses the GS4xx range. */
export const CoreCodes = {
  unknownFolder: "GS401",
  notMarkdown: "GS402",
  invalidSlug: "GS403",
  noSlug: "GS404",
  duplicateUrl: "GS405",
  dateMismatch: "GS406",
  reservedUrl: "GS407",
  tagWithoutUrl: "GS408",
  tagSpelling: "GS409",
  missingTemplate: "GS410",
  noSiteUrl: "GS411",
  invalidSiteUrl: "GS412",
  brokenLink: "GS413",
  missingAnchor: "GS414",
  publicFileClash: "GS415",
  themeFileClash: "GS416",
  hiddenField: "GS417",
} as const satisfies Record<string, DiagnosticCode>;
