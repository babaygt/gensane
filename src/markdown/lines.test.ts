import { describe, expect, it } from "vitest";
import { isBlank, leadingIndent, sliceLine, splitLines, stripColumns } from "./lines.ts";

describe("splitLines", () => {
  it("returns no lines for empty input", () => {
    expect(splitLines("")).toEqual([]);
  });

  it("records each line's text, offsets and 1-based number", () => {
    expect(splitLines("ab\ncd")).toEqual([
      { text: "ab", start: 0, end: 2, number: 1, lineStart: 0 },
      { text: "cd", start: 3, end: 5, number: 2, lineStart: 3 },
    ]);
  });

  it("does not create an extra empty line after a trailing newline", () => {
    expect(splitLines("ab\n").map((line) => line.text)).toEqual(["ab"]);
  });

  it("keeps empty lines in the middle", () => {
    expect(splitLines("a\n\nb").map((line) => line.text)).toEqual(["a", "", "b"]);
  });

  it.each([
    ["\\n", "a\nb"],
    ["\\r\\n", "a\r\nb"],
    ["\\r", "a\rb"],
  ])("accepts %s as a line ending", (_, source) => {
    const lines = splitLines(source);
    expect(lines.map((line) => line.text)).toEqual(["a", "b"]);
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

describe("sliceLine and stripColumns", () => {
  // Line 2 of "x\n  > abc".
  const line = { text: "  > abc", start: 2, end: 9, number: 2, lineStart: 2 };

  it("keep offsets pointing into the original source", () => {
    expect(sliceLine(line, 4)).toEqual({ text: "abc", start: 6, end: 9, number: 2, lineStart: 2 });
  });

  it("strip at most the requested width of whitespace", () => {
    expect(stripColumns(line, 1).text).toBe(" > abc");
    expect(stripColumns(line, 10).text).toBe("> abc");
  });

  it("count a tab as reaching the next tab stop", () => {
    const tabbed = { text: "\tabc", start: 0, end: 4, number: 1, lineStart: 0 };
    expect(stripColumns(tabbed, 2).text).toBe("abc");
  });
});
