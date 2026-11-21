// What only a real browser can show: search while typing, the switch between light and dark, the copy
// button of code blocks, the alignment of table columns, the reload after a change, and many open
// pages at once. A real `gensane dev` serves a site from a temporary folder, and Chromium, without a
// window, uses its pages. Code that runs in the page is written as text, because this project is
// type-checked without the browser's types.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.ts";
import { CALLOUT_COLORS } from "../../src/core/index.ts";
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
    'export default { site: { title: "Ada Lovelace\'s notes", url: "https://example.com" } };\n',
  "content/blog/2026-11-17-compilers.md": post(
    "Compilers",
    "2026-11-17",
    '```ts\nconst answer = 42; // the answer\nconst name = "Ada";\n```\n\n| Tool | Year | Since |\n| --- | :-: | --: |\n| pnpm | 2021 | 5 |\n',
  ),
  "content/blog/2026-11-18-parsers.md": post("Parsers", "2026-11-18", "A note on parsing.\n"),
  "content/pages/about.md": "---\ntitle: About\n---\nHello.\n",
  "content/pages/callouts.md": `---\ntitle: Callouts\n---\n${[
    "NOTE",
    "TIP",
    "IMPORTANT",
    "WARNING",
    "CAUTION",
  ]
    .map((kind) => `> [!${kind}]\n> A ${kind.toLowerCase()}.\n`)
    .join("\n")}`,
  "content/projects/lamp.md": "---\ntitle: Lamp\ndescription: A small lamp\n---\n",
  "content/projects/kettle.md":
    "---\ntitle: Kettle\ndescription: A kettle with a picture\ncover: /cover.svg\n---\n",
  "public/cover.svg":
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9"/></svg>\n',
  "content/talks/meetup.md": "---\ntitle: A meetup talk\nevent: Meetup\ndate: 2026-10-01\n---\n",
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

/** `#0861c9` as a browser writes a computed color, `rgb(8, 97, 201)`. */
function rgb(hex: string): string {
  const parts = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  return `rgb(${parts.join(", ")})`;
}

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

