// Runs the real `gensane` program in a temporary folder, to show that the real disk, the config loader
// and the terminal are joined correctly. Everything else is tested in memory.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterAll, expect, it } from "vitest";
import { TEMPLATES } from "../../src/core/index.ts";

const program = join(import.meta.dirname, "..", "..", "src", "cli", "main.ts");
const folders: string[] = [];
afterAll(async () => {
  await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })));
});

async function siteWith(files: Readonly<Record<string, string>>): Promise<string> {
  const site = await mkdtemp(join(tmpdir(), "gensane-site-"));
  folders.push(site);
  const theme = Object.fromEntries(
    Object.values(TEMPLATES).map((name) => [`theme/${name}`, "<h1>{{ page.title }}</h1>"]),
  );
  for (const [path, content] of Object.entries({ ...theme, ...files })) {
    await mkdir(dirname(join(site, path)), { recursive: true });
    await writeFile(join(site, path), content);
  }
  return site;
}

async function gensane(site: string, ...args: string[]) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [program, ...args], {
      cwd: site,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const { code, stdout, stderr } = error as { code: number; stdout: string; stderr: string };
    return { code, stdout, stderr };
  }
}

it("builds a site with a TypeScript config into dist/", async () => {
  const site = await siteWith({
    "gensane.config.ts":
      'const site: { title: string; url: string } = { title: "Ada", url: "https://example.com" };\nexport default { site };\n',
    "content/blog/hello.md": "---\ntitle: Hello\ndate: 2026-11-17\n---\nHi\n",
    "public/robots.txt": "User-agent: *\n",
  });
  const run = await gensane(site, "build");
  expect(run).toMatchObject({ code: 0, stderr: "" });
  expect(run.stdout).toMatch(/^Built 4 pages into dist in \d+ ms, with no warnings\.\n$/);
  const written = await readdir(join(site, "dist"), { recursive: true });
  expect(written.toSorted()).toContain("robots.txt");
  expect(await readFile(join(site, "dist", "blog", "hello", "index.html"), "utf8")).toBe(
    "<h1>Hello</h1>",
  );
});

it("fails the check of a site with a broken link, and shows where it is", async () => {
  const site = await siteWith({
    "content/blog/hello.md": "---\ntitle: Hello\ndate: 2026-11-17\n---\nSee [about](/abuot/).\n",
  });
  const run = await gensane(site, "check");
  expect(run.code).toBe(1);
  expect(run.stderr).toContain("  ┌─ content/blog/hello.md:5:13");
  expect(run.stdout).toBe("Found 1 error and 1 warning.\n");
});

it("explains a config that Node can't run", async () => {
  const site = await siteWith({
    "gensane.config.ts": "enum Size { Small }\nexport default { perPage: Size.Small };\n",
  });
  const run = await gensane(site, "build");
  expect(run.code).toBe(1);
  expect(run.stderr).toContain("error[GS502]: the config couldn't be loaded");
  expect(run.stderr).toContain("such as an enum");
});

it("exits with 2 for a command that doesn't exist", async () => {
  const run = await gensane(await siteWith({}), "biuld");
  expect(run).toEqual({
    code: 2,
    stdout: "",
    stderr: 'error: "biuld" is not a command\nhint: did you mean "build"?\n',
  });
});

it("shows the version from package.json", async () => {
  const { version } = JSON.parse(
    await readFile(join(import.meta.dirname, "..", "..", "package.json"), "utf8"),
  ) as { version: string };
  expect(await gensane(await siteWith({}), "--version")).toEqual({
    code: 0,
    stdout: `${version}\n`,
    stderr: "",
  });
});
