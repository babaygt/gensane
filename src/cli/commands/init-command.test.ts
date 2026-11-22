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
  {
    files = {},
    prompter = new ScriptedPrompter(),
  }: { files?: Record<string, string>; prompter?: ScriptedPrompter } = {},
) {
  const fileSystem = new MemoryFileSystem({
    "gensane/skills/gensane/SKILL.md": "The skill.\n",
    "gensane/skills/gensane/references/problems.md": "# Problems\n",
    ...files,
  });
  const terminal = new MemoryTerminal();
  const code = await runCli(args, {
    fileSystem,
    moduleLoader: { load: async () => ({}) },
    clock: { now: () => EVENING },
    terminal,
    watcher: new ManualWatcher(),
    prompter,
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
    prompter,
  };
}

describe("gensane init", () => {
  it("takes every default with --yes, and says what to do next", async () => {
    const run = await gensane(["init", "my-site", "--yes"]);
    expect(run.code).toBe(ExitCode.success);
    const files = await run.fileSystem.listFiles("site/my-site");
    expect(files.filter((path) => !path.includes("skills/"))).toHaveLength(8);
    expect(files.filter((path) => path.includes("skills/"))).toEqual([
      ".agents/skills/gensane/SKILL.md",
      ".agents/skills/gensane/references/problems.md",
      ".claude/skills/gensane/SKILL.md",
      ".claude/skills/gensane/references/problems.md",
    ]);
    expect(await run.fileSystem.readText("site/my-site/gensane.config.ts")).toContain(
      'title: "My site",',
    );
    expect(
      await run.fileSystem.readText("site/my-site/content/blog/2026-11-20-hello-world.md"),
    ).toContain("date: 2026-11-20");
    expect(run.output).toBe(
      [
        "Created a site with 8 files in my-site,",
        "and added the gensane skill for coding agents, in .agents/skills/ and .claude/skills/.",
        "",
        "Next:",
        "  cd my-site",
        "  npm install",
        "  npm run dev",
      ].join("\n"),
    );
  });

  it("starts the site in the folder it runs in, without a folder", async () => {
    const run = await gensane(["init", "--yes"]);
    expect(run.code).toBe(ExitCode.success);
    expect(await run.fileSystem.readText("site/gensane.config.ts")).toContain('title: "Site",');
    expect(run.output).toContain("in this folder,");
    expect(run.output).not.toContain("cd ");
  });

  it("asks each question, and uses the answers", async () => {
    const prompter = new ScriptedPrompter([
      "Ada's notes",
      "Ada",
      "https://ada.dev",
      "blog, about",
      "paper",
    ]);
    const run = await gensane(["init", "notes"], { prompter });
    expect(run.code).toBe(ExitCode.success);
    expect(prompter.asked).toEqual([
      "The title of the site",
      "Your name",
      "The address of the site, if you know it",
      "The parts you want: blog, projects, talks, about",
      "The colors: default, paper, nord, solarized, gruvbox, midnight",
      "Where you will publish it: github, cloudflare, netlify, none",
      "Add the gensane skill for AI coding agents? yes, no",
    ]);
    const config = await run.fileSystem.readText("site/notes/gensane.config.ts");
    expect(config).toContain('title: "Ada\'s notes",');
    expect(config).toContain('url: "https://ada.dev",');
    expect(config).toContain('author: "Ada",');
    expect(config).toContain('palette: "paper",');
    expect((await run.fileSystem.listFiles("site/notes/content")).toSorted()).toEqual([
      "blog/2026-11-20-hello-world.md",
      "index.md",
      "pages/about.md",
    ]);
  });

  it("leaves the skill out when the answer is no", async () => {
    const prompter = new ScriptedPrompter(["", "", "", "", "", "", "no"]);
    const run = await gensane(["init", "notes"], { prompter });
    expect(run.code).toBe(ExitCode.success);
    expect(
      (await run.fileSystem.listFiles("site/notes")).filter((path) => path.includes("skills/")),
    ).toEqual([]);
    expect(run.output.split("\n")[0]).toBe("Created a site with 8 files in notes.");
  });

  it.each(["y", "YES", "n", "No"])("takes %j as an answer about the skill", async (answer) => {
    const prompter = new ScriptedPrompter(["", "", "", "", "", "", answer]);
    const run = await gensane(["init", "notes"], { prompter });
    expect(run.errors).toBe("");
    const added = await run.fileSystem.isFile("site/notes/.claude/skills/gensane/SKILL.md");
    expect(added).toBe(answer.toLowerCase().startsWith("y"));
  });

  it("asks again after an answer that doesn't fit, and says why", async () => {
    const prompter = new ScriptedPrompter([
      "",
      "",
      "ada.dev",
      "https://ada.dev",
      "blog, news",
      "Blog",
      "nrd",
      "nord",
      "",
      "maybe",
      "yes",
    ]);
    const run = await gensane(["init", "notes"], { prompter });
    expect(run.code).toBe(ExitCode.success);
    expect(run.errors.split("\n")).toEqual([
      "That isn't a full address, such as https://example.com; leave it empty for now.",
      "Choose from blog, projects, talks, about.",
      "Did you mean nord?",
      "Answer yes or no.",
    ]);
    const config = await run.fileSystem.readText("site/notes/gensane.config.ts");
    expect(config).toContain('url: "https://ada.dev",');
    expect(config).toContain('palette: "nord",');
  });

  it.each(["https://ada.dev/notes?page=2", "ftp://ada.dev", "https://"])(
    "doesn't take %j as the address",
    async (url) => {
      const prompter = new ScriptedPrompter(["", "", url, ""]);
      const run = await gensane(["init", "notes"], { prompter });
      expect(run.errors).toContain("That isn't a full address");
      expect(await run.fileSystem.readText("site/notes/gensane.config.ts")).toContain("// url:");
    },
  );

  it("refuses a folder that already has files, and writes nothing", async () => {
    const run = await gensane(["init", "notes", "--yes"], {
      files: { "site/notes/notes.md": "mine\n" },
    });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.errors).toContain("notes already has files, so gensane init won't write into it");
    expect(await run.fileSystem.listFiles("site/notes")).toEqual(["notes.md"]);
  });

  it("writes into a folder that only has git in it", async () => {
    const run = await gensane(["init", "notes", "--yes"], {
      files: { "site/notes/.git/HEAD": "ref\n" },
    });
    expect(run.code).toBe(ExitCode.success);
  });

  it("doesn't ask where nobody can answer, and says how to take the defaults", async () => {
    const prompter = new ScriptedPrompter([], { canAsk: false });
    const run = await gensane(["init", "notes"], { prompter });
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toContain("use --yes to take every default");
    expect(prompter.asked).toEqual([]);
    expect(await run.fileSystem.listFiles("site/notes")).toEqual([]);
  });

  it("writes nothing when the person stops at a question", async () => {
    const prompter = new ScriptedPrompter(["Ada's notes", null]);
    const run = await gensane(["init", "notes"], { prompter });
    expect(run.code).toBe(ExitCode.problems);
    expect(run.errors).toBe("Stopped, so nothing was written.");
    expect(await run.fileSystem.listFiles("site/notes")).toEqual([]);
  });

  it("adds the files of the host it is asked for, and says how to publish", async () => {
    const prompter = new ScriptedPrompter(["", "", "", "", "", "Cloudflre", "cloudflare"]);
    const run = await gensane(["init", "notes"], { prompter });
    expect(run.code).toBe(ExitCode.success);
    expect(run.errors).toBe("Did you mean cloudflare?");
    expect(await run.fileSystem.readText("site/notes/wrangler.jsonc")).toContain('"name": "notes"');
    expect(await run.fileSystem.readText("site/notes/.gitignore")).toBe(
      "dist/\nnode_modules/\n.cloudflare/\n.wrangler/\n",
    );
    expect(run.output).toContain("Created a site with 9 files in notes,");
    expect(run.output.endsWith("To publish:\n  npm run build && npx wrangler deploy")).toBe(true);
  });

  it("publishes nowhere by default, and keeps Wrangler's folder out of .gitignore", async () => {
    const run = await gensane(["init", "notes", "--yes"]);
    expect(await run.fileSystem.readText("site/notes/.gitignore")).toBe(
      "dist/\nnode_modules/\n.cloudflare/\n",
    );
    expect(run.output).not.toContain("To publish");
  });

  it("takes the host from --deploy, with --yes or without asking for it", async () => {
    const withYes = await gensane(["init", "notes", "--yes", "--deploy", "github"]);
    expect(await withYes.fileSystem.listFiles("site/notes/.github")).toEqual([
      "workflows/deploy.yml",
    ]);
    const prompter = new ScriptedPrompter([]);
    const asked = await gensane(["init", "notes", "--deploy", "netlify"], { prompter });
    expect(await asked.fileSystem.isFile("site/notes/netlify.toml")).toBe(true);
    // Every question but the host's, which --deploy answered.
    expect(prompter.asked).toHaveLength(6);
  });

  it("takes the name of a host written with capitals, as people write GitHub", async () => {
    const prompter = new ScriptedPrompter(["", "", "", "", "", "GitHub"]);
    const run = await gensane(["init", "notes"], { prompter });
    expect(run.errors).toBe("");
    expect(await run.fileSystem.isFile("site/notes/.github/workflows/deploy.yml")).toBe(true);
  });

  it("refuses a host it doesn't know, before asking anything", async () => {
    const prompter = new ScriptedPrompter([]);
    const run = await gensane(["init", "notes", "--deploy", "githb"], { prompter });
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toContain('gensane init can\'t publish on "githb"');
    expect(run.errors).toContain('did you mean "github"?');
    expect(prompter.asked).toEqual([]);
  });

  it("takes only one folder", async () => {
    const run = await gensane(["init", "one", "two", "--yes"]);
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toContain("gensane init takes one folder");
  });
});
