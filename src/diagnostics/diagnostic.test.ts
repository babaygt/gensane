import { describe, expect, it } from "vitest";
import { type Diagnostic, InternalError, assertNever, hasErrors } from "./diagnostic.ts";
import { spanOf } from "./span.ts";

const at = spanOf("a.md", "x", 0, 1);
const warning: Diagnostic = { code: "GS001", severity: "warning", message: "w", span: at };
const error: Diagnostic = { code: "GS002", severity: "error", message: "e", span: at };

describe("hasErrors", () => {
  it("is false when there are no diagnostics", () => {
    expect(hasErrors([])).toBe(false);
  });

  it("ignores warnings", () => {
    expect(hasErrors([warning, warning])).toBe(false);
  });

  it("is true when at least one diagnostic is an error", () => {
    expect(hasErrors([warning, error])).toBe(true);
  });
});

describe("assertNever", () => {
  it("throws an InternalError naming the unhandled value", () => {
    const unexpected = { kind: "mystery" } as never;
    expect(() => assertNever(unexpected)).toThrow(InternalError);
    expect(() => assertNever(unexpected)).toThrow('Unhandled case: {"kind":"mystery"}');
  });
});
