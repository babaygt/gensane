import { join } from "node:path";
import type { FileSystem } from "../../ports/index.ts";

/**
 * Where the skill goes in a site: the folder most coding agents read, and Claude Code's own. Copies,
 * not links, which break on Windows.
 */
export const SKILL_FOLDERS = [
  { path: ".agents/skills/gensane", readBy: "Codex, Copilot, Cursor, Gemini CLI and others" },
  { path: ".claude/skills/gensane", readBy: "Claude Code" },
] as const;

/**
 * Copies the skill that ships with this gensane into a site, in place of the one there, so a file
 * the new version no longer has doesn't stay behind. Says whether there was one.
 */
export async function addSkill(
  fileSystem: FileSystem,
  skill: string,
  site: string,
): Promise<"added" | "updated"> {
  const files = await fileSystem.listFiles(skill);
  let had = false;
  for (const { path } of SKILL_FOLDERS) {
    const target = join(site, path);
    if ((await fileSystem.listFiles(target)).length > 0) had = true;
    await fileSystem.removeFolder(target);
    for (const file of files) await fileSystem.copyFile(join(skill, file), join(target, file));
  }
  return had ? "updated" : "added";
}
