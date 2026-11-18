// Block quotes and lists contain other blocks. Cases are adapted from the CommonMark
// spec sections "Block quotes", "List items" and "Lists".
import { describe, expect, it } from "vitest";
import { parseBlocks } from "./block-parser.ts";
import { DiagnosticCodes } from "../diagnostic-codes.ts";
import { markdownToHtml } from "../index.ts";
import { blocks } from "../test-helpers.ts";

const paragraph = (text: string) => ({ kind: "paragraph", text });
const quote = (...children: unknown[]) => ({ kind: "block-quote", children });
const item = (...children: unknown[]) => ({ kind: "list-item", children });
const bullets = (tight: boolean, ...items: unknown[]) => ({
  kind: "list",
  ordered: false,
  tight,
  items,
});
const numbered = (start: number, tight: boolean, ...items: unknown[]) => ({
  kind: "list",
  ordered: true,
  start,
  tight,
  items,
});

describe("block quotes", () => {
  it.each([
    { name: "a simple quote", source: "> a\n> b", expected: [quote(paragraph("a\nb"))] },
    { name: "no space after >", source: ">a", expected: [quote(paragraph("a"))] },
    {
      name: "other blocks inside",
      source: "> # Title\n> text",
      expected: [quote({ kind: "heading", level: 1, text: "Title" }, paragraph("text"))],
    },
    {
      name: "paragraphs separated by an empty > line",
      source: "> a\n>\n> b",
      expected: [quote(paragraph("a"), paragraph("b"))],
    },
    { name: "nested quotes", source: "> > a", expected: [quote(quote(paragraph("a")))] },
    { name: "an empty quote", source: ">", expected: [quote()] },
    {
      name: "a list inside",
      source: "> - a\n> - b",
      expected: [quote(bullets(true, item(paragraph("a")), item(paragraph("b"))))],
    },
    {
      name: "ending at a blank line",
      source: "> a\n\nb",
      expected: [quote(paragraph("a")), paragraph("b")],
    },
    {
      name: "interrupting a paragraph",
      source: "a\n> b",
      expected: [paragraph("a"), quote(paragraph("b"))],
    },
  ])("$name", ({ source, expected }) => {
    expect(blocks(source)).toEqual(expected);
  });

  describe("lazy continuation", () => {
    it("continues a paragraph on a line without >", () => {
      expect(blocks("> a\nb")).toEqual([quote(paragraph("a\nb"))]);
    });

    it("works through nested quotes", () => {
      expect(blocks("> > a\nb")).toEqual([quote(quote(paragraph("a\nb")))]);
    });

    it("does not continue a code block: the quote ends instead", () => {
      expect(blocks("> ```\n> code\nb")).toEqual([
        quote({ kind: "code", infoString: "", text: "code\n" }),
        paragraph("b"),
      ]);
    });

    it("does not apply to lines that start a new block", () => {
      expect(blocks("> a\n---")).toEqual([quote(paragraph("a")), { kind: "thematic-break" }]);
    });

    it("ends the quote at a lazy line that can't continue a paragraph", () => {
      expect(blocks("> ```\n> x\nb\n> y")).toEqual([
        quote({ kind: "code", infoString: "", text: "x\n" }),
        paragraph("b"),
        quote(paragraph("y")),
      ]);
    });

    // Regression: an earlier version re-parsed a container's content for every lazy
    // line, which took minutes at this depth. No timing assertion (that would be flaky);
    // Vitest's 5 second test timeout fails the test if the slow behaviour comes back.
    it("handles deep nesting with many lazy lines", () => {
      const source = `${"> ".repeat(200)}a\n${"b\n".repeat(200)}`;
      let node = blocks(source)[0] as { kind: string; children: unknown[] };
      let depth = 0;
      while (node.kind === "block-quote") {
        depth++;
        node = node.children[0] as typeof node;
      }
      expect(depth).toBe(200);
      expect(node).toEqual(paragraph(`a${"\nb".repeat(200)}`));
    });
  });
});

