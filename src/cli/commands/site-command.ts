import { type BuiltSite, type SiteConfig, buildSite } from "../../core/index.ts";
import type { Diagnostic } from "../../diagnostics/index.ts";
import { type LoadedConfig, loadConfig } from "../config-file.ts";
import { type Environment, ExitCode } from "../environment.ts";
import { count, printProblems, printUsageError } from "../report.ts";
import { type SiteFiles, readSiteFolder } from "../site-folder.ts";
import { Command, type OptionSpec, type OptionValues } from "./command.ts";

export const DRAFTS_OPTION: OptionSpec = { type: "boolean", description: "Include drafts" };

function siteConfigOf({ config, file }: LoadedConfig, drafts: boolean): SiteConfig {
  const { site, perPage, markdown, filters } = config;
  return {
    drafts,
    configFile: file ?? "gensane.config.ts",
    ...(site === undefined ? {} : { site }),
    ...(perPage === undefined ? {} : { perPage }),
    ...(markdown === undefined ? {} : { markdown }),
    ...(filters === undefined ? {} : { filters }),
  };
}

function countProblems(problems: readonly Diagnostic[]): string {
  const errors = problems.filter(({ severity }) => severity === "error").length;
  return `${count(errors, "error")} and ${count(problems.length - errors, "warning")}`;
}

/**
 * A command that builds the whole site: it loads the config, reads the site folder, builds, and prints
 * every problem. Each command only says what happens before and after.
 */
export abstract class SiteCommand extends Command {
  /** Said after the problems when the site has errors, such as ", so nothing was written". */
  protected abstract readonly whenStopped: string;

  /** A mistake in the arguments, found before any work, if there is one. */
  protected checkArguments(_values: OptionValues, _environment: Environment): string | undefined {
    return undefined;
  }

  /** Uses a site that built without errors, and says what was done, such as "Built 12 pages". */
  protected abstract finish(
    site: BuiltSite,
    files: SiteFiles,
    values: OptionValues,
    environment: Environment,
  ): Promise<string>;

  async run(values: OptionValues, environment: Environment): Promise<number> {
    const { fileSystem, moduleLoader, clock, terminal, siteFolder } = environment;
    const started = clock.now().getTime();
    const mistake = this.checkArguments(values, environment);
    if (mistake !== undefined) {
      printUsageError(terminal, mistake, `see gensane ${this.name} --help`);
      return ExitCode.usage;
    }

    const loaded = await loadConfig(fileSystem, moduleLoader, siteFolder);
    if (!loaded.ok) {
      printProblems(loaded.error, undefined, terminal);
      terminal.write(`Found ${countProblems(loaded.error)} in the config${this.whenStopped}.`);
      return ExitCode.problems;
    }
    const files = await readSiteFolder(fileSystem, siteFolder);
    const built = buildSite({
      config: siteConfigOf(loaded.value, values["drafts"] === true),
      content: files.content,
      templates: files.templates,
      publicFiles: files.publicFiles,
    });
    const problems = [...loaded.value.warnings, ...(built.ok ? built.value.warnings : built.error)];
    printProblems(problems, files, terminal);
    if (!built.ok) {
      terminal.write(`Found ${countProblems(problems)}${this.whenStopped}.`);
      return ExitCode.problems;
    }

    const done = await this.finish(built.value, files, values, environment);
    const time = clock.now().getTime() - started;
    const warnings = problems.length === 0 ? "no warnings" : count(problems.length, "warning");
    terminal.write(`${done} in ${time} ms, with ${warnings}.`);
    return ExitCode.success;
  }
}

/** The pages of a built site, which is what people count, not the feed or the copied files. */
export function pagesOf(site: BuiltSite): number {
  return site.files.filter(({ path }) => path.endsWith(".html")).length;
}
