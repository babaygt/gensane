// The bar that asks before Google Analytics counts a visit, in a real browser: nothing goes to Google
// before "Allow", the choice is kept, and "Cookie settings" takes it back. A real `gensane dev` serves
// the site, and every request that leaves it is answered here, so Google is never reached. Code that
// runs in the page is written as text, because this project is type-checked without the browser's types.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.ts";
import {
  MemoryTerminal,
  NodeFileSystem,
  NodeModuleLoader,
  NodeWatcher,
  ScriptedPrompter,
  SystemClock,
} from "../../src/ports/index.ts";

const defaultTheme = join(import.meta.dirname, "..", "..", "themes", "default");
const files: Record<string, string> = {
  "gensane.config.mjs":
    'export default { site: { title: "Ada\'s notes" }, analytics: { google: "G-ABC123DEF4" } };\n',
  "content/pages/about.md": "---\ntitle: About\n---\nHello.\n",
  "content/pages/long.md": `---\ntitle: A long page\n---\n${"A paragraph long enough to fill the window.\n\n".repeat(60)}`,
};

let site = "";
let address = "";
let browser: Browser;
const stop = new AbortController();
let stopped: Promise<number>;
const errors: string[] = [];

beforeAll(async () => {
  site = await mkdtemp(join(tmpdir(), "gensane-consent-"));
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
    skill: join(import.meta.dirname, "..", "..", "skills", "gensane"),
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

/** A visitor: one browser, whose choice is kept between its pages, and the requests that left the site. */
async function visitor(): Promise<{ context: BrowserContext; outside: string[] }> {
  const context = await browser.newContext();
  const outside: string[] = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(address)) return route.continue();
    outside.push(url);
    // An empty script, so a page doesn't log an error for a script it couldn't load.
    return route.fulfill({ contentType: "text/javascript", body: "" });
  });
  return { context, outside };
}

