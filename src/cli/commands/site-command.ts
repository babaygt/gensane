import type { BuiltSite } from "../../core/index.ts";
import { buildFolder, countProblems, countWarnings } from "../build-folder.ts";
import { type Environment, ExitCode } from "../environment.ts";
import { printProblems, printUsageError } from "../report.ts";
import type { SiteFiles } from "../site-folder.ts";
import { Command, type OptionSpec, type OptionValues } from "./command.ts";
import { localDay } from "../local-day.ts";

export const DRAFTS_OPTION: OptionSpec = { type: "boolean", description: "Include drafts" };

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
    const { clock, terminal } = environment;
    const start = clock.now();
    const started = start.getTime();
    const mistake = this.checkArguments(values, environment);
    if (mistake !== undefined) {
      printUsageError(terminal, mistake, `see gensane ${this.name} --help`);
      return ExitCode.usage;
    }

    const build = await buildFolder(environment, {
      drafts: values["drafts"] === true,
      today: localDay(start),
    });
    if (build.kind === "config-failed") {
      printProblems(build.problems, undefined, terminal);
      terminal.write(`Found ${countProblems(build.problems)} in the config${this.whenStopped}.`);
      return ExitCode.problems;
    }
    printProblems(build.problems, build.files, terminal);
    if (build.kind === "failed") {
      terminal.write(`Found ${countProblems(build.problems)}${this.whenStopped}.`);
      return ExitCode.problems;
    }

    const done = await this.finish(build.site, build.files, values, environment);
    const time = clock.now().getTime() - started;
    terminal.write(`${done} in ${time} ms, with ${countWarnings(build.problems)}.`);
    return ExitCode.success;
  }
}
