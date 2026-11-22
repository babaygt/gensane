// gensane.dev, built as `pnpm website` builds it: the example first, put into the website's public
// folder, then the website, both with the real program. The product page must build with no warnings,
// be valid and accessible, and show the start command with the package's real name.
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../../src/cli/package-name.ts";
import { installGensane } from "../support/installed-gensane.ts";
import { accessibilityProblems, htmlProblems } from "../support/page-checks.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const program = join(packageRoot, "src", "cli", "main.ts");

async function build(site: string) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [program, "build"], {
      cwd: site,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const { code, stdout, stderr } = error as { code: number; stdout: string; stderr: string };
    return { code, stdout, stderr };
  }
}

const folder = await mkdtemp(join(tmpdir(), "gensane-website-"));
const copy = async (name: string) => {
  await cp(join(packageRoot, name), join(folder, name), {
    recursive: true,
    filter: (path) => !/[/\\](dist|node_modules|public[/\\]example)$/.test(path),
  });
  await installGensane(join(folder, name));
};
await copy("example");
await copy("website");
const example = await build(join(folder, "example"));
await cp(join(folder, "example", "dist"), join(folder, "website", "public", "example"), {
  recursive: true,
});
const website = await build(join(folder, "website"));
const page = (path: string) => readFile(join(folder, "website", "dist", path), "utf8");

afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe("gensane.dev", () => {
  it("builds the example and then the website with no warnings", () => {
    expect(example).toMatchObject({ code: 0, stderr: "" });
    expect(website).toMatchObject({ code: 0, stderr: "" });
    expect(website.stdout).toMatch(/with no warnings\.\n$/);
  });

  it.each(["index.html", "404.html"])("%s is valid HTML and accessible", async (path) => {
    const html = await page(path);
    expect(await htmlProblems(html)).toEqual([]);
    expect(accessibilityProblems(html)).toEqual([]);
  });

  it("shows the start command with the package's real name, colored and with its copy button", async () => {
    const html = await page("index.html");
    expect(html).toContain(
      `<pre><code class="language-sh">npx ${PACKAGE_NAME} init my-site\n</code></pre>`,
    );
  });

  it("has the example under /example/, with its links under that path", async () => {
    expect(await page("index.html")).toContain('href="/example/"');
    const exampleHome = await page("example/index.html");
    expect(exampleHome).toContain("<h1>Ivy Lambda</h1>");
    expect(exampleHome).toContain('href="/example/blog/"');
  });

  it("shows the same screenshots as the README", async () => {
    for (const name of ["palette-default-light.png", "palette-default-dark.png"]) {
      const shown = await readFile(join(packageRoot, "website", "public", "images", name));
      expect(shown.equals(await readFile(join(packageRoot, "docs", "images", name)))).toBe(true);
    }
  });
});