async function open(context: BrowserContext, path: string): Promise<Page> {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${path}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${path}: ${message.text()}`);
  });
  await page.goto(`${address}${path}`);
  await page.waitForLoadState("networkidle");
  return page;
}

const fromGoogle = (urls: readonly string[]) =>
  urls.filter((url) => url.includes("googletagmanager.com"));

describe(
  "asking before Google Analytics counts a visit, in a real browser",
  { timeout: 30_000 },
  () => {
    it("asks, and sends nothing to Google before an answer", async () => {
      const { context, outside } = await visitor();
      const page = await open(context, "/");
      await expect.poll(() => page.locator(".consent").isVisible()).toBe(true);
      expect(await page.locator(".consent-settings").isVisible()).toBe(true);
      expect(await page.evaluate("typeof window.dataLayer")).toBe("undefined");
      expect(outside).toEqual([]);
      await context.close();
    });

    it("loads Google after Allow, and on every page after, without asking again", async () => {
      const { context, outside } = await visitor();
      const page = await open(context, "/");
      await page.getByRole("button", { name: "Allow" }).click();
      await expect
        .poll(() => fromGoogle(outside))
        .toEqual(["https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4"]);
      expect(await page.locator(".consent").isVisible()).toBe(false);
      expect(
        await page.evaluate(
          "JSON.stringify(Array.from(window.dataLayer, (command) => [...command]))",
        ),
      ).toMatch(/^\[\["js","[^"]+"\],\["config","G-ABC123DEF4"\]\]$/);
      const next = await open(context, "/about/");
      expect(await next.locator(".consent").isVisible()).toBe(false);
      expect(fromGoogle(outside)).toHaveLength(2);
      await context.close();
    });

    it("gives Google each command as the arguments of a call, which is all its script reads", async () => {
      const { context } = await visitor();
      const page = await open(context, "/");
      await page.getByRole("button", { name: "Allow" }).click();
      expect(
        await page.evaluate(
          "Array.from(window.dataLayer, (command) => Object.prototype.toString.call(command))",
        ),
      ).toEqual(["[object Arguments]", "[object Arguments]"]);
      await context.close();
    });

    it("loads Google once when Allow is chosen again from Cookie settings", async () => {
      const { context, outside } = await visitor();
      const page = await open(context, "/");
      await page.getByRole("button", { name: "Allow" }).click();
      await page.getByRole("button", { name: "Cookie settings" }).click();
      await page.getByRole("button", { name: "Allow" }).click();
      await page.waitForLoadState("networkidle");
      expect(fromGoogle(outside)).toHaveLength(1);
      expect(await page.evaluate("window.dataLayer.length")).toBe(2);
      await context.close();
    });

    it("sends nothing after No thanks, and doesn't ask again", async () => {
      const { context, outside } = await visitor();
      const page = await open(context, "/");
      await page.getByRole("button", { name: "No thanks" }).click();
      expect(await page.locator(".consent").isVisible()).toBe(false);
      const next = await open(context, "/about/");
      expect(await next.locator(".consent").isVisible()).toBe(false);
      expect(outside).toEqual([]);
      await context.close();
    });

    it("takes Allow back with Cookie settings: Google stops, and its cookies go", async () => {
      const { context } = await visitor();
      const page = await open(context, "/");
      await page.getByRole("button", { name: "Allow" }).click();
      // What Google's script would have set, since the one served here is empty.
      await page.evaluate(
        `document.cookie = "_ga=GA1.1.1; path=/"; document.cookie = "theme=dark; path=/"`,
      );
      await page.getByRole("button", { name: "Cookie settings" }).click();
      expect(await page.locator(".consent").isVisible()).toBe(true);
      expect(await page.evaluate("document.activeElement.textContent")).toBe("Allow");
      await page.getByRole("button", { name: "No thanks" }).click();
      expect(await page.evaluate("document.cookie")).toBe("theme=dark");
      expect(await page.evaluate('window["ga-disable-G-ABC123DEF4"]')).toBe(true);
      expect(await page.evaluate("document.activeElement.textContent")).toBe("Cookie settings");
      const next = await open(context, "/about/");
      expect(await next.locator(".consent").isVisible()).toBe(false);
      await context.close();
    });

    it("works from the keyboard alone", async () => {
      const { context, outside } = await visitor();
      const page = await open(context, "/");
      await page.getByRole("button", { name: "Allow" }).focus();
      await page.keyboard.press("Tab");
      expect(await page.evaluate("document.activeElement.textContent")).toBe("No thanks");
      await page.keyboard.press("Enter");
      expect(await page.locator(".consent").isVisible()).toBe(false);
      expect(outside).toEqual([]);
      await context.close();
    });

    it.each([390, 1000])(
      "floats a little above the bottom of the window, clear of its sides, %i px wide",
      async (width) => {
        const { context } = await visitor();
        const page = await context.newPage();
        await page.setViewportSize({ width, height: 400 });
        await page.goto(`${address}/long/`);
        const bar = page.locator(".consent");
        await expect.poll(() => bar.isVisible()).toBe(true);
        const box = await bar.boundingBox();
        const bottom = (box?.y ?? 0) + (box?.height ?? 0);
        expect(400 - bottom).toBeGreaterThanOrEqual(12);
        expect(400 - bottom).toBeLessThanOrEqual(32);
        expect(box?.x).toBeGreaterThanOrEqual(12);
        expect(width - (box?.x ?? 0) - (box?.width ?? 0)).toBeGreaterThanOrEqual(12);
        expect(await page.evaluate("document.documentElement.scrollWidth")).toBeLessThanOrEqual(
          width,
        );
        await context.close();
      },
    );

    it.each(["Allow", "No thanks"])("keeps the page where it was after %s", async (name) => {
      const { context } = await visitor();
      const page = await context.newPage();
      await page.setViewportSize({ width: 1000, height: 400 });
      await page.goto(`${address}/long/`);
      await expect.poll(() => page.locator(".consent").isVisible()).toBe(true);
      await page.getByRole("button", { name }).click();
      expect(await page.locator(".consent").isVisible()).toBe(false);
      expect(await page.evaluate("window.scrollY")).toBe(0);
      await context.close();
    });

    it("leaves focus where the reader is after a first answer, not on Cookie settings", async () => {
      const { context } = await visitor();
      const page = await open(context, "/long/");
      await page.getByRole("button", { name: "Allow" }).focus();
      await page.keyboard.press("Enter");
      expect(await page.evaluate("document.activeElement.textContent")).not.toBe("Cookie settings");
      await context.close();
    });

    it("keeps the page where it was after an answer from Cookie settings, though the button is far below", async () => {
      const { context } = await visitor();
      const page = await context.newPage();
      await page.setViewportSize({ width: 1000, height: 400 });
      await page.goto(`${address}/long/`);
      await page.getByRole("button", { name: "Allow" }).click();
      await page.getByRole("button", { name: "Cookie settings" }).click();
      await page.evaluate("window.scrollTo(0, 0)");
      await page.getByRole("button", { name: "No thanks" }).click();
      expect(await page.evaluate("window.scrollY")).toBe(0);
      expect(await page.evaluate("document.activeElement.textContent")).toBe("Cookie settings");
      await context.close();
    });

    it("keeps its space below at the very end of the page, after the footer", async () => {
      const { context } = await visitor();
      const page = await context.newPage();
      await page.setViewportSize({ width: 1000, height: 400 });
      await page.goto(`${address}/long/`);
      await expect.poll(() => page.locator(".consent").isVisible()).toBe(true);
      await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      const box = await page.locator(".consent").boundingBox();
      expect(400 - (box?.y ?? 0) - (box?.height ?? 0)).toBeGreaterThanOrEqual(12);
      await context.close();
    });

    it("had no JavaScript errors on any page", () => {
      expect(errors).toEqual([]);
    });
  },
);
