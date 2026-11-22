// Keeps the documentation of the command line true: every example is a site folder that the real
// `gensane` program runs on, in a temporary folder, and the test compares what it prints, its exit code
// and the files it writes with the page.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ExitCode } from "../../src/cli/index.ts";
import { ConfigCodes, checkConfig } from "../../src/config/index.ts";
import { TEMPLATES, themeCss, themeOf } from "../../src/core/index.ts";
import {
  type CliExample,
  type CliStep,
  countCliMarkers,
  findCliExamples,
  findCodeFences,
  findSection,
} from "./doc-rules.ts";
import { checkLinks } from "./link-checks.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const program = join(packageRoot, "src", "cli", "main.ts");
const docsFolder = join(packageRoot, "docs", "cli");
const pages = readdirSync(docsFolder).map((name) => ({
  name,
  path: join(docsFolder, name),
  text: readFileSync(join(docsFolder, name), "utf8"),
}));
const docsPage = (name: string): string => pages.find((page) => page.name === name)?.text ?? "";

/** The day the examples are written on. The real day in the output is shown as this one. */
const DOCS_TODAY = "2026-11-20";
/** Where the examples say the site folder is. */
const DOCS_FOLDER = "/home/ada/site";

const folders: string[] = [];
afterAll(async () => {
  await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })));
});

/**
 * A site folder with the example's files. Templates the example doesn't show print the page's title.
 * `node_modules/@gensane/cli` points at the source, so a config can `import { defineConfig } from "@gensane/cli"`.
 */
async function siteFolderOf(example: CliExample): Promise<string> {
  const site = await realpath(await mkdtemp(join(tmpdir(), "gensane-docs-")));
  folders.push(site);
  const theme = Object.fromEntries(
    Object.values(TEMPLATES).map((name) => [`theme/${name}`, "<h1>{{ page.title }}</h1>\n"]),
  );
  const gensanePackage = {
    "node_modules/@gensane/cli/package.json":
      '{ "name": "@gensane/cli", "type": "module", "exports": "./index.js" }\n',
    "node_modules/@gensane/cli/index.js": `export * from ${JSON.stringify(pathToFileURL(join(packageRoot, "src", "index.ts")).href)};\n`,
  };
  for (const [path, content] of Object.entries({ ...gensanePackage, ...theme, ...example.files })) {
    await mkdir(dirname(join(site, path)), { recursive: true });
    await writeFile(join(site, path), content);
  }
  return site;
}

interface Run {
  readonly output: string;
  readonly exitCode: number | null;
}

