import { describe, expect, it } from "vitest";
import {
  ManualWatcher,
  MemoryFileSystem,
  MemoryTerminal,
  ScriptedPrompter,
} from "../../ports/index.ts";
import { ExitCode } from "../environment.ts";
import { runCli } from "../run-cli.ts";

/** 20 November 2026 on the computer's own calendar, late in the evening. */
const EVENING = new Date(2026, 10, 20, 23, 30);

async function gensane(
  args: readonly string[],
  files: Readonly<Record<string, string>> = {},
  now: Date = EVENING,
) {
  const fileSystem = new MemoryFileSystem(files);
  const terminal = new MemoryTerminal();
  const code = await runCli(args, {
    fileSystem,
    moduleLoader: { load: async () => ({}) },
    clock: { now: () => now },
    terminal,
    watcher: new ManualWatcher(),
    prompter: new ScriptedPrompter(),
    stopped: new AbortController().signal,
    defaultTheme: "gensane/themes/default",
    skill: "gensane/skills/gensane",
    siteFolder: "site",
    version: "1.2.3",
  });
  return {
    code,
    output: terminal.output.join("\n"),
    errors: terminal.errors.join("\n"),
    fileSystem,
  };
}

describe("gensane new", () => {
  it("writes a post named after today and its title, as a draft", async () => {
    const run = await gensane(["new", "post", "Hello World"]);
    expect(run).toMatchObject({
      code: ExitCode.success,
      output: "Created content/blog/2026-11-20-hello-world.md",
      errors: "",
    });
    expect(await run.fileSystem.readText("site/content/blog/2026-11-20-hello-world.md")).toBe(
      "---\ntitle: Hello World\ndate: 2026-11-20\ndraft: true\n---\n",
    );
  });

  it("writes the month and day with two digits", async () => {
    const run = await gensane(["new", "post", "Hello"], {}, new Date(2026, 0, 5, 12));
    expect(run.output).toBe("Created content/blog/2026-01-05-hello.md");
  });

  it("takes a title of several words without quotes", async () => {
    const run = await gensane(["new", "page", "About", "this", "site"]);
    expect(run.output).toBe("Created content/pages/about-this-site.md");
    expect(await run.fileSystem.readText("site/content/pages/about-this-site.md")).toBe(
      "---\ntitle: About this site\n---\n",
    );
  });

  it.each([
    ["project", "content/projects/gensane.md", []],
    ["talk", "content/talks/gensane.md", ['Fill in "event" before the next build.']],
    ["experience", "content/experience/gensane.md", ['Fill in "role" before the next build.']],
    ["education", "content/education/gensane.md", ['Fill in "degree" before the next build.']],
  ])("writes a %s, and says which fields to fill in", async (type, path, fill) => {
    const run = await gensane(["new", type, "Gensane"]);
    expect(run.code).toBe(ExitCode.success);
    expect(run.output.split("\n")).toEqual([`Created ${path}`, ...fill]);
    expect(await run.fileSystem.isFile(`site/${path}`)).toBe(true);
  });

  it("names the file with --slug", async () => {
    const run = await gensane(["new", "post", "Hello World", "--slug", "first"]);
    expect(run.output).toBe("Created content/blog/2026-11-20-first.md");
  });

  it("never replaces a file that is already there", async () => {
    const path = "site/content/blog/2026-11-20-hello-world.md";
    const run = await gensane(["new", "post", "Hello World"], { [path]: "my words" });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.errors).toBe(
      "error: content/blog/2026-11-20-hello-world.md already exists\nhint: edit that file, or give the new one another --slug",
    );
    expect(await run.fileSystem.readText(path)).toBe("my words");
  });

  it("writes a file that the site can build once its fields are filled in", async () => {
    const run = await gensane(["new", "talk", "Testing compilers"]);
    const check = await gensane(["check"], {
      "site/content/talks/testing-compilers.md": await run.fileSystem.readText(
        "site/content/talks/testing-compilers.md",
      ),
      "site/theme/talks.html": "{% for talk in collections.talks %}{{ talk.event }}{% endfor %}",
    });
    expect(check.errors.split("\n").slice(0, 4)).toEqual([
      'error[GS225]: "event" is empty',
      "  ┌─ content/talks/testing-compilers.md:3:8",
      "  │",
      '3 │ event: ""',
    ]);
  });
});

describe("mistakes", () => {
  it.each([
    [["new"], "gensane new needs a type and a title", 'such as: gensane new post "Hello World"'],
    [
      ["new", "post"],
      "gensane new needs a type and a title",
      'such as: gensane new post "Hello World"',
    ],
    [
      ["new", "post", "  "],
      "gensane new needs a type and a title",
      'such as: gensane new post "Hello World"',
    ],
    [["new", "poost", "Hello"], '"poost" is not a type of content', 'did you mean "post"?'],
    [
      ["new", "recipe", "Hello"],
      '"recipe" is not a type of content',
      "the types are post, project, talk, experience, education and page",
    ],
    [
      ["new", "post", "日本"],
      '"日本" has nothing to use in a file name',
      "add --slug, such as --slug my-post",
    ],
    [
      ["new", "post", "Hello", "--slug", "My Post"],
      '"My Post" can\'t be used in a file name',
      'use lowercase letters, digits and single dashes, such as "my-post"',
    ],
    [
      ["new", "post", "Hello", "--slug", "Über Uns"],
      '"Über Uns" can\'t be used in a file name',
      'use lowercase letters, digits and single dashes, such as "uber-uns"',
    ],
  ])("gensane %j", async (args, message, hint) => {
    const run = await gensane(args);
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toBe(`error: ${message}\nhint: ${hint}`);
    expect(await run.fileSystem.listFiles("site")).toEqual([]);
  });
});

it("shows its help", async () => {
  const run = await gensane(["new", "--help"]);
  expect(run.output).toBe(
    [
      "Usage: gensane new <type> <title> [arguments]",
      "",
      "Write a new content file, such as a post.",
      "",
      "The types are post, project, talk, experience, education and page. For experience the title is the company, and for education the school.",
      "",
      "Arguments:",
      "  --slug <slug>  Name the file with this slug instead of one made from the title",
      "  -h, --help     Show this help",
    ].join("\n"),
  );
});
