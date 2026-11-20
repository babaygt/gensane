// `gensane dev` with real HTTP on a free port, a site in memory and a watcher the tests trigger.
import { get } from "node:http";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { TEMPLATES } from "../../core/index.ts";
import {
  ManualWatcher,
  MemoryFileSystem,
  MemoryTerminal,
  type ModuleLoader,
} from "../../ports/index.ts";
import { ExitCode } from "../environment.ts";
import { runCli } from "../run-cli.ts";

const plainTheme = Object.fromEntries(
  Object.values(TEMPLATES).map((name) => [`site/theme/${name}`, "<h1>{{ page.title }}</h1>"]),
);
const HELLO = "---\ntitle: Hello\ndate: 2026-11-17\n---\nHi\n";
const PICTURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

/** Waits until `check` gives something, for up to three seconds. */
async function waitFor<T>(check: () => T | undefined): Promise<T> {
  for (let tries = 0; tries < 300; tries++) {
    const found = check();
    if (found !== undefined && found !== false) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("waited three seconds for something that didn't happen");
}

const running: (() => Promise<number>)[] = [];
afterEach(async () => {
  await Promise.all(running.splice(0).map((stop) => stop()));
});

async function startDev(
  files: Readonly<Record<string, string | Uint8Array>>,
  config: { default: Record<string, unknown> } = {
    default: { site: { url: "https://example.com" } },
  },
  args: readonly string[] = ["--port", "0"],
  moduleLoader: ModuleLoader = { load: async () => config },
) {
  const fileSystem = new MemoryFileSystem({
    ...plainTheme,
    "site/gensane.config.ts": "",
    ...files,
  });
  const watcher = new ManualWatcher();
  const terminal = new MemoryTerminal();
  const stop = new AbortController();
  const exit = runCli(["dev", ...args], {
    fileSystem,
    moduleLoader,
    clock: { now: () => new Date(0) },
    terminal,
    watcher,
    stopped: stop.signal,
    defaultTheme: "gensane/themes/default",
    siteFolder: "site",
    version: "1.2.3",
  });
  const stopDev = async () => {
    stop.abort();
    return exit;
  };
  running.push(stopDev);
  const output = () => terminal.output.join("\n");
  const address = await waitFor(() => /http:\/\/localhost:\d+/.exec(output())?.[0]);
  return { address, fileSystem, watcher, terminal, output, config, stop: stopDev };
}

/** Listens to the reload events, as a page in the browser does. */
async function listenForReloads(address: string) {
  let received = "";
  const request = get(`${address}/__gensane/events`, (response) => {
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => {
      received += chunk;
    });
  });
  request.on("error", () => {});
  await waitFor(() => received.includes(": connected"));
  return {
    count: () => received.split("event: reload").length - 1,
    close: () => request.destroy(),
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, { redirect: "manual" });
  return { status: response.status, body: await response.text(), headers: response.headers };
}

