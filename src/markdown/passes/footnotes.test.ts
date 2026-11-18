import { describe, expect, it } from "vitest";
import { DiagnosticCodes, markdownToHtml, parseMarkdown } from "../index.ts";

function html(source: string): string {
  return markdownToHtml(source, "test.md").html;
}

function codes(source: string): string[] {
  return markdownToHtml(source, "test.md").diagnostics.map((diagnostic) => diagnostic.code);
}

const reference = (number: number, suffix = "") =>
  `<sup class="footnote-ref"><a href="#fn-${number}" id="fnref-${number}${suffix}">${number}</a></sup>`;

const backReference = (number: number, suffix = "", mark = "↩") =>
  `<a href="#fnref-${number}${suffix}" class="footnote-backref" aria-label="Back to reference ${number}${suffix}">${mark}</a>`;

const section = (items: string) => `<section class="footnotes">\n<ol>\n${items}</ol>\n</section>\n`;

describe("footnotes", () => {
  it("renders a reference and its note", () => {
    expect(html("Text[^a].\n\n[^a]: The note.")).toBe(
      `<p>Text${reference(1)}.</p>\n` +
        section(`<li id="fn-1">\n<p>The note. ${backReference(1)}</p>\n</li>\n`),
    );
  });

  it("numbers notes in the order they are first referenced", () => {
    const output = html("A[^second] B[^first]\n\n[^first]: One\n\n[^second]: Two");
    expect(output).toContain(`<p>A${reference(1)} B${reference(2)}</p>`);
    expect(output.indexOf("Two")).toBeLessThan(output.indexOf("One"));
  });

  it("links back to every reference of a note", () => {
    const output = html("A[^a] B[^a]\n\n[^a]: Note");
    expect(output).toContain(`<p>A${reference(1)} B${reference(1, "-2")}</p>`);
    expect(output).toContain(`<p>Note ${backReference(1)} ${backReference(1, "-2", "↩2")}</p>`);
  });

  it("matches labels regardless of case", () => {
    expect(html("A[^NOTE]\n\n[^note]: B")).toContain(reference(1));
  });

  it("parses inline syntax inside a note", () => {
    expect(html("A[^a]\n\n[^a]: *B*")).toContain(`<p><em>B</em> ${backReference(1)}</p>`);
  });

  it("allows several blocks when they are indented", () => {
    const output = html("A[^a]\n\n[^a]: First\n\n    Second\n\n    - item\n\nAfter");
    expect(output).toContain("<p>First</p>\n<p>Second</p>\n<ul>\n<li>item</li>\n</ul>\n");
    expect(output).toContain(`<p>${backReference(1)}</p>\n</li>`);
    expect(output).toContain("<p>After</p>");
  });

  it("continues a note on a lazy line", () => {
    expect(html("A[^a]\n\n[^a]: one\ntwo")).toContain(`<p>one\ntwo ${backReference(1)}</p>`);
  });

  it("allows the text to start on the next line", () => {
    expect(html("A[^a]\n\n[^a]:\n    Note")).toContain(`<p>Note ${backReference(1)}</p>`);
  });

  it("interrupts a paragraph", () => {
    expect(html("A[^a]\n[^a]: Note")).toContain(`<p>A${reference(1)}</p>`);
  });

  it("finds definitions inside containers", () => {
    expect(html("A[^a]\n\n> [^a]: Note")).toBe(
      `<p>A${reference(1)}</p>\n<blockquote>\n</blockquote>\n` +
        section(`<li id="fn-1">\n<p>Note ${backReference(1)}</p>\n</li>\n`),
    );
  });

  it("finds references inside lists, quotes, tables and headings", () => {
    const source =
      "- a[^a]\n\n> b[^b]\n\n| c[^c] |\n| - |\n| d[^d] |\n\n# e[^e]\n\n" +
      "[^a]: 1\n[^b]: 2\n[^c]: 3\n[^d]: 4\n[^e]: 5";
    expect(html(source).match(/footnote-ref"/g)).toHaveLength(5);
    expect(codes(source)).toEqual([]);
  });

  it("numbers a note that is only referenced from another note", () => {
    const output = html("A[^a]\n\n[^a]: B[^b]\n\n[^b]: C");
    expect(output).toContain(`<p>B${reference(2)} ${backReference(1)}</p>`);
    expect(output).toContain(`<li id="fn-2">\n<p>C ${backReference(2)}</p>`);
  });

  it("handles a note that refers to itself", () => {
    expect(codes("A[^a]\n\n[^a]: B[^a]")).toEqual([]);
  });

  it("leaves out the heading text of a reference from the heading id", () => {
    expect(html("# Title[^a]\n\n[^a]: Note")).toContain('<h1 id="title">');
  });

  it("leaves a reference out of an image description", () => {
    expect(html("![a[^n]](/u)\n\n[^n]: Note")).toContain('alt="a"');
  });

  it("finds a reference inside emphasis", () => {
    expect(html("*a[^a]*\n\n[^a]: Note")).toContain(`<em>a${reference(1)}</em>`);
  });

  it("finds a definition inside a list", () => {
    expect(codes("A[^a]\n\n- [^a]: Note")).toEqual([]);
  });

  it("finds a definition inside another note", () => {
    expect(codes("A[^a] B[^b]\n\n[^a]: One\n\n    [^b]: Two")).toEqual([]);
  });

  it("supports task lists inside a note", () => {
    expect(html("A[^a]\n\n[^a]: - [x] done")).toContain('type="checkbox"');
  });

  it("allows several spaces before the text of a note", () => {
    expect(codes("A[^a]\n\n[^a]:      Note")).toEqual([]);
  });

  it("ends a note at a line indented by less than four spaces", () => {
    expect(html("A[^a]\n\n[^a]: One\n\n  Two")).toContain("<p>Two</p>\n<section");
  });

  it("does not crash on thousands of nested notes", () => {
    expect(() => html("[^a]: ".repeat(50_000))).not.toThrow();
  });

  it.each(["[^a b]", "[^a b]: Note"])(
    "%j has a space in its label, so it is plain text",
    (source) => {
      expect(html(source)).toBe(`<p>${source}</p>\n`);
      expect(codes(source)).toEqual([]);
    },
  );

  it("renders nothing extra without footnotes", () => {
    expect(html("Text")).toBe("<p>Text</p>\n");
  });

  it.each([
    ["[^a](/url)", '<p><a href="/url">^a</a></p>\n'],
    ["[^ a]", "<p>[^ a]</p>\n"],
    ["[^]", "<p>[^]</p>\n"],
    ["`[^a]`", "<p><code>[^a]</code></p>\n"],
    ["\\[^a]", "<p>[^a]</p>\n"],
  ])("%j is not a reference", (source, expected) => {
    expect(html(source)).toBe(expected);
  });

  it("does not treat four spaces of indentation as a definition", () => {
    expect(html("    [^a]: b")).toBe("<p>[^a]: b</p>\n");
  });
});

describe("footnote warnings", () => {
  it("warns about a reference without a definition and keeps its text", () => {
    const { html: output, diagnostics } = markdownToHtml("See [^missing].", "post.md");
    expect(output).toBe("<p>See [^missing].</p>\n");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: DiagnosticCodes.undefinedFootnote,
        severity: "warning",
        message: expect.stringContaining("missing"),
        span: expect.objectContaining({ start: { line: 1, column: 5, offset: 4 } }),
      }),
    ]);
  });

  it("warns about a definition that is never used and leaves it out", () => {
    const { html: output, diagnostics } = markdownToHtml("Text\n\n[^a]: Note", "post.md");
    expect(output).toBe("<p>Text</p>\n");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: DiagnosticCodes.unusedFootnote,
        span: expect.objectContaining({ start: { line: 3, column: 1, offset: 6 } }),
      }),
    ]);
  });

  it("warns about a second definition of a label and uses the first", () => {
    const { html: output, diagnostics } = markdownToHtml(
      "A[^a]\n\n[^a]: First\n\n[^A]: Second",
      "post.md",
    );
    expect(output).toContain("First");
    expect(output).not.toContain("Second");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      DiagnosticCodes.duplicateFootnote,
    ]);
  });

  it("reports warnings in the order they appear in the file", () => {
    const { diagnostics } = markdownToHtml("[^x]\n\n```\ncode", "post.md");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      DiagnosticCodes.undefinedFootnote,
      DiagnosticCodes.unclosedCodeFence,
    ]);
  });
});

