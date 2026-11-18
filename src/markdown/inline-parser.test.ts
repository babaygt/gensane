// Cases are adapted from the CommonMark spec sections on inlines, and from the GitHub
// Flavored Markdown spec for strikethrough.
import { describe, expect, it } from "vitest";
import { markdownToHtml, parseMarkdown, renderHtml } from "./index.ts";
import { parseBlocks } from "./block-parser.ts";
import { withoutSpans } from "./test-helpers.ts";

/** The HTML inside the single paragraph that `source` produces. */
function inline(source: string): string {
  return markdownToHtml(source, "test.md")
    .html.replace(/^<p>/, "")
    .replace(/<\/p>\n$/, "");
}

function firstBlock(source: string) {
  const [block] = parseMarkdown(source, "a.md").document.children;
  if (block?.kind !== "paragraph") throw new Error("expected a paragraph");
  return block;
}

describe("backslash escapes", () => {
  it.each([
    ["\\*not emphasis\\*", "*not emphasis*"],
    ["\\`not code\\`", "`not code`"],
    ["\\\\*emphasis*", "\\<em>emphasis</em>"],
    ["\\a stays", "\\a stays"],
    ["\\~\\~no\\~\\~", "~~no~~"],
    ["trailing\\", "trailing\\"],
  ])("%s", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });
});

describe("code spans", () => {
  it.each([
    ["`foo`", "<code>foo</code>"],
    ["`` foo ` bar ``", "<code>foo ` bar</code>"],
    ["` `` `", "<code>``</code>"],
    ["`  ``  `", "<code> `` </code>"],
    ["` a`", "<code> a</code>"],
    ["`  `", "<code>  </code>"],
    ["`foo\nbar`", "<code>foo bar</code>"],
    ["`foo\\`bar`", "<code>foo\\</code>bar`"],
    ["`*not emphasis*`", "<code>*not emphasis*</code>"],
    ["*foo`*`", "*foo<code>*</code>"],
    ["```foo``", "```foo``"],
    ["`foo", "`foo"],
    ["`<a>`", "<code>&lt;a&gt;</code>"],
  ])("%j", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });
});

describe("emphasis and strong emphasis", () => {
  it.each([
    ["*foo bar*", "<em>foo bar</em>"],
    ["_foo bar_", "<em>foo bar</em>"],
    ["**foo bar**", "<strong>foo bar</strong>"],
    ["__foo bar__", "<strong>foo bar</strong>"],
    ["***foo***", "<em><strong>foo</strong></em>"],
    ["a * foo bar*", "a * foo bar*"],

    ["foo*bar*", "foo<em>bar</em>"],
    ["foo_bar_", "foo_bar_"],
    ["snake_case_name", "snake_case_name"],
    ["5*6*78", "5<em>6</em>78"],
    ["*foo*bar", "<em>foo</em>bar"],
    ["_foo_bar", "_foo_bar"],
    ["*(*foo*)*", "<em>(<em>foo</em>)</em>"],
    ["*foo **bar** baz*", "<em>foo <strong>bar</strong> baz</em>"],
    ["**foo *bar* baz**", "<strong>foo <em>bar</em> baz</strong>"],
    ["*foo**bar**baz*", "<em>foo<strong>bar</strong>baz</em>"],
    ["*foo**bar*", "<em>foo**bar</em>"],
    ["foo***bar***baz", "foo<em><strong>bar</strong></em>baz"],
    ["**foo*", "*<em>foo</em>"],
    ["*foo**", "<em>foo</em>*"],
    ["*foo", "*foo"],
    ["foo*", "foo*"],
    ["*foo_", "*foo_"],
    ["2 * 3 * 4", "2 * 3 * 4"],
  ])("%j", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });
});

describe("strikethrough", () => {
  it.each([
    ["~~gone~~", "<del>gone</del>"],
    ["a ~~b *c*~~ d", "a <del>b <em>c</em></del> d"],
    ["~one~", "~one~"],
    ["a ~~~three~~~", "a ~~~three~~~"],
    ["~~open", "~~open"],
    ["~~ spaced ~~", "~~ spaced ~~"],
  ])("%j", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });
});

