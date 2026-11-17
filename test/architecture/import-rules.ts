import { builtinModules } from "node:module";
import { posix } from "node:path";

/**
 * Module boundary rules for `src/`. Each folder directly inside `src/` is a module.
 *
 * 1. Only I/O modules may import Node built-ins (`node:fs`, `path`, ...). Every other
 *    module must be pure: it works on data passed in and never touches files, network
 *    or the process. This keeps most of the code testable without any setup.
 * 2. Code outside a module imports it only through its `index.ts` (its public API),
 *    so a module's internal files can change without breaking other modules.
 *
 * The checker is a pure function over source text, so it can itself be unit-tested
 * with small in-memory examples before we trust it on the real code.
 */

/**
 * The only modules allowed to do I/O. Any module not listed here is treated as pure,
 * so a newly added module is checked automatically.
 */
export const IO_MODULES: ReadonlySet<string> = new Set(["ports", "cli"]);

export interface SourceFile {
  /** Path relative to the package root, POSIX separators, e.g. `src/markdown/lexer.ts`. */
  readonly path: string;
  readonly text: string;
}

export interface Violation {
  readonly file: string;
  readonly specifier: string;
  readonly rule: "pure-module-imports-node" | "deep-import-into-module";
}

const IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

const NODE_BUILTINS: ReadonlySet<string> = new Set(builtinModules);

export function importSpecifiers(text: string): string[] {
  return [...text.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? "");
}

/** `src/markdown/lexer.ts` → `markdown`; `src/index.ts` → undefined (package root). */
export function moduleOf(path: string): string | undefined {
  const parts = path.split("/");
  return parts[0] === "src" && parts.length > 2 ? parts[1] : undefined;
}

function isNodeBuiltin(specifier: string): boolean {
  return specifier.startsWith("node:") || NODE_BUILTINS.has(specifier.split("/")[0] ?? "");
}

function checkImport(file: SourceFile, specifier: string): Violation | undefined {
  const from = moduleOf(file.path);

  if (from !== undefined && !IO_MODULES.has(from) && isNodeBuiltin(specifier)) {
    return { file: file.path, specifier, rule: "pure-module-imports-node" };
  }

  if (!specifier.startsWith(".")) return undefined;

  const target = posix.normalize(posix.join(posix.dirname(file.path), specifier));
  const to = moduleOf(target);
  const crossesBoundary = to !== undefined && to !== from;
  if (crossesBoundary && target !== `src/${to}/index.ts`) {
    return { file: file.path, specifier, rule: "deep-import-into-module" };
  }
  return undefined;
}

export function findViolations(files: readonly SourceFile[]): Violation[] {
  return files.flatMap((file) =>
    importSpecifiers(file.text)
      .map((specifier) => checkImport(file, specifier))
      .filter((v): v is Violation => v !== undefined),
  );
}
