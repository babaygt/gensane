// The example site in `example/` is built and checked with the real program on every change: with no
// warnings, every page valid and accessible, and still showing every feature, so it stays a fair picture
// of what gensane can do.
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { installGensane } from "../support/installed-gensane.ts";
import { accessibilityProblems, htmlProblems } from "../support/page-checks.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const program = join(packageRoot, "src", "cli", "main.ts");

async function gensane(...args: string[]) {
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

// Built when the file loads, because the tests for each page are listed from the built site.
const site = await mkdtemp(join(tmpdir(), "gensane-example-"));
await cp(join(packageRoot, "example"), site, {
  recursive: true,
  filter: (path) => !/[/\\](dist|node_modules)$/.test(path),
});
await installGensane(site);
const build = await gensane("build");
// A failed build writes nothing; the first test then shows why, instead of this file failing to load.
const built =
  build.code === 0
    ? (await readdir(join(site, "dist"), { recursive: true }))
        .map((path) => path.split("\\").join("/"))
        .toSorted()
    : [];
const pages = await Promise.all(
  built
    .filter((path) => path.endsWith(".html"))
    .map(async (path) => [path, await readFile(join(site, "dist", path), "utf8")] as const),
);
const page = (path: string) => pages.find(([name]) => name === path)?.[1] ?? "";
const everyPage = pages.map(([, html]) => html).join("\n");

afterAll(async () => {
  await rm(site, { recursive: true, force: true });
});

describe("the example site", () => {
  it("builds with no warnings", () => {
    expect(build).toMatchObject({ code: 0, stderr: "" });
    expect(build.stdout).toMatch(/^Built \d+ pages into dist in \d+ ms, with no warnings\.\n$/);
  });

  it("passes gensane check with no warnings", async () => {
    const check = await gensane("check");
    expect(check).toMatchObject({ code: 0, stderr: "" });
    expect(check.stdout).toMatch(/with no warnings\.\n$/);
  });

  it.each(pages)("%s is valid HTML and accessible", async (_, html) => {
    expect(await htmlProblems(html)).toEqual([]);
    expect(accessibilityProblems(html)).toEqual([]);
  });

  it("links within the site under its path, /example/", () => {
    const local = [...everyPage.matchAll(/\s(?:href|src|action)="(\/[^"]*)"/g)].map(
      ([, url]) => url,
    );
    expect(local.length).toBeGreaterThan(100);
    expect(local.filter((url) => !url?.startsWith("/example/"))).toEqual([]);
  });

  it("has the feed, the sitemap, the search index and the settings of the theme", () => {
    for (const file of [
      "feed.xml",
      "sitemap.xml",
      "search-index.json",
      "assets/settings.css",
      "404.html",
    ]) {
      expect(built).toContain(file);
    }
  });

  it("uses the default palette, which the screenshots of the theme show", async () => {
    const settings = await readFile(join(site, "dist", "assets", "settings.css"), "utf8");
    expect(settings).toContain("--background: #ffffff;");
  });

  it("leaves out the draft, which only gensane dev shows", () => {
    expect(built.filter((path) => path.includes("type-checker"))).toEqual([]);
  });

  it.each([
    [
      "every kind of callout",
      "blog/property-based-testing/index.html",
      'class="callout callout-tip"',
    ],
    [
      "every kind of callout",
      "blog/property-based-testing/index.html",
      'class="callout callout-note"',
    ],
    [
      "every kind of callout",
      "blog/writing-a-tiny-parser/index.html",
      'class="callout callout-warning"',
    ],
    [
      "every kind of callout",
      "blog/mutation-testing-in-practice/index.html",
      'class="callout callout-caution"',
    ],
    [
      "every kind of callout",
      "blog/reading-a-stack-trace/index.html",
      'class="callout callout-important"',
    ],
    ["footnotes", "blog/property-based-testing/index.html", 'class="footnotes"'],
    [
      "a table with aligned columns",
      "blog/property-based-testing/index.html",
      '<th class="align-center">',
    ],
    ["a task list", "blog/property-based-testing/index.html", 'type="checkbox"'],
    ["a table of contents", "blog/property-based-testing/index.html", 'class="toc"'],
    ["code with its language", "blog/writing-a-tiny-parser/index.html", 'class="language-ts"'],
    ["a block quote", "blog/reading-a-stack-trace/index.html", "<blockquote>"],
    [
      "an image",
      "blog/why-static-sites/index.html",
      '<img src="/example/images/build-pipeline.svg"',
    ],
    ["raw HTML", "uses/index.html", "<kbd>Ctrl</kbd>"],
    ["a second page of posts", "blog/page/2/index.html", "<h1"],
    ["a page for each tag", "tags/compilers/index.html", "Why my site has no server"],
    ["a project's cover", "projects/index.html", 'src="/example/images/tiny-calc.svg"'],
    [
      "a project's website",
      "projects/tiny-calc/index.html",
      'href="https://example.com/tiny-calc"',
    ],
    ["a project's other links", "projects/tiny-calc/index.html", "Playground"],
    ["a talk's slides and video", "talks/index.html", "https://example.com/talks/properties/video"],
    ["experience", "about/index.html", "Compiler engineer, Made-up Labs"],
    ["education", "about/index.html", "BSc in Computer science, University of Nowhere"],
    ["featured projects on the home page", "index.html", "shrinkwrap"],
  ])("shows %s (%s)", (_, path, text) => {
    expect(page(path)).toContain(text);
  });
});
