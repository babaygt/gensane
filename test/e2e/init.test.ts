// The sites `gensane init` makes are built and checked with the real program, so a new site works from
// the first minute: with every default, and with answers of every kind. Without the site's address, the
// one warning is that the feed and the sitemap are left out.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import * as fc from "fast-check";
import { afterAll, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.ts";
import { DEPLOY_TARGETS } from "../../src/cli/init/deploy-files.ts";
import { SECTIONS } from "../../src/cli/init/starter-site.ts";
import { PALETTES } from "../../src/core/index.ts";
import {
  ManualWatcher,
  MemoryFileSystem,
  MemoryTerminal,
  ScriptedPrompter,
} from "../../src/ports/index.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const program = join(packageRoot, "src", "cli", "main.ts");
const folders: string[] = [];
afterAll(async () => {
  await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })));
});

async function newFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "gensane-init-"));
  folders.push(folder);
  return folder;
}

/** What `npm install` would do for the site: `import "gensane"` finds this package's source. */
async function installGensane(site: string): Promise<void> {
  const installed = join(site, "node_modules", "gensane");
  await mkdir(installed, { recursive: true });
  await writeFile(
    join(installed, "package.json"),
    '{ "name": "gensane", "type": "module", "exports": "./index.js" }\n',
  );
  const source = pathToFileURL(join(packageRoot, "src", "index.ts")).href;
  await writeFile(join(installed, "index.js"), `export * from ${JSON.stringify(source)};\n`);
}

async function gensane(folder: string, ...args: string[]) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [program, ...args], {
      cwd: folder,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const { code, stdout, stderr } = error as { code: number; stdout: string; stderr: string };
    return { code, stdout, stderr };
  }
}

/** The five characters templates escape, written out here again so the test doesn't trust the code it checks. */
function escaped(text: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

/** Builds and checks the site. The only warning allowed is the one for a site without an address. */
async function buildsAndChecks(
  site: string,
  { hasAddress }: { hasAddress: boolean },
): Promise<void> {
  await installGensane(site);
  const warnings = hasAddress ? [] : ["warning[GS411]"];
  for (const command of ["build", "check"]) {
    const run = await gensane(site, command);
    expect({
      command,
      code: run.code,
      warnings: run.stderr.match(/^\w+\[GS\d+\]/gm) ?? [],
    }).toEqual({
      command,
      code: 0,
      warnings,
    });
  }
}

it(
  "makes a site with every default that builds and checks with no warnings",
  { timeout: 30_000 },
  async () => {
    const folder = await newFolder();
    const init = await gensane(folder, "init", "my-site", "--yes");
    expect(init).toMatchObject({ code: 0, stderr: "" });
    await buildsAndChecks(join(folder, "my-site"), { hasAddress: false });
    expect(
      await readFile(join(folder, "my-site", "dist", "blog", "hello-world", "index.html"), "utf8"),
    ).toContain("Hello, world");
  },
);

it("doesn't wait for answers where nobody can give them", async () => {
  const folder = await newFolder();
  const run = await gensane(folder, "init", "my-site");
  expect(run.code).toBe(2);
  expect(run.stderr).toContain("use --yes to take every default");
});

it("makes a site that builds from any answers", { timeout: 240_000 }, async () => {
  const oneLine = fc
    .string({ unit: "grapheme", maxLength: 30 })
    .filter((text) => !/[\r\n]/.test(text));
  const answers = fc.record({
    title: oneLine,
    author: oneLine,
    url: fc.constantFrom("", "https://example.com", "https://ada.dev/notes"),
    sections: fc.subarray([...SECTIONS]),
    palette: fc.constantFrom(...Object.keys(PALETTES)),
    deploy: fc.constantFrom("none", ...DEPLOY_TARGETS),
  });
  await fc.assert(
    fc.asyncProperty(answers, async ({ title, author, url, sections, palette, deploy }) => {
      const fileSystem = new MemoryFileSystem();
      const prompter = new ScriptedPrompter([
        title,
        author,
        url,
        sections.join(", ") || ",",
        palette,
        deploy,
      ]);
      const code = await runCli(["init", "notes"], {
        fileSystem,
        moduleLoader: { load: async () => ({}) },
        clock: { now: () => new Date(2026, 10, 20) },
        terminal: new MemoryTerminal(),
        watcher: new ManualWatcher(),
        prompter,
        stopped: new AbortController().signal,
        defaultTheme: "gensane/themes/default",
        siteFolder: "/",
        version: "1.2.3",
      });
      expect(code).toBe(0);
      const site = await newFolder();
      for (const path of await fileSystem.listFiles("/notes")) {
        await mkdir(dirname(join(site, path)), { recursive: true });
        await writeFile(join(site, path), await fileSystem.readText(join("/notes", path)));
      }
      await buildsAndChecks(site, { hasAddress: url !== "" });
      const shownTitle = title.trim() === "" ? "Notes" : title.trim();
      expect(await readFile(join(site, "dist", "index.html"), "utf8")).toContain(
        escaped(shownTitle),
      );
    }),
    { numRuns: 12 },
  );
});