describe("footnotes in the syntax tree", () => {
  it("turns a reference without a definition into text", () => {
    const [paragraph] = parseMarkdown("[^x]", "a.md").document.children;
    expect(paragraph).toMatchObject({ inlines: [{ kind: "text", text: "[^x]" }] });
  });

  it("lists the notes on the document", () => {
    const { document } = parseMarkdown("A[^a]\n\n[^a]: Note", "a.md");
    expect(document.footnotes).toMatchObject([{ label: "a", number: 1, referenceCount: 1 }]);
    expect(document.children.map((block) => block.kind)).toEqual(["paragraph"]);
  });

  it("keeps exact positions inside a note", () => {
    const { document } = parseMarkdown("A[^a]\n\n[^a]: *b*", "a.md");
    const paragraph = document.footnotes?.[0]?.children[0];
    const emphasis = paragraph?.kind === "paragraph" ? paragraph.inlines?.[0] : undefined;
    expect(emphasis?.span.start).toEqual({ line: 3, column: 7, offset: 13 });
  });
});

describe('footnotes with rawHtml: "escape"', () => {
  it("escapes HTML inside a note", () => {
    const output = markdownToHtml("A[^a]\n\n[^a]: <b>", "a.md", { rawHtml: "escape" }).html;
    expect(output).toContain("&lt;b&gt;");
    expect(output).not.toContain("<b>");
  });
});
