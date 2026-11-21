/** Reads the arguments, picks the command, and turns every way it can end into an exit code. */
import { parseArgs } from "node:util";
import { InternalError, closestMatch } from "../diagnostics/index.ts";
import { BuildCommand } from "./commands/build-command.ts";
import { CheckCommand } from "./commands/check-command.ts";
import { DeployCommand } from "./commands/deploy-command.ts";
import { DevCommand } from "./commands/dev-command.ts";
import { InitCommand } from "./commands/init-command.ts";
import { NewCommand } from "./commands/new-command.ts";
import { ThemeCommand } from "./commands/theme-command.ts";
import type { Command, OptionValues } from "./commands/command.ts";
import { type Environment, ExitCode } from "./environment.ts";
import { printUsageError } from "./report.ts";

const COMMANDS: readonly Command[] = [
  new BuildCommand(),
  new CheckCommand(),
  new DevCommand(),
  new DeployCommand(),
  new InitCommand(),
  new NewCommand(),
  new ThemeCommand(),
];
const ISSUES = "https://github.com/babaygt/gensane/issues";

function generalHelp(version: string): string {
  const width = Math.max(...COMMANDS.map(({ name }) => name.length));
  return [
    `gensane ${version}: a static site generator for developer blogs and portfolios`,
    "",
    "Usage: gensane <command> [arguments]",
    "",
    "Commands:",
    ...COMMANDS.map(({ name, summary }) => `  ${name.padEnd(width)}  ${summary}`),
    "",
    "Run gensane <command> --help to see the arguments of a command.",
  ].join("\n");
}

/** The first thing in quotes in one of Node's messages, such as `--draft` in "Unknown option '--draft'". */
function quotedIn(message: string): string {
  return /'([^']*)'/.exec(message)?.[1] ?? "";
}

type Parsed =
  | { readonly values: OptionValues; readonly positionals: readonly string[] }
  | { readonly mistake: string; readonly hint: string };

function parseArguments(command: Command, args: readonly string[]): Parsed {
  const options = Object.fromEntries(
    Object.entries(command.options).map(([name, { type }]) => [name, { type }]),
  );
  const helpHint = `see gensane ${command.name} --help`;
  try {
    const { values, positionals } = parseArgs({
      args: [...args],
      options: { ...options, help: { type: "boolean", short: "h" } },
      strict: true,
      allowPositionals: command.takes !== "",
    });
    return { values, positionals };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    const message = error instanceof Error ? error.message : String(error);
    const written = quotedIn(message);
    if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      const known = [...Object.keys(command.options), "help"].map((name) => `--${name}`);
      const suggestion = closestMatch(written, known);
      return {
        mistake: `"${written}" is not an argument of gensane ${command.name}`,
        hint: suggestion === undefined ? helpHint : `did you mean "${suggestion}"?`,
      };
    }
    if (code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL") {
      return { mistake: `gensane ${command.name} doesn't take "${written}"`, hint: helpHint };
    }
    if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
      const name = written.split(" ")[0] ?? written;
      const option = command.options[name.slice(2)];
      const mistake =
        option?.type === "string"
          ? `${name} needs a ${option.valueName ?? "value"} after it`
          : `${name} doesn't take a value`;
      return { mistake, hint: helpHint };
    }
    throw error;
  }
}

async function runCommand(args: readonly string[], environment: Environment): Promise<number> {
  const { terminal, version } = environment;
  const [first, ...rest] = args;
  if (first === undefined) {
    terminal.writeError(generalHelp(version));
    return ExitCode.usage;
  }
  if (first === "--help" || first === "-h") {
    terminal.write(generalHelp(version));
    return ExitCode.success;
  }
  if (first === "--version" || first === "-v") {
    terminal.write(version);
    return ExitCode.success;
  }

  const command = COMMANDS.find(({ name }) => name === first);
  if (command === undefined) {
    const suggestion = closestMatch(
      first,
      COMMANDS.map(({ name }) => name),
    );
    const hint = suggestion === undefined ? "see gensane --help" : `did you mean "${suggestion}"?`;
    printUsageError(terminal, `"${first}" is not a command`, hint);
    return ExitCode.usage;
  }
  const parsed = parseArguments(command, rest);
  if ("mistake" in parsed) {
    printUsageError(terminal, parsed.mistake, parsed.hint);
    return ExitCode.usage;
  }
  if (parsed.values["help"] === true) {
    terminal.write(command.help());
    return ExitCode.success;
  }
  return command.run(parsed.values, environment, parsed.positionals);
}

/** Runs gensane with the arguments after `gensane`, and gives back the exit code. */
export async function runCli(args: readonly string[], environment: Environment): Promise<number> {
  try {
    return await runCommand(args, environment);
  } catch (error) {
    // A mistake in a site is a problem, never an exception, so this is the disk failing, or a bug.
    const message = error instanceof Error ? error.message : String(error);
    const hint =
      error instanceof InternalError
        ? `this is a bug in gensane; please report it at ${ISSUES}`
        : "check that the site folder can be read and written";
    printUsageError(environment.terminal, message, hint);
    return ExitCode.problems;
  }
}
