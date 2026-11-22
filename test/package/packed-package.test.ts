// The package as npm would publish it: built, packed, installed from the packed file into a new folder,
// and used there as a stranger would, through `node_modules/.bin/gensane`. Nothing is downloaded: the
// package has no dependencies, and npm runs offline.
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../../src/cli/package-name.ts";

const run = promisify(execFile);
const packageRoot = join(import.meta.dirname, "..", "..");
const folders: string[] = [];
afterAll(async () => {
  await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })));
});

async function newFolder(name: string): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), `gensane-${name}-`));
  folders.push(folder);
  return folder;
}

/**
 * The environment without npm's own settings: when the tests run inside `npm publish`, npm passes
 * settings such as `npm_config_dry_run` down, and the npm started here would follow them.
 */
const cleanEnvironment = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toLowerCase().startsWith("npm_")),
  );

const npm = (folder: string, ...args: string[]) =>
  run("npm", [...args, "--offline", "--no-audit", "--no-fund"], {
    cwd: folder,
    env: cleanEnvironment(),
  });

/** Builds into a copy of the package's files, so the repository's own `dist/` is left alone. */
async function packedPackage(): Promise<{ tarball: string; files: string[] }> {
  const copy = await newFolder("package");
  // What package.json lists in `files`, except dist/, which is built here.
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const listed = (manifest.files as string[]).filter((file) => file !== "dist");
  for (const file of ["package.json", "README.md", "LICENSE", ...listed]) {
    await cp(join(packageRoot, file), join(copy, file), { recursive: true });
  }
  await run(process.execPath, [
    join(packageRoot, "node_modules", "typescript", "bin", "tsc"),
    "-p",
    join(packageRoot, "tsconfig.build.json"),
    "--outDir",
    join(copy, "dist"),
  ]);
  const { stdout } = await npm(copy, "pack", "--json");
  const [packed] = JSON.parse(stdout) as [{ filename: string; files: { path: string }[] }];
  return { tarball: join(copy, packed.filename), files: packed.files.map(({ path }) => path) };
}

const gensane = (folder: string, ...args: string[]) =>
  run(join(folder, "node_modules", ".bin", "gensane"), args, {
    cwd: folder,
    env: { ...process.env, NO_COLOR: "1" },
  });

describe("the package as npm publishes it", { timeout: 120_000 }, () => {
  const packed = packedPackage();

  it("holds the program, its types, the default theme and the agent skill, and no tests, maps or sources", async () => {
    const { files } = await packed;
    expect(files).toContain("dist/cli/main.js");
    expect(files).toContain("dist/index.d.ts");
    expect(files).toContain("themes/default/base.html");
    expect(files).toContain("skills/gensane/SKILL.md");
    expect(files).toContain("skills/gensane/references/problems.md");
    expect(files).toContain("LICENSE");
    expect(files.filter((file) => /\.test\.|\.map$|^src\/|^test\//.test(file))).toEqual([]);
  });

  it("has every file its package.json points at", async () => {
    const { files } = await packed;
    const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    const pointedAt = [
      ...Object.values(manifest.bin as Record<string, string>),
      ...Object.values(manifest.exports["."] as Record<string, string>),
    ].map((path) => path.replace(/^\.\//, ""));
    expect(pointedAt.length).toBeGreaterThan(2);
    expect(pointedAt.filter((path) => !files.includes(path))).toEqual([]);
  });

  it("starts, builds and checks a site once it is installed from the packed file", async () => {
    const { tarball } = await packed;
    const folder = await newFolder("stranger");
    await npm(folder, "init", "--yes");
    await npm(folder, "install", tarball);
    expect((await gensane(folder, "--version")).stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);

    await gensane(folder, "init", "my-site", "--yes");
    const site = join(folder, "my-site");
    // The skill is found next to the installed program, as it ships in the package.
    const skill = await readFile(join(site, ".claude", "skills", "gensane", "SKILL.md"), "utf8");
    expect(skill).toBe(await readFile(join(packageRoot, "skills", "gensane", "SKILL.md"), "utf8"));
    await npm(site, "install", "--save-dev", tarball);
    const build = await gensane(site, "build");
    expect(build.stdout).toMatch(/^Built \d+ pages into dist/);
    expect(await readdir(join(site, "dist"))).toContain("index.html");
    expect(
      (await readFile(join(site, "dist", "assets", "style.css"), "utf8")).length,
    ).toBeGreaterThan(0);
    const check = await gensane(site, "check");
    expect(check.stdout).toMatch(/^Checked \d+ pages/);
  });

  it("can be published: not private, with a real version, and checked and built before it goes out", async () => {
    const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    expect(manifest.private).toBeUndefined();
    // npm refused the plain name `gensane` as too much like `gensync`, so it is in the `gensane` organization.
    expect(manifest.name).toBe(PACKAGE_NAME);
    // A package in an organization is private on npm unless it says otherwise.
    expect(manifest.publishConfig).toEqual({ access: "public" });
    expect(manifest.version).toMatch(/^(?!0\.0\.0$)\d+\.\d+\.\d+$/);
    // `npm publish` (npm 11) drops a command whose path starts with `./`, though `npm pack` keeps it.
    for (const path of Object.values(manifest.bin as Record<string, string>)) {
      expect(path).not.toMatch(/^\.\//);
    }
    // Every version says what changed in it.
    const changelog = await readFile(join(packageRoot, "CHANGELOG.md"), "utf8");
    expect(changelog).toContain(`\n## ${manifest.version}\n`);
    // `dist/` isn't in git, so publishing from a fresh copy must build it first.
    expect(manifest.scripts.prepublishOnly).toBe("pnpm check && pnpm build");
  });

  it("still packs inside `npm publish --dry-run`, which passes its settings down", async () => {
    process.env["npm_config_dry_run"] = "true";
    try {
      const { tarball } = await packedPackage();
      await expect(stat(tarball)).resolves.toBeTruthy();
    } finally {
      delete process.env["npm_config_dry_run"];
    }
  });

  it("tells npm where the code, the issues and the home page are", async () => {
    const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    expect(manifest).toMatchObject({
      repository: { url: "git+https://github.com/babaygt/gensane.git" },
      bugs: { url: "https://github.com/babaygt/gensane/issues" },
      homepage: "https://gensane.dev",
      license: "MIT",
    });
  });
});
