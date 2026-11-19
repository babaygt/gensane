// The in-memory file system stands in for the disk in tests, so it must behave like the disk. Both run
// the same tests here, and a property test runs the same random operations on both and compares them.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { type FileSystem, MemoryFileSystem, NodeFileSystem } from "./index.ts";

type Files = Record<string, string | Uint8Array>;

interface Setup {
  readonly fileSystem: FileSystem;
  /** The folder the files were put in. */
  readonly root: string;
  /** The exact bytes of a file, to check that copies are exact. */
  bytesOf(path: string): Promise<Uint8Array>;
}

const temporaryFolders: string[] = [];
afterAll(async () => {
  await Promise.all(temporaryFolders.map((folder) => rm(folder, { recursive: true, force: true })));
});

async function onDisk(files: Files): Promise<Setup> {
  const root = await mkdtemp(join(tmpdir(), "gensane-"));
  temporaryFolders.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return {
    fileSystem: new NodeFileSystem(),
    root,
    bytesOf: async (path) => new Uint8Array(await readFile(path)),
  };
}

async function inMemory(files: Files): Promise<Setup> {
  const root = "site";
  const fileSystem = new MemoryFileSystem(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [`${root}/${path}`, content]),
    ),
  );
  return { fileSystem, root, bytesOf: async (path) => fileSystem.bytesOf(path) };
}

const PICTURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe]);

describe.each([
  { name: "NodeFileSystem", setUp: onDisk },
  { name: "MemoryFileSystem", setUp: inMemory },
])("$name", ({ setUp }) => {
  describe("listFiles", () => {
    it("lists every file in a folder and its subfolders, sorted, with / between parts", async () => {
      const { fileSystem, root } = await setUp({
        "content/b.md": "",
        "content/blog/2026/a.md": "",
        "content/a.md": "",
        "other/c.md": "",
      });
      expect(await fileSystem.listFiles(`${root}/content`)).toEqual([
        "a.md",
        "b.md",
        "blog/2026/a.md",
      ]);
    });

    it("lists nothing for a folder that doesn't exist", async () => {
      const { fileSystem, root } = await setUp({ "content/a.md": "" });
      expect(await fileSystem.listFiles(`${root}/theme`)).toEqual([]);
    });

    it("doesn't list a file whose name only starts like the folder", async () => {
      const { fileSystem, root } = await setUp({ "content/a.md": "", "contents/b.md": "" });
      expect(await fileSystem.listFiles(`${root}/content`)).toEqual(["a.md"]);
    });

    it("accepts a folder written with a / at the end", async () => {
      const { fileSystem, root } = await setUp({ "content/a.md": "" });
      expect(await fileSystem.listFiles(`${root}/content/`)).toEqual(["a.md"]);
    });
  });

  describe("readText", () => {
    it("reads a file as UTF-8", async () => {
      const { fileSystem, root } = await setUp({ "a.md": "Grüße, 日本 ✓" });
      expect(await fileSystem.readText(`${root}/a.md`)).toBe("Grüße, 日本 ✓");
    });

    it("fails for a file that doesn't exist", async () => {
      const { fileSystem, root } = await setUp({});
      await expect(fileSystem.readText(`${root}/missing.md`)).rejects.toThrow("ENOENT");
    });
  });

  describe("writeText", () => {
    it("writes a file, making its folders first", async () => {
      const { fileSystem, root } = await setUp({});
      await fileSystem.writeText(`${root}/dist/blog/hello/index.html`, "<p>Hi</p>");
      expect(await fileSystem.readText(`${root}/dist/blog/hello/index.html`)).toBe("<p>Hi</p>");
    });

    it("replaces a file that is already there", async () => {
      const { fileSystem, root } = await setUp({ "a.txt": "old" });
      await fileSystem.writeText(`${root}/a.txt`, "new");
      expect(await fileSystem.readText(`${root}/a.txt`)).toBe("new");
    });
  });

  describe("copyFile", () => {
    it("copies the exact bytes, making the folders of the copy first", async () => {
      const { fileSystem, root, bytesOf } = await setUp({ "public/me.png": PICTURE });
      await fileSystem.copyFile(`${root}/public/me.png`, `${root}/dist/images/me.png`);
      expect(await bytesOf(`${root}/dist/images/me.png`)).toEqual(PICTURE);
      expect(await bytesOf(`${root}/public/me.png`)).toEqual(PICTURE);
    });

    it("fails for a file that doesn't exist", async () => {
      const { fileSystem, root } = await setUp({});
      await expect(fileSystem.copyFile(`${root}/a.png`, `${root}/b.png`)).rejects.toThrow("ENOENT");
    });
  });

  describe("removeFolder", () => {
    it("removes a folder and everything in it, and nothing else", async () => {
      const { fileSystem, root } = await setUp({
        "dist/index.html": "",
        "dist/blog/index.html": "",
        "distant/a.txt": "",
      });
      await fileSystem.removeFolder(`${root}/dist`);
      expect(await fileSystem.listFiles(`${root}/dist`)).toEqual([]);
      expect(await fileSystem.listFiles(`${root}/distant`)).toEqual(["a.txt"]);
    });

    it("does nothing for a folder that doesn't exist", async () => {
      const { fileSystem, root } = await setUp({ "a.txt": "" });
      await fileSystem.removeFolder(`${root}/dist`);
      expect(await fileSystem.listFiles(root)).toEqual(["a.txt"]);
    });
  });
});

