import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../core/index.ts";
import { InternalError } from "../diagnostics/index.ts";
import {
  type Clock,
  type FileSystem,
  MemoryFileSystem,
  MemoryTerminal,
  type ModuleLoader,
} from "../ports/index.ts";
import { ExitCode } from "./environment.ts";
import { runCli } from "./run-cli.ts";

const plainTheme = Object.fromEntries(
  Object.values(TEMPLATES).map((name) => [`site/theme/${name}`, "<h1>{{ page.title }}</h1>"]),
);

/** With an address, the site gets a feed and a sitemap, and no warning that they are left out. */
const WITH_ADDRESS = { default: { site: { url: "https://example.com" } } };

const HELLO = "---\ntitle: Hello\ndate: 2026-11-17\n---\nHi\n";
const BROKEN_LINK = "---\ntitle: Hello\ndate: 2026-11-17\n---\nSee [about](/abuot/).\n";

interface Run {
  readonly code: number;
  readonly output: string;
  readonly errors: string;
  readonly fileSystem: FileSystem;
}

interface Setup {
  readonly files?: Readonly<Record<string, string>>;
  /** What `gensane.config.ts` exports; there is no config file when this is left out. */
  readonly config?: Readonly<Record<string, unknown>>;
  /** Defaults to `gensane.config.ts`. */
  readonly configFile?: string;
  readonly fileSystem?: FileSystem;
  readonly color?: boolean;
  readonly clock?: Clock;
}

