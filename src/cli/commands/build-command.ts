import { join, relative } from "node:path";
import type { BuiltSite } from "../../core/index.ts";
import { InternalError } from "../../diagnostics/index.ts";
import type { Environment } from "../environment.ts";
import { count } from "../report.ts";
import { type SiteFiles, outputFolderProblem, writeSite } from "../site-folder.ts";
import type { OptionValues } from "./command.ts";
import { pagesOf } from "../build-folder.ts";
import { DRAFTS_OPTION, SiteCommand } from "./site-command.ts";

const DEFAULT_OUTPUT = "dist";

function outputFolderOf(values: OptionValues, { siteFolder }: Environment): string {
  const out = values["out"];
  return join(siteFolder, typeof out === "string" ? out : DEFAULT_OUTPUT);
}

export class BuildCommand extends SiteCommand {
  readonly name = "build";
  readonly summary = "Build the site into dist/";
  readonly options = {
    drafts: DRAFTS_OPTION,
    out: {
      type: "string",
      valueName: "folder",
      description: "Write the site into this folder instead of dist/",
    },
  } as const;
  protected readonly whenStopped = ", so nothing was written";

  protected override checkArguments(
    values: OptionValues,
    environment: Environment,
  ): string | undefined {
    return outputFolderProblem(environment.siteFolder, outputFolderOf(values, environment));
  }

  protected async finish(
    site: BuiltSite,
    files: SiteFiles,
    values: OptionValues,
    environment: Environment,
  ): Promise<string> {
    const outputFolder = outputFolderOf(values, environment);
    const written = await writeSite(environment.fileSystem, {
      siteFolder: environment.siteFolder,
      outputFolder,
      files: site.files,
      publicFiles: files.publicFiles,
    });
    if (!written.ok)
      throw new InternalError(`the output folder was checked before: ${written.error}`);
    const shown = relative(environment.siteFolder, outputFolder);
    return `Built ${count(pagesOf(site), "page")} into ${shown}`;
  }
}
