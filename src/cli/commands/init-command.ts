import { basename, join, relative } from "node:path";
import { PALETTES } from "../../core/index.ts";
import { closestMatch } from "../../diagnostics/index.ts";
import { AskingStopped, type Prompter, type Terminal } from "../../ports/index.ts";
import { type Environment, ExitCode } from "../environment.ts";
import { localDay } from "../local-day.ts";
import { printUsageError } from "../report.ts";
import { type Answers, SECTIONS, type Section, starterSite } from "../init/starter-site.ts";
import { Command, type OptionValues } from "./command.ts";

const PALETTE_NAMES = Object.keys(PALETTES);

/** "my-site" → "My site". */
function titleOf(folderName: string): string {
  const words = folderName.replaceAll(/[-_]+/g, " ").trim();
  return words === "" ? "My site" : words[0]?.toUpperCase() + words.slice(1);
}

function isAddress(text: string): boolean {
  return URL.canParse(text) && /^https?:\/\//.test(text) && !/[?#]/.test(text);
}

function sectionsOf(text: string): Section[] | undefined {
  const words = [
    ...new Set(
      text
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((word) => word !== ""),
    ),
  ];
  const sections = SECTIONS.filter((section) => words.includes(section));
  return sections.length === words.length ? sections : undefined;
}

type Reading<T> = { readonly value: T } | { readonly problem: string };

/** Asks until the answer fits, and tells why it didn't. */
async function askUntil<T>(
  prompter: Prompter,
  terminal: Terminal,
  question: string,
  defaultAnswer: string,
  read: (answer: string) => Reading<T>,
): Promise<T> {
  for (;;) {
    const reading = read(await prompter.ask(question, defaultAnswer));
    if ("value" in reading) return reading.value;
    terminal.writeError(reading.problem);
  }
}

/** Starts a new site in a folder of its own, from a few questions. */
export class InitCommand extends Command {
  readonly name = "init";
  readonly summary = "Start a new site, from a few questions";
  override readonly takes = "[folder]";
  override readonly details =
    "The folder is made if it doesn't exist; it must be empty, apart from .git. Without a folder, the site starts in the folder gensane runs in.";
  readonly options = {
    yes: { type: "boolean", description: "Take every default without asking" },
  } as const;

  async run(
    values: OptionValues,
    environment: Environment,
    positionals: readonly string[],
  ): Promise<number> {
    const { fileSystem, terminal, prompter, siteFolder, clock, version } = environment;
    const [folder = ".", ...rest] = positionals;
    if (rest.length > 0) {
      printUsageError(terminal, "gensane init takes one folder", "such as: gensane init my-site");
      return ExitCode.usage;
    }
    const target = join(siteFolder, folder);
    const shown = relative(siteFolder, target) || ".";
    const existing = (await fileSystem.listFiles(target)).filter(
      (path) => !path.startsWith(".git/"),
    );
    if (existing.length > 0) {
      printUsageError(
        terminal,
        `${shown === "." ? "this folder" : shown} already has files, so gensane init won't write into it`,
        "choose a new folder, such as: gensane init my-site",
      );
      return ExitCode.problems;
    }
    const takeDefaults = values["yes"] === true;
    if (!takeDefaults && !prompter.canAsk) {
      printUsageError(
        terminal,
        "gensane init asks questions, but nobody can answer them here",
        "use --yes to take every default",
      );
      return ExitCode.usage;
    }

    const folderName = basename(target);
    const defaults: Answers = {
      title: titleOf(folderName),
      author: "",
      url: "",
      sections: [...SECTIONS],
      palette: "default",
    };
    let answers = defaults;
    if (!takeDefaults) {
      try {
        answers = await this.#ask(prompter, terminal, defaults);
      } catch (error) {
        if (!(error instanceof AskingStopped)) throw error;
        terminal.writeError("Stopped, so nothing was written.");
        return ExitCode.problems;
      }
    }
    const files = starterSite(answers, { today: localDay(clock.now()), version, folderName });
    for (const [path, content] of Object.entries(files)) {
      await fileSystem.writeText(join(target, path), content);
    }

    terminal.write(
      `Created a site with ${Object.keys(files).length} files in ${shown === "." ? "this folder" : shown}.`,
    );
    terminal.write("");
    terminal.write("Next:");
    if (shown !== ".") terminal.write(`  cd ${shown}`);
    terminal.write("  npm install");
    terminal.write("  npm run dev");
    return ExitCode.success;
  }

  async #ask(prompter: Prompter, terminal: Terminal, defaults: Answers): Promise<Answers> {
    const title = await prompter.ask("The title of the site", defaults.title);
    const author = await prompter.ask("Your name", defaults.author);
    const url = await askUntil(
      prompter,
      terminal,
      "The address of the site, if you know it",
      "",
      (answer) =>
        answer === "" || isAddress(answer)
          ? { value: answer }
          : {
              problem:
                "That isn't a full address, such as https://example.com; leave it empty for now.",
            },
    );
    const sections = await askUntil(
      prompter,
      terminal,
      `The parts you want: ${SECTIONS.join(", ")}`,
      defaults.sections.join(", "),
      (answer) => {
        const chosen = sectionsOf(answer);
        return chosen === undefined
          ? { problem: `Choose from ${SECTIONS.join(", ")}.` }
          : { value: chosen };
      },
    );
    const palette = await askUntil(
      prompter,
      terminal,
      `The colors: ${PALETTE_NAMES.join(", ")}`,
      defaults.palette,
      (answer) => {
        if (PALETTE_NAMES.includes(answer)) return { value: answer };
        const close = closestMatch(answer, PALETTE_NAMES);
        return {
          problem:
            close === undefined
              ? `Choose from ${PALETTE_NAMES.join(", ")}.`
              : `Did you mean ${close}?`,
        };
      },
    );
    return { title, author, url, sections, palette };
  }
}
