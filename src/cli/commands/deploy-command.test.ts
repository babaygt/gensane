import { describe, expect, it } from "vitest";
import {
  ManualWatcher,
  MemoryFileSystem,
  MemoryTerminal,
  ScriptedPrompter,
} from "../../ports/index.ts";
import { ExitCode } from "../environment.ts";
import { runCli } from "../run-cli.ts";

async function gensane(args: readonly string[], files: Readonly<Record<string, string>> = {}) {
  const fileSystem = new MemoryFileSystem(files);
  const terminal = new MemoryTerminal();
  const code = await runCli(args, {
    fileSystem,
    moduleLoader: { load: async () => ({}) },
    clock: { now: () => new Date(2026, 10, 21) },
    terminal,
    watcher: new ManualWatcher(),
    prompter: new ScriptedPrompter(),
    stopped: new AbortController().signal,
    defaultTheme: "gensane/themes/default",
    skill: "gensane/skills/gensane",
    siteFolder: "/home/ada/My Notes",
    version: "1.2.3",
  });
  return {
    code,
    output: terminal.output.join("\n"),
    errors: terminal.errors.join("\n"),
    fileSystem,
  };
}

describe("gensane deploy init", () => {
  it("adds the workflow for GitHub Pages, and says what to do next", async () => {
    const run = await gensane(["deploy", "init", "github"]);
    expect(run.code).toBe(ExitCode.success);
    expect(await run.fileSystem.listFiles("/home/ada/My Notes")).toEqual([
      ".github/workflows/deploy.yml",
    ]);
    expect(run.output).toBe(
      [
        "Created .github/workflows/deploy.yml",
        "",
        "To publish:",
        "  Push the site to GitHub, with package-lock.json, and in the repository's settings,",
        '  under Pages, set the source to "GitHub Actions".',
      ].join("\n"),
    );
  });

  it("names the site on Cloudflare after its folder", async () => {
    const run = await gensane(["deploy", "init", "cloudflare"]);
    expect(run.code).toBe(ExitCode.success);
    expect(await run.fileSystem.readText("/home/ada/My Notes/wrangler.jsonc")).toContain(
      '"name": "my-notes"',
    );
  });

  it("adds netlify.toml for Netlify", async () => {
    const run = await gensane(["deploy", "init", "netlify"]);
    expect(run.output.split("\n")[0]).toBe("Created netlify.toml");
  });

  it("leaves a file that is already there as it is", async () => {
    const run = await gensane(["deploy", "init", "netlify"], {
      "/home/ada/My Notes/netlify.toml": "mine\n",
    });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.errors).toContain("netlify.toml is already there, so it was left as it is");
    expect(await run.fileSystem.readText("/home/ada/My Notes/netlify.toml")).toBe("mine\n");
  });

  it.each([
    [
      [],
      "gensane deploy needs init and a host after it",
      "use: gensane deploy init <github|cloudflare|netlify>",
    ],
    [["publish"], '"publish" is not something gensane deploy does', "use: gensane deploy init"],
    [["init", "github", "now"], '"init github now" is not something gensane deploy does', "use:"],
    [["init"], "gensane deploy init needs a host", "choose from github, cloudflare, netlify"],
    [
      ["init", "vercel"],
      'gensane deploy can\'t publish on "vercel"',
      "choose from github, cloudflare, netlify",
    ],
    [["init", "netlfy"], 'gensane deploy can\'t publish on "netlfy"', 'did you mean "netlify"?'],
  ])("explains %j, and writes nothing", async (rest, mistake, hint) => {
    const run = await gensane(["deploy", ...rest]);
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toContain(mistake);
    expect(run.errors).toContain(hint);
    expect(await run.fileSystem.listFiles("/home/ada/My Notes")).toEqual([]);
  });
});