async function gensane(args: readonly string[], setup: Setup = {}): Promise<Run> {
  const configName = setup.configFile ?? "gensane.config.ts";
  const configFile = setup.config === undefined ? {} : { [`site/${configName}`]: "" };
  const fileSystem =
    setup.fileSystem ?? new MemoryFileSystem({ ...plainTheme, ...configFile, ...setup.files });
  const moduleLoader: ModuleLoader = { load: async () => setup.config ?? {} };
  const terminal = new MemoryTerminal({ color: setup.color ?? false });
  const code = await runCli(args, {
    fileSystem,
    moduleLoader,
    clock: setup.clock ?? { now: () => new Date(0) },
    terminal,
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

describe("gensane build", () => {
  it("builds the site into dist/ and says what it did", async () => {
    const run = await gensane(["build"], {
      files: { "site/content/blog/hello.md": HELLO },
      config: WITH_ADDRESS,
    });
    expect(run.code).toBe(ExitCode.success);
    expect(run.output).toBe("Built 4 pages into dist in 0 ms, with no warnings.");
    expect(run.errors).toBe("");
    expect(await run.fileSystem.listFiles("site/dist")).toEqual([
      "404.html",
      "blog/hello/index.html",
      "blog/index.html",
      "feed.xml",
      "index.html",
      "sitemap.xml",
    ]);
  });

  it("uses the settings of the config", async () => {
    const run = await gensane(["build"], {
      files: { "site/content/blog/hello.md": HELLO, "site/theme/post.html": "{{ site.title }}" },
      config: { default: { site: { title: "Ada's notes", url: "https://example.com" } } },
    });
    expect(run.code).toBe(ExitCode.success);
    expect(await run.fileSystem.readText("site/dist/blog/hello/index.html")).toBe(
      "Ada&#39;s notes",
    );
    expect(await run.fileSystem.listFiles("site/dist")).toContain("feed.xml");
  });

  it("prints every problem with its source, and writes nothing when the site has errors", async () => {
    const run = await gensane(["build"], {
      files: { "site/content/blog/hello.md": BROKEN_LINK, "site/dist/index.html": "old" },
      config: WITH_ADDRESS,
    });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.errors).toBe(
      [
        'error[GS413]: "/abuot/" doesn\'t lead to a page or a file of the site',
        "  ┌─ content/blog/hello.md:5:13",
        "  │",
        "5 │ See [about](/abuot/).",
        "  │             ^^^^^^^",
        "  │",
        "  = hint: check the address, or put the file in the `public` folder",
        "",
      ].join("\n"),
    );
    expect(run.output).toBe("Found 1 error and 0 warnings, so nothing was written.");
    expect(await run.fileSystem.readText("site/dist/index.html")).toBe("old");
  });

  it("shows a problem in a template at its file in theme/", async () => {
    const run = await gensane(["build"], {
      files: { "site/content/blog/hello.md": HELLO, "site/theme/post.html": "{{ page.titel }}" },
      config: WITH_ADDRESS,
    });
    expect(run.errors.split("\n").slice(0, 4)).toEqual([
      'warning[GS331]: "page" has no field "titel"',
      "  ┌─ theme/post.html:1:9",
      "  │",
      "1 │ {{ page.titel }}",
    ]);
    expect(run.output).toBe("Built 4 pages into dist in 0 ms, with 1 warning.");
  });

  it("prints the warnings of the config before the others, and still builds", async () => {
    const run = await gensane(["build"], {
      files: { "site/content/index.md": "---\ntitle: Home\n---\n" },
      config: { default: { site: { titel: "A" } } },
    });
    expect(run.code).toBe(ExitCode.success);
    expect(run.errors.split("\n\n").map((problem) => problem.split("\n")[0])).toEqual([
      'warning[GS506]: "site.titel" is not a known setting',
      "warning[GS411]: the feed and the sitemap are left out, because they need the address of the site",
    ]);
  });

  it("stops at a config with errors, before reading the site", async () => {
    const run = await gensane(["build"], { config: { default: { perPage: 0 } } });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.errors.split("\n")[0]).toBe(
      'error[GS505]: "perPage" must be a whole number above 0, but 0 is a number',
    );
    expect(run.output).toBe("Found 1 error and 0 warnings in the config, so nothing was written.");
  });

  it("leaves out drafts, unless --drafts is given", async () => {
    const draft = "---\ntitle: Soon\ndate: 2026-11-18\ndraft: true\n---\n";
    const files = { "site/content/blog/hello.md": HELLO, "site/content/blog/soon.md": draft };
    const without = await gensane(["build"], { files });
    expect(await without.fileSystem.listFiles("site/dist")).not.toContain("blog/soon/index.html");
    const withDrafts = await gensane(["build", "--drafts"], { files });
    expect(await withDrafts.fileSystem.listFiles("site/dist")).toContain("blog/soon/index.html");
  });

  it("writes into the folder given with --out", async () => {
    const run = await gensane(["build", "--out", "public_html"], {
      files: { "site/content/index.md": "---\ntitle: Home\n---\n" },
    });
    expect(run.output).toBe("Built 2 pages into public_html in 0 ms, with 1 warning.");
    expect(await run.fileSystem.listFiles("site/public_html")).toEqual(["404.html", "index.html"]);
  });

  it.each([
    ["..", 'the output folder ".." isn\'t inside the site folder'],
    ["content", 'the output folder "content" would replace content/'],
    [".", 'the output folder "." is the site folder itself'],
  ])("refuses --out %s before doing anything", async (out, message) => {
    const run = await gensane(["build", "--out", out], {
      files: { "site/content/index.md": "---\ntitle: Home\n---\n" },
    });
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toBe(`error: ${message}\nhint: see gensane build --help`);
    expect(await run.fileSystem.listFiles("site/content")).toEqual(["index.md"]);
  });
});

describe("what a build takes from the config and the clock", () => {
  it("uses perPage, markdown and filters from the config", async () => {
    const run = await gensane(["build"], {
      files: {
        "site/content/blog/one.md": "---\ntitle: Post 1\ndate: 2026-11-01\n---\n<b>bold</b>\n",
        "site/content/blog/two.md": "---\ntitle: Post 2\ndate: 2026-11-02\n---\n<b>bold</b>\n",
        "site/theme/post.html": "{{ page.title | shout }} {{ page.html }}",
      },
      config: {
        default: {
          site: { url: "https://example.com" },
          perPage: 1,
          markdown: { rawHtml: "escape" },
          filters: { shout: (value: unknown) => String(value).toUpperCase() },
        },
      },
    });
    expect(await run.fileSystem.listFiles("site/dist")).toContain("blog/page/2/index.html");
    expect(await run.fileSystem.readText("site/dist/blog/one/index.html")).toBe(
      "POST 1 <p>&lt;b&gt;bold&lt;/b&gt;</p>\n",
    );
  });

  it("points a problem with the site address at the config file the site has", async () => {
    const run = await gensane(["check"], {
      files: { "site/content/index.md": "---\ntitle: Home\n---\n" },
      config: { default: { site: { url: "example.com" } } },
      configFile: "gensane.config.mjs",
    });
    expect(run.errors.split("\n").slice(0, 2)).toEqual([
      'error[GS412]: "site.url" must be the full address of the site, such as "https://example.com", but it is "example.com"',
      "  ┌─ gensane.config.mjs",
    ]);
  });

  it("says how long the build took", async () => {
    const times = [1000, 1084];
    const clock = { now: () => new Date(times.shift() ?? 0) };
    const run = await gensane(["check"], {
      files: { "site/content/index.md": "---\ntitle: Home\n---\n" },
      config: WITH_ADDRESS,
      clock,
    });
    expect(run.output).toBe("Checked 2 pages in 84 ms, with no warnings.");
  });
});

describe("gensane check", () => {
  it("builds without writing anything", async () => {
    const run = await gensane(["check"], {
      files: { "site/content/blog/hello.md": HELLO },
      config: WITH_ADDRESS,
    });
    expect(run.code).toBe(ExitCode.success);
    expect(run.output).toBe("Checked 4 pages in 0 ms, with no warnings.");
    expect(await run.fileSystem.listFiles("site/dist")).toEqual([]);
  });

  it("fails when the site has errors, so CI can stop", async () => {
    const run = await gensane(["check"], {
      files: { "site/content/blog/hello.md": BROKEN_LINK },
      config: WITH_ADDRESS,
    });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.output).toBe("Found 1 error and 0 warnings.");
  });

  it("doesn't take --out", async () => {
    const run = await gensane(["check", "--out", "x"]);
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toBe(
      'error: "--out" is not an argument of gensane check\nhint: see gensane check --help',
    );
  });
});

