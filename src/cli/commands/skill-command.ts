import { closestMatch } from "../../diagnostics/index.ts";
import { type Environment, ExitCode } from "../environment.ts";
import { SKILL_FOLDERS, addSkill } from "../init/agent-skill.ts";
import { printUsageError } from "../report.ts";
import { Command, type OptionValues } from "./command.ts";

/**
 * `gensane skill add` puts the agent skill of this version of gensane into the site, where coding
 * agents read it, and replaces an older one.
 */
export class SkillCommand extends Command {
  readonly name = "skill";
  readonly summary = "Add the gensane skill for AI coding agents to the site";
  override readonly takes = "add";
  override readonly details =
    "It teaches coding agents how a gensane site works. Run it again after updating gensane, to update the skill.";
  readonly options = {};

  async run(
    _values: OptionValues,
    { fileSystem, terminal, siteFolder, skill }: Environment,
    positionals: readonly string[],
  ): Promise<number> {
    const [action, ...rest] = positionals;
    if (action !== "add" || rest.length > 0) {
      const written = positionals.join(" ");
      const close =
        action !== undefined && rest.length === 0 && closestMatch(action, ["add"]) !== undefined;
      printUsageError(
        terminal,
        written === ""
          ? "gensane skill needs add after it"
          : `"${written}" is not something gensane skill does`,
        close ? 'did you mean "add"?' : "use: gensane skill add",
      );
      return ExitCode.usage;
    }

    const done = await addSkill(fileSystem, skill, siteFolder);
    terminal.write(
      `${done === "added" ? "Added" : "Updated"} the gensane skill for coding agents:`,
    );
    // Both folders have names of the same length, so the two lines line up.
    for (const { path, readBy } of SKILL_FOLDERS) terminal.write(`  ${path}/  read by ${readBy}`);
    return ExitCode.success;
  }
}
