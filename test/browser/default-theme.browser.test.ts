// What only a real browser can show: search while typing, the switch between light and dark, the copy
// button of code blocks, the alignment of table columns, and the reload after a change. A real
// `gensane dev` serves a site from a temporary folder, and Chromium, without a window, uses its pages.
// Code that runs in the page is written as text, because this project is type-checked without the
// browser's types.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.ts";
import {
  MemoryTerminal,
  NodeFileSystem,
  NodeModuleLoader,
  NodeWatcher,
  SystemClock,
  ScriptedPrompter,
} from "../../src/ports/index.ts";

const defaultTheme = join(import.meta.dirname, "..", "..", "themes", "default");
const post = (title: string, date: string, body: string) =>
  `---\ntitle: ${title}\ndate: ${date}\ndescription: About ${title.toLowerCase()}\ntags: [testing]\n---\n${body}`;

const files: Record<string, string> = {
  "gensane.config.mjs":
    'export default { site: { title: "Ada\'s notes", url: "https://example.com" } };\n',
  "content/blog/2026-11-17-compilers.md": post(
    "Compilers",
    "2026-11-17",
    "```ts\nconst answer = 42;\n```\n\n| Tool | Year | Since |\n| --- | :-: | --: |\n| pnpm | 2021 | 5 |\n",
  ),
  "content/blog/2026-11-18-parsers.md": post("Parsers", "2026-11-18", "A note on parsing.\n"),
  "content/pages/about.md": "---\ntitle: About\n---\nHello.\n",
};

let site = "";
let address = "";
let browser: Browser;
const stop = new AbortController();
let stopped: Promise<number>;
const errors: string[] = [];

beforeAll(async () => {
  site = await mkdtemp(join(tmpdir(), "gensane-browser-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(site, path)), { recursive: true });
    await writeFile(join(site, path), content);
  }
  const terminal = new MemoryTerminal();
  stopped = runCli(["dev", "--port", "0"], {
    fileSystem: new NodeFileSystem(),
    moduleLoader: new NodeModuleLoader(),
    clock: new SystemClock(),
    terminal,
    watcher: new NodeWatcher(),
    prompter: new ScriptedPrompter(),
    stopped: stop.signal,
    defaultTheme,
    siteFolder: site,
    version: "1.2.3",
  });
  for (let tries = 0; tries < 500 && address === ""; tries++) {
    address = /http:\/\/localhost:\d+/.exec(terminal.output.join("\n"))?.[0] ?? "";
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  browser = await chromium.launch();
}, 30_000);

afterAll(async () => {
  await browser?.close();
  stop.abort();
  await stopped;
  await rm(site, { recursive: true, force: true });
});

/** A new page in light colors, which fails the test file on any JavaScript error. */
async function open(path: string): Promise<Page> {
  const context = await browser.newContext({ colorScheme: "light" });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: address });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${path}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${path}: ${message.text()}`);
  });
  await page.goto(`${address}${path}`);
  return page;
}

describe("in a real browser", { timeout: 30_000 }, () => {
  it("finds posts while the words are typed, best first", async () => {
    const page = await open("/search/");
    await page.fill("#search-query", "pars");
    await expect
      .poll(() => page.locator(".search-results a").allTextContents())
      .toEqual(["Parsers"]);
    await page.fill("#search-query", "testing");
    await expect
      .poll(() => page.locator(".search-results a").allTextContents())
      .toEqual(["Parsers", "Compilers"]);
    await expect.poll(() => page.locator(".search-status").textContent()).toBe("Results: 2");
    await page.fill("#search-query", "nothing here");
    await expect.poll(() => page.locator(".search-status").textContent()).toBe("Results: 0");
    await page.context().close();
  });

  it("searches from the box in the header of another page", async () => {
    const page = await open("/blog/");
    await page.fill(".site-search input", "compilers");
    await page.press(".site-search input", "Enter");
    await page.waitForURL(/\/search\/\?q=compilers$/);
    await expect
      .poll(() => page.locator(".search-results a").allTextContents())
      .toEqual(["Compilers"]);
    const link = await page.locator(".search-results a").getAttribute("href");
    expect(link).toBe("/blog/compilers/");
    await page.context().close();
  });

  it("switches between light and dark, and remembers it on the next page", async () => {
    const page = await open("/");
    const button = page.locator(".scheme-switch");
    await expect.poll(() => button.isVisible()).toBe(true);
    const background = () =>
      page.evaluate<string>("getComputedStyle(document.body).backgroundColor");
    const light = await background();
    await button.click();
    expect(await page.evaluate<string>("document.documentElement.dataset.colorScheme")).toBe(
      "dark",
    );
    expect(await background()).not.toBe(light);
    await page.goto(`${address}/blog/`);
    expect(await page.evaluate<string>("document.documentElement.dataset.colorScheme")).toBe(
      "dark",
    );
    await page.locator(".scheme-switch").click();
    expect(await background()).toBe(light);
    await page.context().close();
  });

  it("labels a code block with its language, and copies it", async () => {
    const page = await open("/blog/compilers/");
    expect(await page.locator(".code-language").textContent()).toBe("ts");
    await page.locator(".code-copy").click();
    await expect.poll(() => page.locator(".code-copy").textContent()).toBe("Copied");
    expect(await page.evaluate<string>("navigator.clipboard.readText()")).toBe(
      "const answer = 42;\n",
    );
    await page.context().close();
  });

  it("aligns table columns as the Markdown says, over the theme's own alignment", async () => {
    const page = await open("/blog/compilers/");
    const aligned = await page.evaluate<string[]>(
      '[...document.querySelectorAll("th, td")].map((cell) => getComputedStyle(cell).textAlign)',
    );
    expect(aligned).toEqual(["left", "center", "right", "left", "center", "right"]);
    await page.context().close();
  });

  it("reloads by itself after a file changes", async () => {
    const page = await open("/blog/parsers/");
    expect(await page.locator("h1").textContent()).toBe("Parsers");
    await writeFile(
      join(site, "content/blog/2026-11-18-parsers.md"),
      post("Parsers again", "2026-11-18", "Changed.\n"),
    );
    await expect
      .poll(() => page.locator("h1").textContent(), { timeout: 10_000 })
      .toBe("Parsers again");
    await page.context().close();
  });

  it("had no JavaScript errors on any page", () => {
    expect(errors).toEqual([]);
  });
});
