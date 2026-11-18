// Cases are adapted from the GitHub Flavored Markdown spec, section "Tables (extension)".
import { describe, expect, it } from "vitest";
import { parseBlocks } from "./block-parser.ts";
import { DiagnosticCodes } from "./diagnostic-codes.ts";
import { blocks } from "./test-helpers.ts";

const p = (text: string) => ({ kind: "paragraph", text });
const row = (...texts: string[]) => ({
  kind: "table-row",
  cells: texts.map((text) => ({ kind: "table-cell", text })),
});
const table = (alignments: string[], header: unknown, ...rows: unknown[]) => ({
  kind: "table",
  alignments,
  header,
  rows,
});
const plain = ["none", "none"];

describe("tables", () => {
  it.each([
    {
      name: "a header and one row",
      source: "| foo | bar |\n| --- | --- |\n| baz | bim |",
      expected: [table(plain, row("foo", "bar"), row("baz", "bim"))],
    },
    {
      name: "column alignment, without outer pipes",
      source: "| abc | defghi |\n:-: | -----------:\nbar | baz",
      expected: [table(["center", "right"], row("abc", "defghi"), row("bar", "baz"))],
    },
    {
      name: "escaped pipes",
      source: "| f\\|oo  |\n| ------ |\n| b\\|az |",
      expected: [table(["none"], row("f|oo"), row("b|az"))],
    },
    {
      name: "no body rows",
      source: "| abc | def |\n| --- | --- |",
      expected: [table(plain, row("abc", "def"))],
    },
    {
      name: "missing cells filled and excess cells ignored",
      source: "| abc | def |\n| --- | --- |\n| bar |\n| bar | baz | boo |",
      expected: [table(plain, row("abc", "def"), row("bar", ""), row("bar", "baz"))],
    },
    {
      name: "a row without pipes, ended by a blank line",
      source: "| abc | def |\n| --- | --- |\n| bar | baz |\nbar\n\nbar",
      expected: [table(plain, row("abc", "def"), row("bar", "baz"), row("bar", "")), p("bar")],
    },
    {
      name: "ended by another block",
      source: "| abc |\n| --- |\n| bar |\n> quote",
      expected: [
        table(["none"], row("abc"), row("bar")),
        { kind: "block-quote", children: [p("quote")] },
      ],
    },
    {
      name: "interrupting a paragraph: only the last line is the header",
      source: "intro\n| a |\n| - |",
      expected: [p("intro"), table(["none"], row("a"))],
    },
  ])("$name", ({ source, expected }) => {
    expect(blocks(source)).toEqual(expected);
  });

  describe("what is not a table", () => {
    it.each([
      {
        name: "a header and delimiter with different cell counts",
        source: "| abc | def |\n| --- |\n| bar |",
        expected: [p("| abc | def |\n| --- |\n| bar |")],
      },
      {
        name: "--- without a pipe, which stays a horizontal rule",
        source: "a\n---",
        expected: [p("a"), { kind: "thematic-break" }],
      },
      {
        name: "a delimiter that starts a list",
        source: "a | b\n- | -",
        expected: [
          p("a | b"),
          {
            kind: "list",
            ordered: false,
            tight: true,
            items: [{ kind: "list-item", children: [p("| -")] }],
          },
        ],
      },
      {
        name: "rows indented by four spaces",
        source: "    | a |\n    | - |",
        expected: [p("| a |\n| - |")],
      },
    ])("$name", ({ source, expected }) => {
      expect(blocks(source)).toEqual(expected);
    });
  });

  describe("inside containers", () => {
    it("works in a block quote", () => {
      expect(blocks("> | a |\n> | - |\n> | b |")).toEqual([
        { kind: "block-quote", children: [table(["none"], row("a"), row("b"))] },
      ]);
    });

    it("works in a list item", () => {
      expect(blocks("- | a |\n  | - |")).toEqual([
        {
          kind: "list",
          ordered: false,
          tight: true,
          items: [{ kind: "list-item", children: [table(["none"], row("a"))] }],
        },
      ]);
    });

    it("does not take a row from a line outside the quote", () => {
      expect(blocks("> | a |\n> | - |\n| b |")).toEqual([
        { kind: "block-quote", children: [table(["none"], row("a"))] },
        p("| b |"),
      ]);
    });

    it("does not take its delimiter from a line outside the quote", () => {
      expect(blocks("> | a |\n| - |")).toEqual([
        { kind: "block-quote", children: [p("| a |\n| - |")] },
      ]);
    });
  });

  describe("column count warning", () => {
    it("points at the delimiter row and names both counts", () => {
      const { diagnostics } = parseBlocks("| a | b |\n| - |", "post.md");
      expect(diagnostics).toEqual([
        expect.objectContaining({
          code: DiagnosticCodes.tableColumnMismatch,
          severity: "warning",
          message: expect.stringMatching(/\b2\b.*\b1\b/),
          span: expect.objectContaining({ start: { line: 2, column: 1, offset: 10 } }),
        }),
      ]);
    });

    it("also applies to the last line of a longer paragraph", () => {
      const { diagnostics } = parseBlocks("intro\n| a | b |\n| - |", "post.md");
      expect(diagnostics.map((d) => d.code)).toEqual([DiagnosticCodes.tableColumnMismatch]);
    });

    it.each([
      ["a valid table", "| a |\n| - |"],
      ["ordinary text", "one | two\nthree | four"],
      ["a code block", "```\n| a | b |\n| - |\n```"],
    ])("stays quiet for %s", (_, source) => {
      expect(parseBlocks(source, "post.md").diagnostics).toEqual([]);
    });
  });

  describe("source spans", () => {
    const source = "| ab | c |\n| -- | - |\n| d |";
    const [node] = parseBlocks(source, "a.md").document.children;
    const parsed = node?.kind === "table" ? node : undefined;

    it("cover the whole table", () => {
      expect(parsed?.span).toMatchObject({ start: { offset: 0 }, end: { offset: source.length } });
    });

    it("point each cell at its content", () => {
      const [first] = parsed?.header.cells ?? [];
      expect(first?.span).toEqual({
        file: "a.md",
        start: { line: 1, column: 3, offset: 2 },
        end: { line: 1, column: 5, offset: 4 },
      });
    });

    it("give a filled-in cell an empty span at the end of its row", () => {
      const filled = parsed?.rows[0]?.cells[1];
      expect(filled?.span.start).toEqual({ line: 3, column: 6, offset: source.length });
      expect(filled?.span.end).toEqual(filled?.span.start);
    });
  });
});
