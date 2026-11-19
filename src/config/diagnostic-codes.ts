import type { DiagnosticCode } from "../diagnostics/index.ts";

/** Codes for problems with the config file. The config uses the GS5xx range. */
export const ConfigCodes = {
  twoConfigFiles: "GS501",
  notLoaded: "GS502",
  noSettings: "GS503",
  unknownSetting: "GS504",
  wrongValue: "GS505",
  misspelledSiteSetting: "GS506",
} as const satisfies Record<string, DiagnosticCode>;
