import { describe, expect, it } from "vitest";
import {
  ManualWatcher,
  MemoryFileSystem,
  MemoryTerminal,
  ScriptedPrompter,
} from "../../ports/index.ts";
import { ExitCode } from "../environment.ts";
import { runCli } from "../run-cli.ts";

const SKILL = "gensane/skills/gensane";

async function gensane(args: readonly string[], files: Readonly<Record<string, string>> = {}) {
  const fileSystem = new MemoryFileSystem({
    [`${SKILL}/SKILL.md`]: "---\nname: gensane\n---\nThe skill.\n",
    [`${SKILL}/references/problems.md`]: "# Problems\n",
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
    defaultTheme: "gensane/themes/default",
    skill: SKILL,
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

describe("gensane skill add", () => {
  it("copies the skill into the folders that coding agents read, and says which agents read each", async () => {
    const run = await gensane(["skill", "add"]);
    expect(run.code).toBe(ExitCode.success);
    for (const folder of ["site/.agents/skills/gensane", "site/.claude/skills/gensane"]) {
      expect(await run.fileSystem.listFiles(folder)).toEqual([
        "SKILL.md",
        "references/problems.md",
      ]);
      expect(await run.fileSystem.readText(`${folder}/SKILL.md`)).toBe(
        "---\nname: gensane\n---\nThe skill.\n",
      );
    }
    expect(run.output).toBe(
      [
        "Added the gensane skill for coding agents:",
        "  .agents/skills/gensane/  read by Codex, Copilot, Cursor, Gemini CLI and others",
        "  .claude/skills/gensane/  read by Claude Code",
      ].join("\n"),
    );
  });

  it("replaces the skill that is there with the one of this version, after an update", async () => {
    const run = await gensane(["skill", "add"], {
      "site/.agents/skills/gensane/SKILL.md": "an older skill",
      "site/.claude/skills/gensane/SKILL.md": "an older skill",
      "site/.claude/skills/gensane/references/gone.md": "a reference this version doesn't have",
    });
    expect(run.code).toBe(ExitCode.success);
    expect(await run.fileSystem.readText("site/.claude/skills/gensane/SKILL.md")).toBe(
      "---\nname: gensane\n---\nThe skill.\n",
    );
    expect(await run.fileSystem.isFile("site/.claude/skills/gensane/references/gone.md")).toBe(
      false,
    );
    expect(run.output.split("\n")[0]).toBe("Updated the gensane skill for coding agents:");
  });

  it("leaves the other skills of the site alone", async () => {
    const run = await gensane(["skill", "add"], { "site/.agents/skills/mine/SKILL.md": "mine" });
    expect(await run.fileSystem.readText("site/.agents/skills/mine/SKILL.md")).toBe("mine");
  });

  it.each([
    [[], "gensane skill needs add after it", "use: gensane skill add"],
    [["ad"], '"ad" is not something gensane skill does', 'did you mean "add"?'],
    [["add", "more"], '"add more" is not something gensane skill does', "use: gensane skill add"],
  ])("refuses gensane skill %j, and says how to use it", async (rest, mistake, hint) => {
    const run = await gensane(["skill", ...rest]);
    expect(run.code).toBe(ExitCode.usage);
    expect(run.errors).toContain(mistake);
    expect(run.errors).toContain(hint);
    expect(await run.fileSystem.listFiles("site")).toEqual([]);
  });
});