describe("gensane dev", () => {
  it("serves the site with drafts, and adds the reload script to its pages", async () => {
    const draft = "---\ntitle: Soon\ndate: 2026-11-18\ndraft: true\n---\n";
    const dev = await startDev({
      "site/content/blog/hello.md": HELLO,
      "site/content/blog/soon.md": draft,
    });
    expect(dev.output().split("\n")).toEqual([
      "Built 5 pages in 0 ms, with no warnings.",
      expect.stringMatching(
        /^Serving the site at http:\/\/localhost:\d+\/ \(press Ctrl\+C to stop\)\.$/,
      ),
    ]);
    const page = await fetchText(`${dev.address}/blog/soon/`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(page.body).toBe(
      '<h1>Soon</h1><script>new EventSource("/__gensane/events").addEventListener("reload", () => location.reload());</script>',
    );
  });

  it("builds again when a file changes, and reloads the open pages", async () => {
    const dev = await startDev({ "site/content/blog/hello.md": HELLO });
    const page = await listenForReloads(dev.address);
    await dev.fileSystem.writeText(
      "site/content/blog/hello.md",
      HELLO.replace("Hello", "Hello again"),
    );
    dev.watcher.change("content/blog/hello.md");

    await waitFor(() => page.count() === 1);
    expect((await fetchText(`${dev.address}/blog/hello/`)).body).toContain("<h1>Hello again</h1>");
    expect(dev.output().split("\n").at(-1)).toBe(
      "content/blog/hello.md changed. Rebuilt 4 pages in 0 ms, with no warnings.",
    );
    page.close();
  });

  it("builds once for many changes close together", async () => {
    const dev = await startDev({ "site/content/blog/hello.md": HELLO });
    const page = await listenForReloads(dev.address);
    dev.watcher.change("content/blog/hello.md");
    dev.watcher.change("theme/post.html");
    dev.watcher.change("content/blog/hello.md");
    await waitFor(() => page.count() === 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(page.count()).toBe(1);
    expect(dev.output().match(/Rebuilt/g)).toHaveLength(1);
    page.close();
  });

  it.each(["dist/index.html", "node_modules/a/b.js", ".git/index", "notes.txt"])(
    "doesn't build again when %s changes, because it isn't part of the site",
    async (path) => {
      const dev = await startDev({ "site/content/blog/hello.md": HELLO });
      dev.watcher.change(path);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(dev.output()).not.toContain("Rebuilt");
    },
  );

  it("uses the config again after it changes", async () => {
    const dev = await startDev(
      { "site/content/blog/hello.md": HELLO, "site/theme/post.html": "{{ site.title }}" },
      { default: { site: { url: "https://example.com", title: "Old" } } },
    );
    dev.config.default = { site: { url: "https://example.com", title: "New" } };
    const page = await listenForReloads(dev.address);
    dev.watcher.change("gensane.config.ts");
    await waitFor(() => page.count() === 1);
    expect((await fetchText(`${dev.address}/blog/hello/`)).body).toMatch(/^New<script>/);
    page.close();
  });

  it("shows the problems on every page while the site has errors, and the site once they are fixed", async () => {
    const dev = await startDev({ "site/content/blog/hello.md": HELLO });
    const page = await listenForReloads(dev.address);
    await dev.fileSystem.writeText("site/content/blog/hello.md", `${HELLO}See [x](/nowhere/).\n`);
    dev.watcher.change("content/blog/hello.md");
    await waitFor(() => page.count() === 1);

    const problems = await fetchText(`${dev.address}/`);
    expect(problems.status).toBe(500);
    expect(problems.body).toContain("<title>Found 1 error and 0 warnings</title>");
    expect(problems.body).toContain("  ┌─ content/blog/hello.md:6:9");
    expect(problems.body).toContain("<script>new EventSource");
    expect(dev.output().split("\n").at(-1)).toBe(
      "content/blog/hello.md changed. Found 1 error and 0 warnings; the browser shows them until they are fixed.",
    );
    expect(dev.terminal.errors.join("\n")).toContain('error[GS413]: "/nowhere/"');

    await dev.fileSystem.writeText("site/content/blog/hello.md", HELLO);
    dev.watcher.change("content/blog/hello.md");
    await waitFor(() => page.count() === 2);
    expect((await fetchText(`${dev.address}/`)).status).toBe(200);
    page.close();
  });

  it("adds the reload script only to pages, not to the feed", async () => {
    const dev = await startDev({ "site/content/blog/hello.md": HELLO });
    const feed = await fetchText(`${dev.address}/feed.xml`);
    expect(feed.body).toMatch(/^<\?xml/);
    expect(feed.body).not.toContain("<script>");
  });

  it("builds once more for a change that comes while a build is running, and names that change", async () => {
    const config = { default: { site: { url: "https://example.com" } } };
    let loads = 0;
    let release: (() => void) | undefined;
    let gate = Promise.resolve();
    const dev = await startDev({ "site/content/blog/hello.md": HELLO }, config, ["--port", "0"], {
      load: async () => {
        loads++;
        await gate;
        return config;
      },
    });
    gate = new Promise((resolve) => {
      release = resolve;
    });
    dev.watcher.change("content/blog/hello.md");
    await waitFor(() => loads === 2);
    dev.watcher.change("theme/post.html");
    await new Promise((resolve) => setTimeout(resolve, 100));
    gate = Promise.resolve();
    release?.();

    await waitFor(() => dev.output().match(/Rebuilt/g)?.length === 2);
    expect(dev.output().split("\n").slice(-2)).toEqual([
      "content/blog/hello.md changed. Rebuilt 4 pages in 0 ms, with no warnings.",
      "theme/post.html changed. Rebuilt 4 pages in 0 ms, with no warnings.",
    ]);
  });

  it("serves the files of the public folder as they are", async () => {
    const dev = await startDev({ "site/public/images/me.png": PICTURE });
    const response = await fetch(`${dev.address}/images/me.png`);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PICTURE);
  });

  it("serves the assets of the default theme", async () => {
    const dev = await startDev({ "gensane/themes/default/assets/style.css": "body {}" });
    const response = await fetchText(`${dev.address}/assets/style.css`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(response.body).toBe("body {}");
  });

  it("answers a public file deleted since the last build with 404", async () => {
    const dev = await startDev({ "site/public/images/me.png": PICTURE });
    await dev.fileSystem.removeFolder("site/public");
    expect((await fetch(`${dev.address}/images/me.png`)).status).toBe(404);
  });

  it("sends /blog/hello to /blog/hello/", async () => {
    const dev = await startDev({ "site/content/blog/hello.md": HELLO });
    const response = await fetchText(`${dev.address}/blog/hello`);
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/blog/hello/");
  });

  it("answers HEAD without a body, and refuses anything but GET and HEAD", async () => {
    const dev = await startDev({ "site/content/blog/hello.md": HELLO });
    const head = await fetch(`${dev.address}/`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const post = await fetch(`${dev.address}/`, { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
  });

  it("stops serving and watching when it is stopped", async () => {
    const dev = await startDev({ "site/content/blog/hello.md": HELLO });
    const page = await listenForReloads(dev.address);
    expect(dev.watcher.watching).toBe(1);
    expect(await dev.stop()).toBe(ExitCode.success);
    expect(dev.watcher.watching).toBe(0);
    await expect(fetch(`${dev.address}/`)).rejects.toThrow("fetch failed");
    page.close();
  });
});

it("stops at once when it is asked to stop before it has started, such as by Ctrl+C during the first build", async () => {
  const stop = new AbortController();
  stop.abort();
  const watcher = new ManualWatcher();
  const code = await runCli(["dev", "--port", "0"], {
    fileSystem: new MemoryFileSystem(plainTheme),
    moduleLoader: { load: async () => ({}) },
    clock: { now: () => new Date(0) },
    terminal: new MemoryTerminal(),
    watcher,
    stopped: stop.signal,
    defaultTheme: "gensane/themes/default",
    siteFolder: "site",
    version: "1.2.3",
  });
  expect(code).toBe(ExitCode.success);
  expect(watcher.watching).toBe(0);
});

describe("mistakes", () => {
  it("stops when the port is already in use", async () => {
    const other = createServer();
    await new Promise<void>((resolve) => other.listen(0, "localhost", resolve));
    const address = other.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const terminal = new MemoryTerminal();
    const code = await runCli(["dev", "--port", String(port)], {
      fileSystem: new MemoryFileSystem(plainTheme),
      moduleLoader: { load: async () => ({}) },
      clock: { now: () => new Date(0) },
      terminal,
      watcher: new ManualWatcher(),
      stopped: new AbortController().signal,
      defaultTheme: "gensane/themes/default",
      siteFolder: "site",
      version: "1.2.3",
    });
    other.close();
    expect(code).toBe(ExitCode.problems);
    expect(terminal.errors.join("\n")).toBe(
      `error: port ${port} is already in use\nhint: stop the other program that uses it, or choose another port, such as --port ${port + 1}`,
    );
  });

  it.each([["abc"], ["70000"], ["4000.5"], [""]])("refuses --port %j", async (port) => {
    const terminal = new MemoryTerminal();
    const code = await runCli(["dev", "--port", port], {
      fileSystem: new MemoryFileSystem(),
      moduleLoader: { load: async () => ({}) },
      clock: { now: () => new Date(0) },
      terminal,
      watcher: new ManualWatcher(),
      stopped: new AbortController().signal,
      defaultTheme: "gensane/themes/default",
      siteFolder: "site",
      version: "1.2.3",
    });
    expect(code).toBe(ExitCode.usage);
    expect(terminal.errors.join("\n")).toBe(
      `error: "${port}" is not a port\nhint: use a number from 1 to 65535, such as --port 4000`,
    );
  });
});