describe("lists", () => {
  it.each([
    {
      name: "bullet list",
      source: "- a\n- b",
      expected: [bullets(true, item(paragraph("a")), item(paragraph("b")))],
    },
    {
      name: "ordered list",
      source: "1. a\n2. b",
      expected: [numbered(1, true, item(paragraph("a")), item(paragraph("b")))],
    },
    {
      name: "ordered list starting at 3",
      source: "3) a",
      expected: [numbered(3, true, item(paragraph("a")))],
    },
    {
      name: "a new list when the bullet character changes",
      source: "- a\n+ b",
      expected: [bullets(true, item(paragraph("a"))), bullets(true, item(paragraph("b")))],
    },
    {
      name: "a new list when the number delimiter changes",
      source: "1. a\n1) b",
      expected: [numbered(1, true, item(paragraph("a"))), numbered(1, true, item(paragraph("b")))],
    },
    {
      name: "nested list by indentation",
      source: "- a\n  - b\n- c",
      expected: [
        bullets(
          true,
          item(paragraph("a"), bullets(true, item(paragraph("b")))),
          item(paragraph("c")),
        ),
      ],
    },
    {
      name: "code block inside an item",
      source: "- a\n  ```\n  code\n  ```",
      expected: [
        bullets(true, item(paragraph("a"), { kind: "code", infoString: "", text: "code\n" })),
      ],
    },
    {
      name: "quote inside an item",
      source: "- a\n  > q",
      expected: [bullets(true, item(paragraph("a"), quote(paragraph("q"))))],
    },
    {
      name: "an empty item",
      source: "- a\n-\n- c",
      expected: [bullets(true, item(paragraph("a")), item(), item(paragraph("c")))],
    },
    {
      name: "content column set by the spaces after the marker",
      source: "-   a\n    b",
      expected: [bullets(true, item(paragraph("a\nb")))],
    },
    {
      name: "ending at a blank line followed by unindented text",
      source: "- a\n\nb",
      expected: [bullets(true, item(paragraph("a"))), paragraph("b")],
    },
    {
      name: "interrupting a paragraph",
      source: "a\n- b",
      expected: [paragraph("a"), bullets(true, item(paragraph("b")))],
    },
    {
      name: "not interrupting a paragraph when ordered and not starting at 1",
      source: "a\n2. b",
      expected: [paragraph("a\n2. b")],
    },
    {
      name: "* * * is a thematic break, not a list",
      source: "* * *",
      expected: [{ kind: "thematic-break" }],
    },
    {
      name: "- - - is a thematic break, not a list",
      source: "- - -",
      expected: [{ kind: "thematic-break" }],
    },
    { name: "-a is not a list item", source: "-a", expected: [paragraph("-a")] },
  ])("$name", ({ source, expected }) => {
    expect(blocks(source)).toEqual(expected);
  });

  describe("tight and loose", () => {
    it.each([
      { name: "blank line between items", source: "- a\n\n- b" },
      { name: "several blank lines between items", source: "1. a\n\n\n2. b" },
      { name: "blank line between two blocks of one item", source: "- a\n\n  b" },
      { name: "blank line inside a later item", source: "- a\n- b\n\n  c" },
    ])("is loose with a $name", ({ source }) => {
      const [list] = blocks(source);
      expect(list).toMatchObject({ kind: "list", tight: false });
    });

    it("stays tight when only a nested list is loose", () => {
      const [list] = blocks("- a\n  - b\n\n  - c");
      expect(list).toMatchObject({
        tight: true,
        items: [{ children: [paragraph("a"), { kind: "list", tight: false }] }],
      });
    });
  });

  describe("lazy continuation", () => {
    it("continues a paragraph on an unindented line", () => {
      expect(blocks("- a\nb")).toEqual([bullets(true, item(paragraph("a\nb")))]);
    });

    it("continues a paragraph on an under-indented line", () => {
      expect(blocks("- a\n b")).toEqual([bullets(true, item(paragraph("a\nb")))]);
    });

    it("does not apply after a blank line", () => {
      expect(blocks("- a\n\n b")).toEqual([bullets(true, item(paragraph("a"))), paragraph("b")]);
    });
  });

  it("warns about indented code when the content starts 5+ spaces after the marker", () => {
    const { diagnostics } = parseBlocks("-      a", "test.md");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      DiagnosticCodes.indentedCode,
    ]);
  });
});

describe("source spans in containers", () => {
  it("cover the quote markers, while inner blocks start after them", () => {
    const [blockQuote] = parseBlocks("> a\n> b", "a.md").document.children;
    expect(blockQuote?.span).toMatchObject({ start: { offset: 0 }, end: { offset: 7 } });
    expect(blockQuote?.kind === "block-quote" && blockQuote.children[0]?.span).toEqual({
      file: "a.md",
      start: { line: 1, column: 3, offset: 2 },
      end: { line: 2, column: 4, offset: 7 },
    });
  });

  it("give each list item its own span", () => {
    const [list] = parseBlocks("- a\n- b", "a.md").document.children;
    const items = list?.kind === "list" ? list.items : [];
    expect(items.map((listItem) => [listItem.span.start.offset, listItem.span.end.offset])).toEqual(
      [
        [0, 3],
        [4, 7],
      ],
    );
  });

  it("report warnings inside a quote at the right column", () => {
    const { diagnostics } = parseBlocks("text\n> > ```\n> > code", "a.md");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: DiagnosticCodes.unclosedCodeFence,
        span: expect.objectContaining({ start: { line: 2, column: 5, offset: 9 } }),
      }),
    ]);
  });
});

function quoteDepth(source: string): number {
  let depth = 0;
  let children = parseBlocks(source, "a.md").document.children;
  while (children[0]?.kind === "block-quote") {
    depth++;
    children = children[0].children;
  }
  return depth;
}

describe("nesting limit", () => {
  it("allows 256 levels without a warning", () => {
    const source = `${"> ".repeat(256)}a`;
    expect(quoteDepth(source)).toBe(256);
    expect(parseBlocks(source, "a.md").diagnostics).toEqual([]);
  });

  it("reads deeper levels as text and warns", () => {
    const source = `${"> ".repeat(257)}a`;
    expect(quoteDepth(source)).toBe(256);
    expect(parseBlocks(source, "a.md").diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      DiagnosticCodes.nestingTooDeep,
    ]);
  });

  it.each([
    ["quotes", `${"> ".repeat(50_000)}a`],
    ["lists", Array.from({ length: 400 }, (_, i) => `${" ".repeat(i * 2)}- x`).join("\n")],
  ])("does not crash on very deep %s", (_, source) => {
    expect(() => markdownToHtml(source, "a.md")).not.toThrow();
  });
});
