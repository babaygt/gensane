import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import type { FileSystem } from "./file-system.ts";

function codeOf(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

function isMissing(error: unknown): boolean {
  return codeOf(error) === "ENOENT";
}

/** The real disk. */
export class NodeFileSystem implements FileSystem {
  async listFiles(folder: string): Promise<string[]> {
    try {
      const entries = await readdir(folder, { recursive: true, withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split(sep).join("/"))
        .toSorted();
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  async isFile(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isFile();
    } catch (error) {
      // A path that goes through a file, such as `a.md/b.md`, fails with ENOTDIR.
      if (isMissing(error) || codeOf(error) === "ENOTDIR") return false;
      throw error;
    }
  }

  async readText(path: string): Promise<string> {
    return readFile(path, "utf8");
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(path));
  }

  async writeText(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  async copyFile(from: string, to: string): Promise<void> {
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to);
  }

  async removeFolder(folder: string): Promise<void> {
    await rm(folder, { recursive: true, force: true });
  }
}
