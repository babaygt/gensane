/** The config of a site: its settings, and the check that they are right. */
export { ConfigCodes } from "./diagnostic-codes.ts";
export { type Author, type GensaneConfig, type SiteSettings, defineConfig } from "./config.ts";
export { type CheckedConfig, checkConfig, configProblem } from "./check-config.ts";
