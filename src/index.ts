// Public API of the `gensane` package. Grows as modules land.
export type {
  Diagnostic,
  DiagnosticCode,
  Severity,
  SourcePosition,
  SourceSpan,
} from "./diagnostics/index.ts";
export {
  type Author,
  type GensaneConfig,
  type SiteSettings,
  defineConfig,
} from "./config/index.ts";
