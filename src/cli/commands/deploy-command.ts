import { basename, join } from "node:path";
import { closestMatch } from "../../diagnostics/index.ts";
import { type Environment, ExitCode } from "../environment.ts";
import { DEPLOY_TARGETS, deployFiles, isDeployTarget, publishSteps } from "../init/deploy-files.ts";
import { siteNameOf } from "../init/starter-site.ts";
import { printUsageError } from "../report.ts";
import { Command, type OptionValues } from "./command.ts";

const USE = `use: gensane deploy init <${DEPLOY_TARGETS.join("|")}>`;

/**
 * `gensane deploy init <host>` adds the files that publish the site on a host, as `gensane init`
 * does for a new site. It never replaces a file, because one already there is the site's own.
 */
export class DeployCommand extends Command {
  readonly name = "deploy";
  readonly summary = "Add the files that publish the site on a host";
  override readonly takes = `init <${DEPLOY_TARGETS.join("|")}>`;
  override readonly details =
    "It only writes the files; the site is published by the host. A file that is already there is left as it is.";
  readonly options = {};

  async run(
    _values: OptionValues,
    { fileSystem, terminal, siteFolder }: Environment,
    positionals: readonly string[],
  ): Promise<number> {
    const [action, host = "", ...rest] = positionals;
    if (action !== "init" || rest.length > 0) {
      const written = positionals.join(" ");
      printUsageError(
        terminal,
        written === ""
          ? "gensane deploy needs init and a host after it"
          : `"${written}" is not something gensane deploy does`,
        USE,
      );
      return ExitCode.usage;
    }
    if (!isDeployTarget(host)) {
      const close = host === "" ? undefined : closestMatch(host, [...DEPLOY_TARGETS]);
      printUsageError(
        terminal,
        host === ""
          ? "gensane deploy init needs a host"
          : `gensane deploy can't publish on "${host}"`,
        close === undefined
          ? `choose from ${DEPLOY_TARGETS.join(", ")}`
          : `did you mean "${close}"?`,
      );
      return ExitCode.usage;
    }

    const files = deployFiles(host, siteNameOf(basename(siteFolder)));
    for (const path of Object.keys(files)) {
      if (await fileSystem.isFile(join(siteFolder, path))) {
        printUsageError(
          terminal,
          `${path} is already there, so it was left as it is`,
          "remove it first to start again from the template",
        );
        return ExitCode.problems;
      }
    }
    for (const [path, content] of Object.entries(files)) {
      await fileSystem.writeText(join(siteFolder, path), content);
      terminal.write(`Created ${path}`);
    }
    terminal.write("");
    terminal.write("To publish:");
    for (const step of publishSteps(host)) terminal.write(`  ${step}`);
    return ExitCode.success;
  }
}