/** Runs the real program. `gensane dev` runs until it serves the site, and is then stopped with Ctrl+C. */
function gensane(site: string, args: readonly string[]): Promise<Run> {
  const dev = args[0] === "dev" && !args.includes("--help");
  const child = spawn(process.execPath, [program, ...args, ...(dev ? ["--port", "0"] : [])], {
    cwd: site,
    env: { ...process.env, NO_COLOR: "1", TZ: "UTC" },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
    if (dev && stdout.includes("Serving")) child.kill("SIGINT");
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  // Problems go to the error stream and the line at the end to the normal one, so this is the order a
  // terminal shows them in.
  return new Promise((resolve) => {
    child.on("close", (exitCode) => resolve({ output: stderr + stdout, exitCode }));
  });
}

/** What differs from run to run: the folder, the day, the time a build takes, and a free port. */
function normalized(text: string, site: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return text
    .replaceAll(site, DOCS_FOLDER)
    .replaceAll(today, DOCS_TODAY)
    .replaceAll(today.slice(0, 7), DOCS_TODAY.slice(0, 7))
    .replaceAll(/\b\d+ ms\b/g, "N ms")
    .replaceAll(/localhost:\d+/g, "localhost:4000")
    .trimEnd();
}

async function filesIn(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(folder.length + 1))
    .toSorted();
}

async function check(site: string, step: CliStep): Promise<void> {
  const run = await gensane(site, step.args);
  const listings: Record<string, string[]> = {};
  for (const folder of Object.keys(step.listings)) {
    listings[folder] = (await filesIn(join(site, folder))).map((path) => normalized(path, site));
  }
  const files: Record<string, string> = {};
  for (const path of Object.keys(step.files)) {
    files[normalized(path, site)] = normalized(
      await readFile(join(site, path.replace(DOCS_TODAY, new Date().toISOString().slice(0, 10))), "utf8"),
      site,
    );
  }
  const expected = (text: string) => normalized(text, site);
  expect({ command: step.args, output: normalized(run.output, site), exitCode: run.exitCode, listings, files }).toEqual({
    command: step.args,
    output: expected(step.output),
    exitCode: step.exitCode,
    listings: step.listings,
    files: Object.fromEntries(Object.entries(step.files).map(([path, text]) => [path, expected(text)])),
  });
}

describe.each(pages)("docs/cli/$name", ({ path, text }) => {
  checkLinks(path, text);

  it("checks every marked example", () => {
    expect(findCliExamples(text)).toHaveLength(countCliMarkers(text));
  });

  it("runs every console fence, so none can lose its marker and quietly stop being checked", () => {
    const consoles = findCodeFences(text).filter((fence) => fence.info === "console").length;
    const steps = findCliExamples(text).reduce((total, example) => total + example.steps.length, 0);
    expect(steps).toBe(consoles);
  });

  it.each(findCliExamples(text))("runs gensane $steps.0.args as documented", async (example) => {
    expect.hasAssertions();
    const site = await siteFolderOf(example);
    for (const step of example.steps) await check(site, step);
  });
});

describe("the documentation is complete", () => {
  const examples = pages.flatMap(({ text }) => findCliExamples(text));
  const commands = examples.flatMap(({ steps }) => steps.map(({ args }) => args.join(" ")));

  it.each(["--help", "build --help", "check --help", "init --help", "deploy --help", "new --help", "dev --help", "theme --help"])(
    "shows the output of gensane %s",
    (args) => {
      expect(commands).toContain(args);
    },
  );

  it.each(Object.values(ConfigCodes))("shows problem %s with an example", (code) => {
    const section = findSection(docsPage("problems.md"), `### ${code}`);
    const outputs = findCliExamples(section).flatMap(({ steps }) => steps.map(({ output }) => output));
    expect(outputs.join("\n")).toContain(`[${code}]`);
  });

  it("describes only problems that exist, and every one of them", () => {
    const documented = docsPage("problems.md").match(/^### (GS\d+)/gm) ?? [];
    expect(documented.map((heading) => heading.slice(4)).toSorted()).toEqual(Object.values(ConfigCodes).toSorted());
  });

  it("lists every exit code", () => {
    const table = findSection(docsPage("README.md"), "## Exit codes");
    const rows = [...table.matchAll(/^\| (\d) +\|/gm)].map(([, code]) => Number(code));
    expect(rows).toEqual(Object.values(ExitCode));
  });

  it("has a section for every setting of the config", () => {
    const result = checkConfig({ notASetting: true }, "gensane.config.ts");
    const hint = result.ok ? "" : (result.error[0]?.hint ?? "");
    const settings = hint.replace("the settings are ", "").split(/, | and /);
    expect(settings.length).toBeGreaterThan(1);
    for (const setting of settings) expect(docsPage("config.md")).toContain(`### \`${setting}\``);
  });

  it("lists every file of the default theme", () => {
    const table = findSection(docsPage("theme.md"), "## The files");
    const listed = [...table.matchAll(/^\| `([^`]+)`/gm)].map(([, file]) => file);
    const shipped = readdirSync(join(packageRoot, "themes", "default"), { recursive: true })
      .map(String)
      .filter((file) => file.includes("."))
      .map((file) => file.split("\\").join("/"));
    expect(listed.toSorted()).toEqual(shipped.toSorted());
  });

  it("lists every custom property the settings file writes", () => {
    const table = findSection(docsPage("theme.md"), "## Custom properties");
    const listed = [...table.matchAll(/^\| `--([a-z-]+)`/gm)].map(([, name]) => name);
    const written = [...themeCss(themeOf({})).matchAll(/  --([a-z-]+):/g)].map(([, name]) => name);
    expect(listed).toEqual([...new Set(written)]);
  });

  it("covers every source file in the code reference", () => {
    const reference = docsPage("code-reference.md");
    for (const module of ["cli", "config", "ports"]) {
      const sources = readdirSync(join(packageRoot, "src", module), { recursive: true })
        .map(String)
        .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
      for (const file of sources) {
        const path = `src/${module}/${file}`;
        expect(reference).toContain(`### [\`${path}\`](../../${path})`);
      }
    }
  });
});
