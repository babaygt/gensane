import { posix } from "node:path";
import type { FileSystem } from "./file-system.ts";

/** `./site//content/` → `site/content`, so one file has one key. */
function normalize(path: string): string {
  const normalized = posix.normalize(path);
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function within(folder: string, path: string): string | undefined {
  if (folder === ".") return path;
  return path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : undefined;
}

/** Fails like Node does, with the same code. */
function failure(code: "ENOENT" | "ENOTDIR", path: string): Error {
  return Object.assign(new Error(`${code}: "${path}"`), { code });
}

/** A disk in memory, for tests. Text is kept as UTF-8 bytes, as on a disk. */
export class MemoryFileSystem implements FileSystem {
  readonly #files = new Map<string, Uint8Array>();

  constructor(files: Readonly<Record<string, string | Uint8Array>> = {}) {
    for (const [path, content] of Object.entries(files)) {
      this.#files.set(normalize(path), typeof content === "string" ? encode(content) : content);
    }
  }

  /** The exact bytes of a file, to check copies in tests. */
  bytesOf(path: string): Uint8Array {
    const bytes = this.#files.get(normalize(path));
    if (bytes === undefined) throw failure("ENOENT", path);
    return bytes;
  }

  async listFiles(folder: string): Promise<string[]> {
    const base = normalize(folder);
    if (this.#files.has(base)) throw failure("ENOTDIR", folder);
    return [...this.#files.keys()]
      .map((path) => within(base, path))
      .filter((path) => path !== undefined)
      .toSorted();
  }

  async isFile(path: string): Promise<boolean> {
    return this.#files.has(normalize(path));
  }

  async readText(path: string): Promise<string> {
    return new TextDecoder().decode(this.bytesOf(path));
  }

  async writeText(path: string, content: string): Promise<void> {
    this.#files.set(normalize(path), encode(content));
  }

  async copyFile(from: string, to: string): Promise<void> {
    this.#files.set(normalize(to), this.bytesOf(from));
  }

  async removeFolder(folder: string): Promise<void> {
    const base = normalize(folder);
    for (const path of this.#files.keys()) {
      if (path === base || within(base, path) !== undefined) this.#files.delete(path);
    }
  }
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
