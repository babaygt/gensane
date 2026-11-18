import { describe, expect, it } from "vitest";
import { parseBlocks } from "./block-parser.ts";
import { DiagnosticCodes } from "./diagnostic-codes.ts";
import { blocks, withoutSpans } from "./test-helpers.ts";

function codes(source: string): string[] {
  return parseBlocks(source, "test.md").diagnostics.map((diagnostic) => diagnostic.code);
}

describe("parseBlocks: structure", () => {
  it("parses an empty document", () => {
    expect(blocks("")).toEqual([]);
    expect(blocks("\n\n  \n")).toEqual([]);
  });

  it("parses headings, paragraphs and thematic breaks in order", () => {
    expect(blocks("# Title\n\nSome text.\n\n***\n\n## Next")).toEqual([
      { kind: "heading", level: 1, text: "Title" },
      { kind: "paragraph", text: "Some text." },
      { kind: "thematic-break" },
      { kind: "heading", level: 2, text: "Next" },
    ]);
  });

  describe("paragraphs", () => {
    it("joins consecutive lines and strips their leading whitespace", () => {
      expect(blocks("aaa\n   bbb\nccc   ")).toEqual([{ kind: "paragraph", text: "aaa\nbbb\nccc" }]);
    });

    it("are separated by blank lines", () => {
      expect(blocks("a\n\n\nb")).toEqual([
        { kind: "paragraph", text: "a" },
        { kind: "paragraph", text: "b" },
      ]);
    });

    it.each([
      ["a heading", "text\n# Heading", { kind: "heading", level: 1, text: "Heading" }],
      ["a thematic break", "text\n***", { kind: "thematic-break" }],
      ["a code fence", "text\n```\ncode\n```", { kind: "code", infoString: "", text: "code\n" }],
    ])("are interrupted by %s without a blank line", (_, source, second) => {
      expect(blocks(source)).toEqual([{ kind: "paragraph", text: "text" }, second]);
    });

    it("may continue with indented lines (no indented code inside a paragraph)", () => {
      expect(blocks("a\n      b")).toEqual([{ kind: "paragraph", text: "a\nb" }]);
    });
  });

  describe("fenced code blocks", () => {
    it("keep their content verbatim, with a trailing newline", () => {
      expect(blocks("```\n<a>\n  *b*\n\n```")).toEqual([
        { kind: "code", infoString: "", text: "<a>\n  *b*\n\n" },
      ]);
    });

    it("record the info string and use its first word as the language", () => {
      expect(blocks("```ts title=demo\nlet x;\n```")).toEqual([
        { kind: "code", infoString: "ts title=demo", language: "ts", text: "let x;\n" },
      ]);
    });

    it("can be empty", () => {
      expect(blocks("```\n```")).toEqual([{ kind: "code", infoString: "", text: "" }]);
    });

    it("are only closed by a fence of the same character that is at least as long", () => {
      expect(blocks("````\n```\n~~~~\n````")).toEqual([
        { kind: "code", infoString: "", text: "```\n~~~~\n" },
      ]);
    });

    it("remove the opening fence's indentation from content lines", () => {
      expect(blocks("  ```\n    a\n  b\nc\n  ```")).toEqual([
        { kind: "code", infoString: "", text: "  a\nb\nc\n" },
      ]);
    });

    it("do not treat Markdown inside them as blocks", () => {
      expect(blocks("```\n# not a heading\n---\n```")).toEqual([
        { kind: "code", infoString: "", text: "# not a heading\n---\n" },
      ]);
    });
  });
});

describe("parseBlocks: warnings for unsupported or risky syntax", () => {
  it("reports nothing for ordinary documents", () => {
    expect(codes("# Hi\n\ntext\n\n```\ncode\n```")).toEqual([]);
  });

  describe("unclosed code fence", () => {
    it("closes the block at the end of the document and warns", () => {
      const { document, diagnostics } = parseBlocks("text\n\n```ts\nlet x;\n\nmore", "post.md");
      expect(document.children.map(withoutSpans)).toEqual([
        { kind: "paragraph", text: "text" },
        { kind: "code", infoString: "ts", language: "ts", text: "let x;\n\nmore\n" },
      ]);
      expect(diagnostics).toEqual([
        expect.objectContaining({
          code: DiagnosticCodes.unclosedCodeFence,
          severity: "warning",
          span: expect.objectContaining({ start: { line: 3, column: 1, offset: 6 } }),
        }),
      ]);
    });

    it("tells the user exactly which fence closes it", () => {
      const [diagnostic] = parseBlocks("~~~~~\ncode", "post.md").diagnostics;
      expect(diagnostic?.hint).toContain("~~~~~");
    });
  });

  describe("setext headings", () => {
    it("keep a === underline as paragraph text and warn", () => {
      expect(blocks("Title\n=====")).toEqual([{ kind: "paragraph", text: "Title\n=====" }]);
      expect(codes("Title\n=====")).toEqual([DiagnosticCodes.setextHeading]);
    });

    it("read a --- underline as a thematic break and warn about the ambiguity", () => {
      expect(blocks("Title\n---")).toEqual([
        { kind: "paragraph", text: "Title" },
        { kind: "thematic-break" },
      ]);
      expect(codes("Title\n---")).toEqual([DiagnosticCodes.setextHeading]);
    });

    it("do not warn when --- follows a blank line", () => {
      expect(codes("Title\n\n---")).toEqual([]);
    });

    it("do not warn about a spaced-out break such as - - -", () => {
      expect(codes("Title\n- - -")).toEqual([]);
    });
  });

  describe("indented code blocks", () => {
    it("are read as a paragraph with a warning", () => {
      expect(blocks("intro\n\n    const x = 1;")).toEqual([
        { kind: "paragraph", text: "intro" },
        { kind: "paragraph", text: "const x = 1;" },
      ]);
      expect(codes("intro\n\n    const x = 1;")).toEqual([DiagnosticCodes.indentedCode]);
    });

    it("warn once per block, not once per line", () => {
      expect(codes("    a\n    b\n    c")).toEqual([DiagnosticCodes.indentedCode]);
    });
  });

  it("points every warning at the file it came from", () => {
    const { diagnostics } = parseBlocks("```\nx", "content/blog/hello.md");
    expect(diagnostics[0]?.span.file).toBe("content/blog/hello.md");
  });
});

describe("parseBlocks: source spans", () => {
  const source = "# Hi\n\npara one\npara two\n\n```\ncode\n```";
  const spans = parseBlocks(source, "a.md").document.children.map((block) => block.span);

  it("cover each block from its first to its last character", () => {
    expect(spans.map((span) => source.slice(span.start.offset, span.end.offset))).toEqual([
      "# Hi",
      "para one\npara two",
      "```\ncode\n```",
    ]);
  });

  it("give 1-based line and column numbers", () => {
    expect(spans[1]).toEqual({
      file: "a.md",
      start: { line: 3, column: 1, offset: 6 },
      end: { line: 4, column: 9, offset: 23 },
    });
  });

  it("span the whole document", () => {
    const { document } = parseBlocks(source, "a.md");
    expect(document.span.start.offset).toBe(0);
    expect(document.span.end.offset).toBe(source.length);
  });
});
