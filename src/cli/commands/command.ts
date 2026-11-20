import type { Environment } from "../environment.ts";

export interface OptionSpec {
  readonly type: "boolean" | "string";
  readonly description: string;
  /** What a string option holds, for the help: `--out <folder>`. */
  readonly valueName?: string;
}

/** What the arguments of a command were, after parsing. */
export type OptionValues = Readonly<Record<string, string | boolean | undefined>>;

/** One command, such as `gensane build`. Each command says which arguments it takes and how it runs. */
export abstract class Command {
  abstract readonly name: string;
  /** One line for the list of commands. */
  abstract readonly summary: string;
  abstract readonly options: Readonly<Record<string, OptionSpec>>;

  /** Runs the command and gives back its exit code. */
  abstract run(values: OptionValues, environment: Environment): Promise<number>;

  help(): string {
    const rows: [string, string][] = Object.entries(this.options).map(([name, option]) => [
      option.type === "string" ? `--${name} <${option.valueName ?? "value"}>` : `--${name}`,
      option.description,
    ]);
    rows.push(["-h, --help", "Show this help"]);
    const width = Math.max(...rows.map(([left]) => left.length));
    return [
      `Usage: gensane ${this.name} [arguments]`,
      "",
      `${this.summary}.`,
      "",
      "Arguments:",
      ...rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`),
    ].join("\n");
  }
}