describe("MemoryFileSystem", () => {
  it("treats ./ and repeated slashes like the disk does", async () => {
    const fileSystem = new MemoryFileSystem({ "./site//content/a.md": "A" });
    expect(await fileSystem.readText("site/content/./a.md")).toBe("A");
    expect(await fileSystem.listFiles("site")).toEqual(["content/a.md"]);
  });
});

/** A random operation, on a small set of names so that operations often meet the same files. */
type Operation =
  | { readonly kind: "write"; readonly path: string; readonly content: string }
  | { readonly kind: "copy"; readonly from: string; readonly to: string }
  | { readonly kind: "remove"; readonly folder: string }
  | { readonly kind: "list"; readonly folder: string }
  | { readonly kind: "read"; readonly path: string };

const folder = fc.constantFrom("", "a", "a/b", "c");
const fileName = fc.constantFrom("x.txt", "y.txt");
const filePath = fc
  .tuple(folder, fileName)
  .map(([parent, name]) => (parent === "" ? name : `${parent}/${name}`));

const operation: fc.Arbitrary<Operation> = fc.oneof(
  fc.record({ kind: fc.constant("write" as const), path: filePath, content: fc.string() }),
  fc.record({ kind: fc.constant("copy" as const), from: filePath, to: filePath }),
  fc.record({ kind: fc.constant("remove" as const), folder: fc.constantFrom("a", "a/b", "c") }),
  fc.record({ kind: fc.constant("list" as const), folder }),
  fc.record({ kind: fc.constant("read" as const), path: filePath }),
);

/** What an operation gave back, or that it failed. */
async function run(fileSystem: FileSystem, root: string, step: Operation): Promise<unknown> {
  const at = (path: string) => (path === "" ? root : `${root}/${path}`);
  try {
    switch (step.kind) {
      case "write":
        return await fileSystem.writeText(at(step.path), step.content);
      case "copy":
        return await fileSystem.copyFile(at(step.from), at(step.to));
      case "remove":
        return await fileSystem.removeFolder(at(step.folder));
      case "list":
        return await fileSystem.listFiles(at(step.folder));
      case "read":
        return await fileSystem.readText(at(step.path));
    }
  } catch {
    return "failed";
  }
}

it("the in-memory file system gives the same results as the disk for any operations", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(operation, { maxLength: 12 }), async (operations) => {
      const disk = await onDisk({});
      const memory = await inMemory({});
      for (const step of operations) {
        // A file and a folder can't have the same name on a disk, and no operation here makes one.
        expect(await run(memory.fileSystem, memory.root, step)).toEqual(
          await run(disk.fileSystem, disk.root, step),
        );
      }
      expect(await memory.fileSystem.listFiles(memory.root)).toEqual(
        await disk.fileSystem.listFiles(disk.root),
      );
    }),
    { numRuns: 60 },
  );
});
