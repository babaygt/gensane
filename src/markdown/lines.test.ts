import { describe, expect, it } from "vitest";
import { isBlank, leadingIndent, splitLines } from "./lines.ts";

describe("splitLines", () => {
  it("returns no lines for empty input", () => {
    expect(splitLines("")).toEqual([]);
  });

  it("records each line's text, offsets and 1-based number", () => {
    expect(splitLines("ab\ncd")).toEqual([
      { text: "ab", start: 0, end: 2, number: 1 },
      { text: "cd", start: 3, end: 5, number: 2 },
    ]);
  });

  it("does not create an extra empty line after a trailing newline", () => {
    expect(splitLines("ab\n").map((l) => l.text)).toEqual(["ab"]);
  });

  it("keeps empty lines in the middle", () => {
    expect(splitLines("a\n\nb").map((l) => l.text)).toEqual(["a", "", "b"]);
  });

  it.each([
    ["\\n", "a\nb"],
    ["\\r\\n", "a\r\nb"],
    ["\\r", "a\rb"],
  ])("accepts %s as a line ending", (_, source) => {
    const lines = splitLines(source);
    expect(lines.map((l) => l.text)).toEqual(["a", "b"]);
    expect(lines[1]?.start).toBe(source.length - 1);
  });
});

describe("leadingIndent", () => {
  it.each([
    { text: "abc", width: 0, length: 0 },
    { text: "  abc", width: 2, length: 2 },
    { text: "\tabc", width: 4, length: 1 },
    { text: "  \tabc", width: 4, length: 3, note: "tab jumps to the next multiple of 4" },
    { text: "     \tabc", width: 8, length: 6 },
    { text: "   ", width: 3, length: 3 },
  ])("$text → width $width", ({ text, width, length }) => {
    expect(leadingIndent(text)).toEqual({ width, length });
  });
});

describe("isBlank", () => {
  it.each(["", "   ", "\t", " \t "])("treats %j as blank", (text) => {
    expect(isBlank(text)).toBe(true);
  });

  it("treats any other character as content", () => {
    expect(isBlank("  x ")).toBe(false);
  });
});
