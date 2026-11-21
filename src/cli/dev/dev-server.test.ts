// The parts of the dev server that `gensane dev`'s own tests can't see from outside.
import { afterEach, describe, expect, it } from "vitest";
import { TEMPLATES } from "../../core/index.ts";
import {
  ManualWatcher,
  MemoryFileSystem,
  MemoryTerminal,
  ScriptedPrompter,
} from "../../ports/index.ts";
import { DevServer } from "./dev-server.ts";

const servers: DevServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function startServer(): Promise<{ server: DevServer; address: string }> {
  const theme = Object.fromEntries(
    Object.values(TEMPLATES).map((name) => [`site/theme/${name}`, "<h1>{{ page.title }}</h1>"]),
  );
  const server = new DevServer({
    fileSystem: new MemoryFileSystem({ ...theme, "site/gensane.config.ts": "" }),
    moduleLoader: { load: async () => ({ default: { site: { url: "https://example.com" } } }) },
    clock: { now: () => new Date(0) },
    terminal: new MemoryTerminal(),
    watcher: new ManualWatcher(),
    prompter: new ScriptedPrompter(),
    stopped: new AbortController().signal,
    defaultTheme: "gensane/themes/default",
    siteFolder: "site",
    version: "1.2.3",
  });
  servers.push(server);
  await server.build();
  const port = await server.listen(0);
  return { server, address: `ws://localhost:${port}/__gensane/reload` };
}

/** The number of open pages once it is the expected one, or after a second, whatever it is then. */
async function settled(server: DevServer, expected: number): Promise<number> {
  for (let tries = 0; tries < 200 && server.openPages !== expected; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return server.openPages;
}

describe("DevServer", () => {
  it("forgets a page once it closes, so it never writes to it again", async () => {
    const { server, address } = await startServer();
    const pages = [new WebSocket(address), new WebSocket(address)];
    expect(await settled(server, 2)).toBe(2);
    pages[0]?.close();
    expect(await settled(server, 1)).toBe(1);
    pages[1]?.close();
    expect(await settled(server, 0)).toBe(0);
  });
});
