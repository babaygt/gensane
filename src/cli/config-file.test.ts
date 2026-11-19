import { describe, expect, it } from "vitest";
import { ConfigCodes } from "../config/index.ts";
import type { Diagnostic } from "../diagnostics/index.ts";
import { MemoryFileSystem, type ModuleLoader } from "../ports/index.ts";
import { loadConfig } from "./config-file.ts";

/** Loads every file the same way, and remembers which files it loaded. */
function loaderOf(load: () => unknown): ModuleLoader & { loaded: string[] } {
  const loaded: string[] = [];
  return {
    loaded,
    load: async (path) => {
      loaded.push(path);
      return load() as Record<string, unknown>;
    },
  };
}

function failingWith(error: unknown): ModuleLoader {
  return {
    load: async () => {
      throw error;
    },
  };
}

function nodeError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function problemsOf(result: { ok: boolean; error?: readonly Diagnostic[] }) {
  return (result.error ?? []).map(({ code, message, hint, span }) => ({
    code,
    message,
    hint,
    file: span.file,
  }));
}

describe("finding the config", () => {
  it("is fine without a config, and every setting keeps its default", async () => {
    const loader = loaderOf(() => ({}));
    const result = await loadConfig(new MemoryFileSystem(), loader, "site");
    expect(result).toEqual({ ok: true, value: { config: {}, file: undefined, warnings: [] } });
    expect(loader.loaded).toEqual([]);
  });

  it.each(["gensane.config.ts", "gensane.config.js", "gensane.config.mjs"])(
    "loads %s from the site folder",
    async (name) => {
      const fileSystem = new MemoryFileSystem({ [`site/${name}`]: "" });
      const loader = loaderOf(() => ({ default: { perPage: 5 } }));
      const result = await loadConfig(fileSystem, loader, "site");
      expect(result).toEqual({
        ok: true,
        value: { config: { perPage: 5 }, file: name, warnings: [] },
      });
      expect(loader.loaded).toEqual([`site/${name}`]);
    },
  );

  it("doesn't look for the config in other folders", async () => {
    const fileSystem = new MemoryFileSystem({ "site/content/gensane.config.ts": "" });
    const result = await loadConfig(
      fileSystem,
      loaderOf(() => ({})),
      "site",
    );
    expect(result.ok && result.value.file).toBeUndefined();
  });

  it("refuses two config files, because it can't know which one is meant", async () => {
    const fileSystem = new MemoryFileSystem({
      "site/gensane.config.ts": "",
      "site/gensane.config.mjs": "",
    });
    const loader = loaderOf(() => ({ default: {} }));
    const result = await loadConfig(fileSystem, loader, "site");
    expect(problemsOf(result)).toEqual([
      {
        code: ConfigCodes.twoConfigFiles,
        message: 'there are two config files: "gensane.config.ts" and "gensane.config.mjs"',
        hint: "keep one of them",
        file: "gensane.config.mjs",
      },
    ]);
    expect(loader.loaded).toEqual([]);
  });
});

describe("checking what the config exports", () => {
  it("uses the default export", async () => {
    const fileSystem = new MemoryFileSystem({ "site/gensane.config.ts": "" });
    const loader = loaderOf(() => ({ default: { perPage: 0 }, perPage: 5 }));
    const result = await loadConfig(fileSystem, loader, "site");
    expect(problemsOf(result)).toEqual([
      {
        code: ConfigCodes.wrongValue,
        message: '"perPage" must be a whole number above 0, but 0 is a number',
        hint: "write a number such as 10",
        file: "gensane.config.ts",
      },
    ]);
  });

  it("reports a config without a default export", async () => {
    const fileSystem = new MemoryFileSystem({ "site/gensane.config.ts": "" });
    const result = await loadConfig(
      fileSystem,
      loaderOf(() => ({ perPage: 5 })),
      "site",
    );
    expect(problemsOf(result).map(({ code }) => code)).toEqual([ConfigCodes.noSettings]);
  });

  it("keeps the warnings of the config", async () => {
    const fileSystem = new MemoryFileSystem({ "site/gensane.config.ts": "" });
    const loader = loaderOf(() => ({ default: { site: { titel: "A" } } }));
    const result = await loadConfig(fileSystem, loader, "site");
    expect(result.ok && result.value.warnings.map(({ code }) => code)).toEqual([
      ConfigCodes.misspelledSiteSetting,
    ]);
  });
});

describe("a config that can't be loaded", () => {
  const fileSystem = new MemoryFileSystem({ "site/gensane.config.ts": "" });

  it.each([
    [
      "TypeScript that needs compiling",
      nodeError(
        "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX",
        "TypeScript enum is not supported in strip-only mode",
      ),
      "Node runs the config by removing its types, so it can't use TypeScript that needs compiling, such as an enum; use a union of strings or an object instead",
    ],
    [
      "gensane not installed",
      nodeError(
        "ERR_MODULE_NOT_FOUND",
        "Cannot find package 'gensane' imported from /site/gensane.config.ts",
      ),
      "install gensane in the site folder: npm install --save-dev gensane",
    ],
    [
      "a mistake in TypeScript",
      nodeError("ERR_INVALID_TYPESCRIPT_SYNTAX", "Expected ',', got '<eof>'"),
      "fix the mistake in the config; running it with node shows where it is",
    ],
    [
      "a mistake in JavaScript",
      new SyntaxError("Unexpected end of input"),
      "fix the mistake in the config; running it with node shows where it is",
    ],
  ])("reports %s, with a hint", async (_, error, hint) => {
    const result = await loadConfig(fileSystem, failingWith(error), "site");
    expect(problemsOf(result)).toEqual([
      {
        code: ConfigCodes.notLoaded,
        message: `the config couldn't be loaded: ${error.message}`,
        hint,
        file: "gensane.config.ts",
      },
    ]);
  });

  it("shows only the first line of a long message", async () => {
    const error = new Error("first line\n    at somewhere\n    at somewhere else");
    const result = await loadConfig(fileSystem, failingWith(error), "site");
    expect(problemsOf(result)[0]?.message).toBe("the config couldn't be loaded: first line");
  });

  it("reports something thrown that isn't an error", async () => {
    const result = await loadConfig(fileSystem, failingWith("no"), "site");
    expect(problemsOf(result)[0]?.message).toBe("the config couldn't be loaded: no");
  });
});
