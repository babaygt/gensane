import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { expect, it } from "vitest";
import { type SourceFile, findViolations } from "./import-rules.ts";

const packageRoot = join(import.meta.dirname, "..", "..");

async function loadSources(directory: string): Promise<SourceFile[]> {
  const entries = await readdir(join(packageRoot, directory), {
    recursive: true,
    withFileTypes: true,
  });
  const tsFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));
  return Promise.all(
    tsFiles.map(async (entry) => {
      const absolute = join(entry.parentPath, entry.name);
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
