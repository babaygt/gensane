import { describe, expect, it } from "vitest";
import {
  ManualWatcher,
  MemoryFileSystem,
  MemoryTerminal,
  ScriptedPrompter,
} from "../../ports/index.ts";
import { ExitCode } from "../environment.ts";
import { runCli } from "../run-cli.ts";

const DEFAULT_THEME = "gensane/themes/default";
const PICTURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

async function gensane(
  args: readonly string[],
  files: Readonly<Record<string, string | Uint8Array>>,
) {
  const fileSystem = new MemoryFileSystem({
    [`${DEFAULT_THEME}/base.html`]: "base",
    [`${DEFAULT_THEME}/partials/footer.html`]: "footer",
    [`${DEFAULT_THEME}/assets/logo.png`]: PICTURE,
    ...files,
  });
  const terminal = new MemoryTerminal();
  const code = await runCli(args, {
    fileSystem,
    moduleLoader: { load: async () => ({}) },
    clock: { now: () => new Date(0) },
    terminal,
    watcher: new ManualWatcher(),
    prompter: new ScriptedPrompter(),
    stopped: new AbortController().signal,
    defaultTheme: DEFAULT_THEME,
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

describe("gensane theme eject", () => {
  it("copies every file of the default theme into theme/, with its exact bytes", async () => {
    const run = await gensane(["theme", "eject"], {});
    expect(run.code).toBe(ExitCode.success);
    expect(await run.fileSystem.listFiles("site/theme")).toEqual([
      "assets/logo.png",
      "base.html",
      "partials/footer.html",
    ]);
    expect(run.fileSystem.bytesOf("site/theme/assets/logo.png")).toEqual(PICTURE);
    expect(run.output).toBe(
      [
        "Copied theme/assets/logo.png",
        "Copied theme/base.html",
        "Copied theme/partials/footer.html",
        "Copied 3 files of the default theme into theme/.",
      ].join("\n"),
    );
  });

  it("never replaces a file that is already there, and says it kept it", async () => {
    const run = await gensane(["theme", "eject"], {
      "site/theme/partials/footer.html": "my footer",
    });
    expect(await run.fileSystem.readText("site/theme/partials/footer.html")).toBe("my footer");
    expect(run.output.split("\n").slice(-2)).toEqual([
      "Kept theme/partials/footer.html, which was already there",
      "Copied 2 files of the default theme into theme/, and kept 1 file.",
    ]);
  });

  it("says so when there is nothing left to copy", async () => {
    const run = await gensane(["theme", "eject"], {
      "site/theme/base.html": "",
      "site/theme/partials/footer.html": "",
      "site/theme/assets/logo.png": "",
    });
    expect(run.code).toBe(ExitCode.success);
    expect(run.output.split("\n").at(-1)).toBe(
      "Nothing to copy: theme/ already has every file of the default theme.",
    );
  });

  it("leaves the site's other files alone", async () => {
    const run = await gensane(["theme", "eject"], {
      "site/content/index.md": "# Home",
      "site/theme/extra.html": "x",
    });
    expect(await run.fileSystem.readText("site/content/index.md")).toBe("# Home");
    expect(await run.fileSystem.readText("site/theme/extra.html")).toBe("x");
  });
});

describe("mistakes", () => {
  it.each([
    [["theme"], "gensane theme needs eject after it", "use: gensane theme eject"],
    [["theme", "ejct"], '"ejct" is not something gensane theme does', 'did you mean "eject"?'],
    [
      ["theme", "publish"],
      '"publish" is not something gensane theme does',
      "use: gensane theme eject",
    ],
    [
      ["theme", "eject", "now"],
      '"eject now" is not something gensane theme does',
      "use: gensane theme eject",
    ],
  ])("gensane %j", async (args, message, hint) => {
    const run = await gensane(args, {});
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toBe(`error: ${message}\nhint: ${hint}`);
    expect(await run.fileSystem.listFiles("site")).toEqual([]);
  });
});

it("shows its help", async () => {
  const run = await gensane(["theme", "--help"], {});
  expect(run.output).toBe(
    [
      "Usage: gensane theme eject [arguments]",
      "",
      "Copy the default theme into theme/, to change all of it.",
      "",
      "Files already in theme/ are kept as they are. After this, updating gensane doesn't change the copied files.",
      "",
      "Arguments:",
      "  -h, --help  Show this help",
    ].join("\n"),
  );
});
