import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ManualWatcher, NodeWatcher } from "./index.ts";

const folders: string[] = [];
afterAll(async () => {
  await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })));
});

async function waitFor(check: () => boolean): Promise<void> {
  for (let tries = 0; tries < 300 && !check(); tries++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("NodeWatcher", () => {
  it("tells which file changed in a folder inside the watched one, with / between its parts", async () => {
    const folder = await mkdtemp(join(tmpdir(), "gensane-watch-"));
    folders.push(folder);
    await mkdir(join(folder, "content", "blog"), { recursive: true });
    const changed: string[] = [];
    const stop = new NodeWatcher().watch(folder, (path) => changed.push(path));
    // Some systems start watching a moment after the call.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await writeFile(join(folder, "content", "blog", "hello.md"), "Hi");
    await waitFor(() => changed.includes("content/blog/hello.md"));
    stop();
    expect(changed).toContain("content/blog/hello.md");
  });

  it("tells nothing more once stopped", async () => {
    const folder = await mkdtemp(join(tmpdir(), "gensane-watch-"));
    folders.push(folder);
    const changed: string[] = [];
    const stop = new NodeWatcher().watch(folder, (path) => changed.push(path));
    stop();
    await writeFile(join(folder, "a.md"), "Hi");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(changed).toEqual([]);
  });
});

describe("ManualWatcher", () => {
  it("tells everyone watching, until they stop", () => {
    const watcher = new ManualWatcher();
    const first: string[] = [];
    const second: string[] = [];
    const stopFirst = watcher.watch("site", (path) => first.push(path));
    watcher.watch("site", (path) => second.push(path));
    watcher.change("content/a.md");
    stopFirst();
    watcher.change("content/b.md");
    expect(first).toEqual(["content/a.md"]);
    expect(second).toEqual(["content/a.md", "content/b.md"]);
    expect(watcher.watching).toBe(1);
  });
});
