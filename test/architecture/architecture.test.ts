import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { expect, it } from "vitest";
import { type SourceFile, findViolations } from "./import-rules.ts";

const packageRoot = join(import.meta.dirname, "..", "..");

async function loadSources(dir: string): Promise<SourceFile[]> {
  const entries = await readdir(join(packageRoot, dir), { recursive: true, withFileTypes: true });
  const tsFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".ts"));
  return Promise.all(
    tsFiles.map(async (e) => {
      const absolute = join(e.parentPath, e.name);
      const path = relative(packageRoot, absolute).split(sep).join("/");
      return { path, text: await readFile(absolute, "utf8") };
    }),
  );
}

it("src/ follows the module boundary rules", async () => {
  const files = await loadSources("src");
  expect(files.length).toBeGreaterThan(0);
  expect(findViolations(files)).toEqual([]);
});
