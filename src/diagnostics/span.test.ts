import { describe, expect, it } from "vitest";
import { positionAt, spanOf } from "./span.ts";

describe("positionAt", () => {
  const text = "ab\ncde\n\nf";

  it.each([
    { offset: 0, line: 1, column: 1, label: "start of text" },
    { offset: 2, line: 1, column: 3, label: "the newline itself belongs to its line" },
    { offset: 3, line: 2, column: 1, label: "first char after a newline" },
    { offset: 7, line: 3, column: 1, label: "empty line" },
    { offset: 8, line: 4, column: 1, label: "last line without trailing newline" },
    { offset: 9, line: 4, column: 2, label: "end of text" },
  ])("maps offset $offset to $line:$column ($label)", ({ offset, line, column }) => {
    expect(positionAt(text, offset)).toEqual({ line, column, offset });
  });

  it("clamps offsets outside the text", () => {
    expect(positionAt(text, -5)).toEqual({ line: 1, column: 1, offset: 0 });
    expect(positionAt(text, 999)).toEqual({ line: 4, column: 2, offset: 9 });
  });

  it("handles empty text", () => {
    expect(positionAt("", 0)).toEqual({ line: 1, column: 1, offset: 0 });
  });
});

describe("spanOf", () => {
  it("builds a span across lines", () => {
    expect(spanOf("post.md", "# Hi\n*x", 5, 7)).toEqual({
      file: "post.md",
      start: { line: 2, column: 1, offset: 5 },
      end: { line: 2, column: 3, offset: 7 },
    });
  });
});