describe("line breaks", () => {
  it.each([
    ["foo\nbar", "foo\nbar"],
    ["foo  \nbar", "foo<br />\nbar"],
    ["foo      \nbar", "foo<br />\nbar"],
    ["foo\\\nbar", "foo<br />\nbar"],
    ["foo \nbar", "foo\nbar"],
    ["*foo  \nbar*", "<em>foo<br />\nbar</em>"],
    ["`foo  \nbar`", "<code>foo   bar</code>"],
    ["foo  ", "foo"],
  ])("%j", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });
});

describe("inline syntax in other blocks", () => {
  it.each([
    ["# *Title*", "<h1><em>Title</em></h1>\n"],
    ["- **bold**", "<ul>\n<li><strong>bold</strong></li>\n</ul>\n"],
    ["> `code`", "<blockquote>\n<p><code>code</code></p>\n</blockquote>\n"],
    [
      "| *a* |\n| --- |",
      "<table>\n<thead>\n<tr>\n<th><em>a</em></th>\n</tr>\n</thead>\n</table>\n",
    ],
    ["```\n*not emphasis*\n```", "<pre><code>*not emphasis*\n</code></pre>\n"],
  ])("%j", (source, expected) => {
    expect(markdownToHtml(source, "test.md").html).toBe(expected);
  });

  it("renders a tree that has not been through the inline stage as plain text", () => {
    expect(renderHtml(parseBlocks("*raw*", "a.md").document)).toBe("<p>*raw*</p>\n");
  });
});

describe("syntax tree", () => {
  it("merges neighbouring text into one node", () => {
    expect(withoutSpans(firstBlock("a\\*b * c").inlines)).toEqual([
      { kind: "text", text: "a*b * c" },
    ]);
  });

  it("nests emphasis nodes", () => {
    expect(withoutSpans(firstBlock("x **y *z***").inlines)).toEqual([
      { kind: "text", text: "x " },
      {
        kind: "strong",
        children: [
          { kind: "text", text: "y " },
          { kind: "emphasis", children: [{ kind: "text", text: "z" }] },
        ],
      },
    ]);
  });
});

describe("source positions", () => {
  it("cover the delimiters of emphasis", () => {
    const [, emphasis] = firstBlock("ab *cd*").inlines ?? [];
    expect(emphasis?.span).toEqual({
      file: "a.md",
      start: { line: 1, column: 4, offset: 3 },
      end: { line: 1, column: 8, offset: 7 },
    });
  });

  it("stay exact on later lines of an indented paragraph", () => {
    const inlines = firstBlock("one\n   *two*").inlines ?? [];
    expect(inlines.at(-1)?.span.start).toEqual({ line: 2, column: 4, offset: 7 });
  });

  it("stay exact inside a block quote", () => {
    const [quote] = parseMarkdown("> a *b*", "a.md").document.children;
    const paragraph = quote?.kind === "block-quote" ? quote.children[0] : undefined;
    const emphasis = paragraph?.kind === "paragraph" ? paragraph.inlines?.[1] : undefined;
    expect(emphasis?.span.start).toEqual({ line: 1, column: 5, offset: 4 });
  });

  it("stay exact after an escaped pipe in a table cell", () => {
    const [table] = parseMarkdown("| a\\|b *c* |\n| --- |", "a.md").document.children;
    const cell = table?.kind === "table" ? table.header.cells[0] : undefined;
    expect(cell?.inlines?.at(-1)?.span.start).toEqual({ line: 1, column: 8, offset: 7 });
  });

  it("stay exact in a heading", () => {
    const [heading] = parseMarkdown("##   *a*", "a.md").document.children;
    const emphasis = heading?.kind === "heading" ? heading.inlines?.[0] : undefined;
    expect(emphasis?.span.start).toEqual({ line: 1, column: 6, offset: 5 });
  });
});
