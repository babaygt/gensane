import { describe, expect, it } from "vitest";
import { findViolations, importSpecifiers, moduleOf } from "./import-rules.ts";

describe("importSpecifiers", () => {
  it("finds static, type-only, re-export, side-effect and dynamic imports", () => {
    const text = [
      `import { a } from "./a.ts";`,
      `import type { B } from './b.ts';`,
      `export { c } from "./c.ts";`,
      `import "./side-effect.ts";`,
      `const d = await import("./d.ts");`,
    ].join("\n");
    expect(importSpecifiers(text)).toEqual([
      "./a.ts",
      "./b.ts",
      "./c.ts",
      "./side-effect.ts",
      "./d.ts",
    ]);
  });
});

describe("moduleOf", () => {
  it.each([
    ["src/markdown/lexer.ts", "markdown"],
    ["src/markdown/inline/emphasis.ts", "markdown"],
    ["src/index.ts", undefined],
    ["test/architecture/x.ts", undefined],
  ])("%s → %s", (path, expected) => {
    expect(moduleOf(path)).toBe(expected);
  });
});

describe("findViolations", () => {
  it("allows a pure module to import its own files", () => {
    const files = [{ path: "src/markdown/parser.ts", text: `import { lex } from "./lexer.ts";` }];
    expect(findViolations(files)).toEqual([]);
  });

  it("allows importing another module through its index", () => {
    const files = [
      { path: "src/markdown/parser.ts", text: `import { ok } from "../diagnostics/index.ts";` },
    ];
    expect(findViolations(files)).toEqual([]);
  });

  it("rejects deep imports into another module", () => {
    const files = [
      { path: "src/markdown/parser.ts", text: `import { ok } from "../diagnostics/result.ts";` },
    ];
    expect(findViolations(files)).toEqual([
      {
        file: "src/markdown/parser.ts",
        specifier: "../diagnostics/result.ts",
        rule: "deep-import-into-module",
      },
    ]);
  });

  it("applies the index rule to the package root too", () => {
    const files = [{ path: "src/index.ts", text: `export { ok } from "./diagnostics/result.ts";` }];
    expect(findViolations(files)).toHaveLength(1);
  });

  it.each([
    `import fs from "node:fs";`,
    `import { readFile } from "fs/promises";`,
    `import "path";`,
  ])("rejects Node built-ins in pure modules: %s", (text) => {
    const files = [{ path: "src/core/build.ts", text }];
    expect(findViolations(files).map((violation) => violation.rule)).toEqual([
      "pure-module-imports-node",
    ]);
  });

  it("treats a module it has never heard of as pure", () => {
    const files = [{ path: "src/brand-new-module/x.ts", text: `import "node:fs";` }];
    expect(findViolations(files).map((violation) => violation.rule)).toEqual([
      "pure-module-imports-node",
    ]);
  });

  it("allows Node built-ins in I/O modules", () => {
    const files = [
      { path: "src/ports/node-fs.ts", text: `import { readFile } from "node:fs/promises";` },
    ];
    expect(findViolations(files)).toEqual([]);
  });

  it("does not mistake a package that merely starts with a builtin name", () => {
    const files = [{ path: "src/core/x.ts", text: `import y from "pathological";` }];
    expect(findViolations(files)).toEqual([]);
  });
});
