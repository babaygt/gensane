/** The steps every command that builds shares: load the config, read the site folder, and build. */
import { type BuiltSite, type SiteConfig, buildSite } from "../core/index.ts";
import type { Diagnostic } from "../diagnostics/index.ts";
import { type LoadedConfig, loadConfig } from "./config-file.ts";
import type { Environment } from "./environment.ts";
import { count } from "./report.ts";
import { type SiteFiles, readSiteFolder } from "./site-folder.ts";

export type FolderBuild =
  | {
      /** The config has errors, so the site folder wasn't read. */
      readonly kind: "config-failed";
      readonly problems: readonly Diagnostic[];
    }
  | {
      readonly kind: "failed";
      readonly files: SiteFiles;
      readonly problems: readonly Diagnostic[];
    }
  | {
      readonly kind: "built";
      readonly files: SiteFiles;
      readonly site: BuiltSite;
      /** Only warnings. */
      readonly problems: readonly Diagnostic[];
    };

interface BuildOptions {
  readonly drafts: boolean;
  /** `gensane dev` serves the site at `/`, so it leaves links as they are written. */
  readonly servedAtRoot?: boolean;
}

function siteConfigOf(
  { config, file }: LoadedConfig,
  { drafts, servedAtRoot }: BuildOptions,
): SiteConfig {
  const { site, perPage, markdown, filters } = config;
  return {
    drafts,
    servedAtRoot: servedAtRoot ?? false,
    configFile: file ?? "gensane.config.ts",
    ...(site === undefined ? {} : { site }),
    ...(perPage === undefined ? {} : { perPage }),
    ...(markdown === undefined ? {} : { markdown }),
    ...(filters === undefined ? {} : { filters }),
  };
}

export async function buildFolder(
  { fileSystem, moduleLoader, siteFolder, defaultTheme }: Environment,
  options: BuildOptions,
): Promise<FolderBuild> {
  const loaded = await loadConfig(fileSystem, moduleLoader, siteFolder);
  if (!loaded.ok) return { kind: "config-failed", problems: loaded.error };
  const files = await readSiteFolder(fileSystem, siteFolder, defaultTheme);
  const built = buildSite({
    config: siteConfigOf(loaded.value, options),
    content: files.content,
    templates: files.templates,
    publicFiles: files.publicFiles,
    themeAssets: files.themeAssets.map(({ path }) => path),
  });
  const problems = [...loaded.value.warnings, ...(built.ok ? built.value.warnings : built.error)];
  return built.ok
    ? { kind: "built", files, site: built.value, problems }
    : { kind: "failed", files, problems };
}

/** `1 error and 2 warnings`. */
export function countProblems(problems: readonly Diagnostic[]): string {
  const errors = problems.filter(({ severity }) => severity === "error").length;
  return `${count(errors, "error")} and ${count(problems.length - errors, "warning")}`;
}

/** `no warnings`, `1 warning`. */
export function countWarnings(warnings: readonly Diagnostic[]): string {
  return warnings.length === 0 ? "no warnings" : count(warnings.length, "warning");
}

/** The pages of a built site, which is what people count, not the feed or the copied files. */
export function pagesOf(site: BuiltSite): number {
  return site.files.filter(({ path }) => path.endsWith(".html")).length;
}
