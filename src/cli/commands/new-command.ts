import { join } from "node:path";
import { NEW_ENTRY_TYPES, isValidSlug, newEntry, slugify } from "../../core/index.ts";
import { closestMatch } from "../../diagnostics/index.ts";
import type { ContentType } from "../../frontmatter/index.ts";
import { type Environment, ExitCode } from "../environment.ts";
import { localDay } from "../local-day.ts";
import { printUsageError } from "../report.ts";
import { Command, type OptionValues } from "./command.ts";

const CONTENT = "content";
const EXAMPLE = 'gensane new post "Hello World"';

function isContentType(name: string): name is ContentType {
  return NEW_ENTRY_TYPES.some((type) => type === name);
}

const LISTED_TYPES = `${NEW_ENTRY_TYPES.slice(0, -1).join(", ")} and ${NEW_ENTRY_TYPES.at(-1) ?? ""}`;

/** Writes a new content file with the fields its type needs, and never replaces one. */
export class NewCommand extends Command {
  readonly name = "new";
  readonly summary = "Write a new content file, such as a post";
  override readonly takes = "<type> <title>";
  override readonly details = `The types are ${LISTED_TYPES}. For experience the title is the company, and for education the school.`;
  readonly options = {
    slug: {
      type: "string",
      valueName: "slug",
      description: "Name the file with this slug instead of one made from the title",
    },
  } as const;

  async run(
    values: OptionValues,
    { fileSystem, clock, terminal, siteFolder }: Environment,
    positionals: readonly string[],
  ): Promise<number> {
    const [typeName, ...words] = positionals;
    const title = words.join(" ").trim();
    if (typeName === undefined || title === "") {
      printUsageError(terminal, "gensane new needs a type and a title", `such as: ${EXAMPLE}`);
      return ExitCode.usage;
    }
    if (!isContentType(typeName)) {
      const suggestion = closestMatch(typeName, NEW_ENTRY_TYPES);
      const hint =
        suggestion === undefined
          ? `the types are ${LISTED_TYPES}`
          : `did you mean "${suggestion}"?`;
      printUsageError(terminal, `"${typeName}" is not a type of content`, hint);
      return ExitCode.usage;
    }

    const given = values["slug"];
    const slug = typeof given === "string" ? given : slugify(title);
    if (typeof given === "string" && !isValidSlug(given)) {
      const hint = `use lowercase letters, digits and single dashes, such as "${slugify(given) || "my-post"}"`;
      printUsageError(terminal, `"${given}" can't be used in a file name`, hint);
      return ExitCode.usage;
    }
    if (slug === "") {
      printUsageError(
        terminal,
        `"${title}" has nothing to use in a file name`,
        "add --slug, such as --slug my-post",
      );
      return ExitCode.usage;
    }

    const entry = newEntry(typeName, { title, slug, today: localDay(clock.now()) });
    const shown = `${CONTENT}/${entry.path}`;
    const path = join(siteFolder, CONTENT, entry.path);
    if (await fileSystem.isFile(path)) {
      printUsageError(
        terminal,
        `${shown} already exists`,
        "edit that file, or give the new one another --slug",
      );
      return ExitCode.problems;
    }
    await fileSystem.writeText(path, entry.text);
    terminal.write(`Created ${shown}`);
    for (const field of entry.toFill) terminal.write(`Fill in "${field}" before the next build.`);
    return ExitCode.success;
  }
}