describe("mistakes in the command", () => {
  it.each([
    [["biuld"], '"biuld" is not a command', 'did you mean "build"?'],
    [["publish"], '"publish" is not a command', "see gensane --help"],
    [
      ["build", "--draft"],
      '"--draft" is not an argument of gensane build',
      'did you mean "--drafts"?',
    ],
    [["build", "-q"], '"-q" is not an argument of gensane build', "see gensane build --help"],
    [["build", "--hlep"], '"--hlep" is not an argument of gensane build', 'did you mean "--help"?'],
    [["build", "my-site"], 'gensane build doesn\'t take "my-site"', "see gensane build --help"],
    [["build", "--out"], "--out needs a folder after it", "see gensane build --help"],
    [["build", "--drafts=yes"], "--drafts doesn't take a value", "see gensane build --help"],
  ])("gensane %j", async (args, message, hint) => {
    const run = await gensane(args);
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toBe(`error: ${message}\nhint: ${hint}`);
    expect(run.output).toBe("");
  });
});

describe("help and version", () => {
  const generalHelp = [
    "gensane 1.2.3: a static site generator for developer blogs and portfolios",
    "",
    "Usage: gensane <command> [arguments]",
    "",
    "Commands:",
    "  build  Build the site into dist/",
    "  check  Check the site for problems, without writing anything",
    "  new    Write a new content file, such as a post",
    "",
    "Run gensane <command> --help to see the arguments of a command.",
  ].join("\n");

  it.each([["--help"], ["-h"]])("%s shows the commands", async (flag) => {
    expect(await gensane([flag])).toMatchObject({ code: ExitCode.success, output: generalHelp });
  });

  it("shows the commands on the error stream when no command is given, as a mistake", async () => {
    expect(await gensane([])).toMatchObject({
      code: ExitCode.usage,
      output: "",
      errors: generalHelp,
    });
  });

  it.each([["--version"], ["-v"]])("%s shows the version", async (flag) => {
    expect(await gensane([flag])).toMatchObject({ code: ExitCode.success, output: "1.2.3" });
  });

  it("shows the arguments of a command", async () => {
    const run = await gensane(["build", "--help"]);
    expect(run.code).toBe(ExitCode.success);
    expect(run.output).toBe(
      [
        "Usage: gensane build [arguments]",
        "",
        "Build the site into dist/.",
        "",
        "Arguments:",
        "  --drafts        Include drafts",
        "  --out <folder>  Write the site into this folder instead of dist/",
        "  -h, --help      Show this help",
      ].join("\n"),
    );
  });

  it("shows the help of a command instead of running it", async () => {
    const run = await gensane(["check", "-h"], {
      files: { "site/content/blog/hello.md": BROKEN_LINK },
    });
    expect(run.code).toBe(ExitCode.success);
    expect(run.output.split("\n")[0]).toBe("Usage: gensane check [arguments]");
  });
});

/** A disk that fails as soon as the site folder is read. */
function failingDisk(error: Error): FileSystem {
  const disk = new MemoryFileSystem(plainTheme);
  return Object.assign(disk, {
    listFiles: async () => {
      throw error;
    },
  });
}

describe("when something outside the site fails", () => {
  it("reports a disk that can't be read, without a crash", async () => {
    const error = Object.assign(new Error("EACCES: permission denied, scandir 'site/content'"), {
      code: "EACCES",
    });
    const run = await gensane(["build"], { fileSystem: failingDisk(error) });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.errors).toBe(
      "error: EACCES: permission denied, scandir 'site/content'\nhint: check that the site folder can be read and written",
    );
  });

  it("asks for a bug report when gensane itself is wrong", async () => {
    const run = await gensane(["check"], {
      fileSystem: failingDisk(new InternalError("impossible")),
    });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.errors).toBe(
      "error: impossible\nhint: this is a bug in gensane; please report it at https://github.com/babaygt/gensane/issues",
    );
  });
});

it("colors problems when the terminal can show colors", async () => {
  const run = await gensane(["check"], {
    files: { "site/content/blog/hello.md": BROKEN_LINK },
    color: true,
  });
  expect(run.errors).toContain("\u001B[1;31merror[GS413]");
});
