// gensane.dev, built as `pnpm website` builds it: the example first, put into the website's public
// folder, then the website, both with the real program. The product page must build with no warnings,
// be valid and accessible, and show the start command with the package's real name.
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
// A small section, three levels deep, for the layout of the documentation.
const docs: Record<string, string> = {
  "index.md": "---\ntitle: Docs\n---\nAbout the docs.\n",
  "start.md":
    "---\ntitle: Start\norder: 1\n---\n## One\n\nText.\n\n## Two\n\nText.\n\n## Three\n\nText.\n",
  "guides/index.md": "---\ntitle: Guides\norder: 2\n---\nHow to.\n",
  "guides/search.md": "---\ntitle: Search\n---\nFind things.\n",
  "reference/cli/init.md": "---\ntitle: init\n---\nThe init command.\n",
};
for (const [path, text] of Object.entries(docs)) {
  const file = join(folder, "website", "content", "pages", "docs", path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
}
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

  it.each([
    "index.html",
    "404.html",
    "docs/index.html",
    "docs/start/index.html",
    "docs/guides/search/index.html",
    "docs/reference/cli/init/index.html",
  ])("%s is valid HTML and accessible", async (path) => {
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

describe("gensane.dev's documentation", () => {
  it("loads its stylesheet and script only on the pages of a section", async () => {
    const start = await page("docs/start/index.html");
    expect(start).toContain('<link rel="stylesheet" href="/assets/docs.css">');
    expect(start).toContain('<script type="module" src="/assets/docs.js"></script>');
    expect(await page("index.html")).not.toContain("docs.css");
  });

  it("shows the sidebar with the current page, the breadcrumbs, the contents and the neighbours", async () => {
    const start = await page("docs/start/index.html");
    expect(start).toContain('<nav class="docs-sidebar" aria-label="Docs">');
    expect(start).toContain('<a href="/docs/start/" aria-current="page">Start</a>');
    expect(start).toContain(
      '<li><a href="/docs/">Docs</a></li>\n<li aria-current="page">Start</li>',
    );
    expect(start).toContain('<nav class="toc" aria-label="Contents">');
    expect(start).toContain(
      '<a class="neighbour" href="/docs/" rel="prev"><span class="meta">← Previous</span>Docs</a>',
    );
    expect(start).toContain(
      '<a class="neighbour neighbour-next" href="/docs/guides/" rel="next"><span class="meta">Next →</span>Guides</a>',
    );
  });

  it("marks the current page three levels deep", async () => {
    const init = await page("docs/reference/cli/init/index.html");
    expect(init).toContain(
      '<li><a href="/docs/reference/cli/init/" aria-current="page">init</a></li>',
    );
    expect(init).toContain('<li>Reference</li>\n<li>Cli</li>\n<li aria-current="page">init</li>');
  });
});

describe("gensane.dev's documentation in a browser", { timeout: 30_000 }, () => {
  const types: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
  };
  const server = createServer(async (request, response) => {
    let path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (path.endsWith("/")) path += "index.html";
    try {
      const body = await readFile(join(folder, "website", "dist", path));
      response
        .writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" })
        .end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  let browser: Browser;
  let address = "";
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
    const listening = server.address();
    address = `http://localhost:${typeof listening === "object" && listening !== null ? listening.port : 0}`;
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    server.close();
  });

  /** A page of the section at a width, with or without JavaScript, and where its parts are. */
  async function sectionAt(width: number, javaScriptEnabled = true) {
    const context = await browser.newContext({
      viewport: { width, height: 800 },
      javaScriptEnabled,
    });
    const tab = await context.newPage();
    await tab.goto(`${address}/docs/start/`);
    const sidebar = await tab.locator(".docs-sidebar").boundingBox();
    const article = await tab.locator(".docs-page").boundingBox();
    return {
      open: await tab.evaluate<boolean>('document.querySelector(".docs-menu").open'),
      menuButton: await tab.locator(".docs-menu > summary").isVisible(),
      beside: sidebar !== null && article !== null && sidebar.x + sidebar.width <= article.x,
      articleWidth: article?.width ?? 0,
      tab,
      context,
    };
  }

  it("shows the sidebar beside the page on a computer, with the page at its reading width", async () => {
    const computer = await sectionAt(1280);
    expect([computer.open, computer.menuButton, computer.beside]).toEqual([true, false, true]);
    expect(computer.articleWidth).toBeGreaterThanOrEqual(600);
    await computer.context.close();
  });

  it("folds the sidebar into a menu on a phone, which opens with a tap", async () => {
    const phone = await sectionAt(390);
    expect([phone.open, phone.menuButton]).toEqual([false, true]);
    await phone.tab.locator(".docs-menu > summary").click();
    expect(await phone.tab.locator(".docs-sidebar a[aria-current='page']").isVisible()).toBe(true);
    await phone.context.close();
  });

  it("keeps the menu open without JavaScript, so nothing is hidden", async () => {
    const plain = await sectionAt(390, false);
    expect(plain.open).toBe(true);
    await plain.context.close();
  });
});
