// Vitest compiles TypeScript itself, so `import()` inside a test accepts code that Node refuses, such as
// an enum. These tests run the loader in a separate Node process, as the command line will.
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const loaderUrl = pathToFileURL(join(import.meta.dirname, "module-loader.ts")).href;

const script = `
const { NodeModuleLoader } = await import(${JSON.stringify(loaderUrl)});
try {
  const exports = await new NodeModuleLoader().load(process.argv[1]);
  console.log(JSON.stringify({ exports }));
} catch (error) {
  console.log(JSON.stringify({ code: error.code ?? error.name, message: error.message }));
}`;

let folder = "";
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), "gensane-"));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

/** Writes a file and loads it in a new Node process. */
async function load(name: string, source: string): Promise<unknown> {
  await writeFile(join(folder, name), source);
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--input-type=module",
    "--no-warnings",
    "--eval",
    script,
    join(folder, name),
  ]);
  return JSON.parse(stdout);
}

describe("NodeModuleLoader", () => {
  it("runs a TypeScript file by removing its types", async () => {
    const source = "const perPage: number = 5;\nexport default { perPage };\n";
    expect(await load("typed.ts", source)).toEqual({ exports: { default: { perPage: 5 } } });
  });

  it.each(["config.js", "config.mjs"])("runs %s", async (name) => {
    const source = "export const site = { title: 'A' };\nexport default { perPage: 3 };\n";
    expect(await load(name, source)).toEqual({
      exports: { default: { perPage: 3 }, site: { title: "A" } },
    });
  });

  it("fails for TypeScript that needs compiling, such as an enum", async () => {
    const source = "enum Size { Small }\nexport default { perPage: Size.Small };\n";
    expect(await load("enum.ts", source)).toMatchObject({
      code: "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX",
    });
  });

  it("fails for a mistake in a JavaScript file", async () => {
    expect(await load("broken.mjs", "export default { perPage: 5\n")).toMatchObject({
      code: "SyntaxError",
    });
  });

  it("fails for a mistake in a TypeScript file with its own code", async () => {
    expect(await load("broken.ts", "export default { perPage: 5\n")).toMatchObject({
      code: "ERR_INVALID_TYPESCRIPT_SYNTAX",
    });
  });

  it("fails for a package that isn't installed, and names it", async () => {
    const source = 'import { defineConfig } from "gensane";\nexport default defineConfig({});\n';
    expect(await load("uninstalled.ts", source)).toMatchObject({
      code: "ERR_MODULE_NOT_FOUND",
      message: expect.stringContaining("Cannot find package 'gensane'"),
    });
  });

  it("runs a file again after it changed, as gensane dev needs", async () => {
    const path = join(folder, "changing.mjs");
    await writeFile(path, "export default 1;\n");
    const twice = `
const { NodeModuleLoader } = await import(${JSON.stringify(loaderUrl)});
const { writeFile } = await import("node:fs/promises");
const loader = new NodeModuleLoader();
const first = (await loader.load(process.argv[1])).default;
await writeFile(process.argv[1], "export default 2;\\n");
const second = (await loader.load(process.argv[1])).default;
console.log(JSON.stringify([first, second]));`;
    const { stdout } = await promisify(execFile)(process.execPath, [
      "--input-type=module",
      "--eval",
      twice,
      path,
    ]);
    expect(JSON.parse(stdout)).toEqual([1, 2]);
  });

  it("fails for a file that doesn't exist", async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [
      "--input-type=module",
      "--eval",
      script,
      join(folder, "missing.ts"),
    ]);
    expect(JSON.parse(stdout)).toMatchObject({ code: "ERR_MODULE_NOT_FOUND" });
  });
});