/** Where the parts of the header are, at a width of the window. */
async function headerAt(width: number) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${address}/`);
  const top = async (selector: string) =>
    Math.round((await page.locator(selector).boundingBox())?.y ?? -1);
  const menu = await Promise.all(
    (await page.locator(".site-menu a").all()).map(async (link) =>
      Math.round((await link.boundingBox())?.y ?? -1),
    ),
  );
  const result = {
    title: await top(".site-title"),
    menu,
    search: await top(".site-search button"),
    searchBox: await page.locator(".site-search input").isVisible(),
  };
  await context.close();
  return result;
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

  it("leads from the search button in the header to the search page, and searches there", async () => {
    const page = await open("/blog/");
    await page.click(".site-search button");
    await page.waitForURL(/\/search\/\?q=$/);
    await page.fill("#search-query", "compilers");
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

  it("shows a moon while the page is light, and a sun once it is dark", async () => {
    const page = await open("/");
    const visible = async (name: string) =>
      page.locator(`.scheme-switch .icon-${name}`).isVisible();
    await expect.poll(() => visible("moon")).toBe(true);
    expect(await visible("sun")).toBe(false);
    expect(await page.locator(".scheme-switch").getAttribute("aria-label")).toBe("Use dark colors");
    await page.locator(".scheme-switch").click();
    expect(await visible("sun")).toBe(true);
    expect(await visible("moon")).toBe(false);
    expect(await page.locator(".scheme-switch").getAttribute("aria-label")).toBe(
      "Use light colors",
    );
    await page.context().close();
  });

  it("keeps the header on one line on a computer, and the menu below the name on a phone", async () => {
    const computer = await headerAt(1280);
    expect(computer.menu.length).toBe(4);
    expect(new Set(computer.menu).size).toBe(1);
    expect(Math.abs((computer.menu[0] ?? 0) - computer.title)).toBeLessThan(12);
    expect(Math.abs(computer.search - computer.title)).toBeLessThan(12);
    // The box itself only fits next to the menu in the wide setting; the button leads to it.
    expect(computer.searchBox).toBe(false);

    const phone = await headerAt(390);
    expect(new Set(phone.menu).size).toBe(1);
    expect(phone.menu[0]).toBeGreaterThan(phone.title + 20);
    expect(Math.abs(phone.search - phone.title)).toBeLessThan(12);
    expect(phone.searchBox).toBe(false);
  });

  it("makes each card as tall as its own content, so one without a cover isn't stretched", async () => {
    const page = await open("/projects/");
    const heights = await Promise.all(
      (await page.locator(".card").all()).map(
        async (card) => (await card.boundingBox())?.height ?? 0,
      ),
    );
    expect(heights).toHaveLength(2);
    expect(Math.abs((heights[0] ?? 0) - (heights[1] ?? 0))).toBeGreaterThan(50);
    await page.context().close();
  });

  it("gives each kind of callout its own color and icon", async () => {
    const page = await open("/callouts/");
    const callouts = await page.evaluate<
      { kind: string; border: string; title: string; icon: string }[]
    >(
      `[...document.querySelectorAll(".callout")].map((callout) => {
        const title = callout.querySelector(".callout-title");
        const icon = getComputedStyle(title, "::before");
        return {
          kind: callout.className.replace("callout callout-", ""),
          border: getComputedStyle(callout).borderLeftColor,
          title: getComputedStyle(title).color,
          icon: icon.content === "none" ? "" : icon.maskImage,
        };
      })`,
    );
    expect(callouts.map(({ kind }) => kind)).toEqual([
      "note",
      "tip",
      "important",
      "warning",
      "caution",
    ]);
    for (const { kind, border, title, icon } of callouts) {
      const color = rgb(CALLOUT_COLORS.light[kind as keyof typeof CALLOUT_COLORS.light]);
      expect({ kind, border, title }).toEqual({ kind, border: color, title: color });
      expect(icon).toMatch(new RegExp(`/assets/callout-${kind}\\.svg"\\)$`));
    }
    await page.context().close();
  });

  it("colors code with the palette's colors", async () => {
    const page = await open("/blog/compilers/");
    const colors = await page.evaluate<Record<string, string>>(
      `(() => {
        const root = getComputedStyle(document.documentElement);
        const probe = document.createElement("span");
        document.body.append(probe);
        const colorOf = (name) => {
          probe.style.color = root.getPropertyValue(name);
          return getComputedStyle(probe).color;
        };
        const tokenColor = (kind) => getComputedStyle(document.querySelector(".hl-" + kind)).color;
        return {
          keyword: tokenColor("keyword") === colorOf("--accent"),
          string: tokenColor("string") === colorOf("--tip"),
          number: tokenColor("number") === colorOf("--warning"),
          comment: tokenColor("comment") === colorOf("--muted"),
        };
      })()`,
    );
    expect(colors).toEqual({ keyword: true, string: true, number: true, comment: true });
    await page.context().close();
  });

  it("labels a code block with its language, and copies it", async () => {
    const page = await open("/blog/compilers/");
    expect(await page.locator(".code-language").textContent()).toBe("ts");
    await page.locator(".code-copy").click();
    await expect.poll(() => page.locator(".code-copy").textContent()).toBe("Copied");
    expect(await page.evaluate<string>("navigator.clipboard.readText()")).toBe(
      'const answer = 42; // the answer\nconst name = "Ada";\n',
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

  it("keeps loading pages at once while many pages wait for the next build", async () => {
    // A browser opens at most six connections to a server; a page waiting for a reload must not use one.
    const context = await browser.newContext();
    const pages: Page[] = [];
    for (let count = 1; count <= 9; count++) {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`page ${count}: ${error.message}`));
      await page.goto(`${address}/blog/`, { timeout: 3_000 });
      pages.push(page);
    }
    expect(pages).toHaveLength(9);
    await context.close();
  });

  it("had no JavaScript errors on any page", () => {
    expect(errors).toEqual([]);
  });
});
