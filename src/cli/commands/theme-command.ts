import { join } from "node:path";
import { closestMatch } from "../../diagnostics/index.ts";
import { type Environment, ExitCode } from "../environment.ts";
import { count, printUsageError } from "../report.ts";
import { Command, type OptionValues } from "./command.ts";

const THEME = "theme";

/**
 * `gensane theme eject` copies every file of the default theme into `theme/`, so all of it can be
 * changed. It never replaces a file, because one already in `theme/` is the site's own.
 */
export class ThemeCommand extends Command {
  readonly name = "theme";
  readonly summary = "Copy the default theme into theme/, to change all of it";
  override readonly takes = "eject";
  override readonly details =
    "Files already in theme/ are kept as they are. After this, updating gensane doesn't change the copied files.";
  readonly options = {};

  async run(
    _values: OptionValues,
    { fileSystem, terminal, siteFolder, defaultTheme }: Environment,
    positionals: readonly string[],
  ): Promise<number> {
    const [action, ...rest] = positionals;
    if (action !== "eject" || rest.length > 0) {
      const written = positionals.join(" ");
      const mistake =
        written === ""
          ? "gensane theme needs eject after it"
          : `"${written}" is not something gensane theme does`;
      const close =
        action !== undefined && rest.length === 0 && closestMatch(action, ["eject"]) !== undefined;
      printUsageError(
        terminal,
        mistake,
        close ? 'did you mean "eject"?' : "use: gensane theme eject",
      );
      return ExitCode.usage;
    }

    const copied: string[] = [];
    const kept: string[] = [];
    for (const path of await fileSystem.listFiles(defaultTheme)) {
      const target = join(siteFolder, THEME, path);
      if (await fileSystem.isFile(target)) {
        kept.push(path);
      } else {
        await fileSystem.copyFile(join(defaultTheme, path), target);
        copied.push(path);
      }
    }
    for (const path of copied) terminal.write(`Copied ${THEME}/${path}`);
    for (const path of kept) terminal.write(`Kept ${THEME}/${path}, which was already there`);
    terminal.write(
      copied.length === 0
        ? "Nothing to copy: theme/ already has every file of the default theme."
        : `Copied ${count(copied.length, "file")} of the default theme into theme/${kept.length === 0 ? "" : `, and kept ${count(kept.length, "file")}`}.`,
    );
    return ExitCode.success;
  }
}
