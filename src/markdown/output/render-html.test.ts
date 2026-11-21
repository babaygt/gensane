// End-to-end: Markdown source in, HTML out. Expected output follows the CommonMark
// reference renderer's format (one block per line, `<hr />`, `language-` classes).
import { describe, expect, it } from "vitest";
import { markdownToHtml } from "../index.ts";

function html(source: string): string {
  return markdownToHtml(source, "test.md").html;
}

describe("markdownToHtml", () => {
  it.each([
    { name: "empty document", source: "", expected: "" },
    { name: "heading", source: "## Hello", expected: '<h2 id="hello">Hello</h2>\n' },
    { name: "paragraph", source: "a\nb", expected: "<p>a\nb</p>\n" },
    { name: "thematic break", source: "---", expected: "<hr />\n" },
    {
      name: "code with language",
      source: "```ts\nlet x = 1;\n```",
      expected: '<pre><code class="language-ts">let x = 1;\n</code></pre>\n',
    },
    {
      name: "code without language",
      source: "```\nx\n```",
      expected: "<pre><code>x\n</code></pre>\n",
    },
    {
      name: "several blocks",
      source: "# T\n\ntext\n\n***",
      expected: '<h1 id="t">T</h1>\n<p>text</p>\n<hr />\n',
    },
  ])("renders $name", ({ source, expected }) => {
    expect(html(source)).toBe(expected);
  });

  describe("containers", () => {
    it.each([
      { name: "block quote", source: "> a", expected: "<blockquote>\n<p>a</p>\n</blockquote>\n" },
      { name: "empty block quote", source: ">", expected: "<blockquote>\n</blockquote>\n" },
      {
        name: "tight list (no <p> in items)",
        source: "- a\n- b",
        expected: "<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n",
      },
      {
        name: "loose list (<p> in items)",
        source: "- a\n\n- b",
        expected: "<ul>\n<li>\n<p>a</p>\n</li>\n<li>\n<p>b</p>\n</li>\n</ul>\n",
      },
      { name: "ordered list from 1", source: "1. a", expected: "<ol>\n<li>a</li>\n</ol>\n" },
      {
        name: "ordered list with a start number",
        source: "3. a",
        expected: '<ol start="3">\n<li>a</li>\n</ol>\n',
      },
      {
        name: "nested list",
        source: "- a\n  - b",
        expected: "<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n</li>\n</ul>\n",
      },
      { name: "empty item", source: "-", expected: "<ul>\n<li></li>\n</ul>\n" },
      {
        name: "code block in a tight item",
        source: "- ```\n  x\n  ```",
        expected: "<ul>\n<li>\n<pre><code>x\n</code></pre>\n</li>\n</ul>\n",
      },
    ])("renders $name", ({ source, expected }) => {
      expect(html(source)).toBe(expected);
    });
  });

  describe("tables", () => {
    it("renders a header and body", () => {
      expect(html("| foo | bar |\n| --- | --- |\n| baz | bim |")).toBe(
        [
          "<table>",
          "<thead>",
          "<tr>",
          "<th>foo</th>",
          "<th>bar</th>",
          "</tr>",
          "</thead>",
          "<tbody>",
          "<tr>",
          "<td>baz</td>",
          "<td>bim</td>",
          "</tr>",
          "</tbody>",
          "</table>",
          "",
        ].join("\n"),
      );
    });

    it("leaves out <tbody> when there are no rows", () => {
      expect(html("| abc |\n| --- |")).toBe(
        "<table>\n<thead>\n<tr>\n<th>abc</th>\n</tr>\n</thead>\n</table>\n",
      );
    });

    it("writes column alignment on every cell, as a class the theme styles", () => {
      const output = html("| a | b | c |\n| :- | :-: | -: |\n| d | e | f |");
      expect(output).toContain('<th class="align-left">a</th>');
      expect(output).toContain('<th class="align-center">b</th>');
      expect(output).toContain('<td class="align-right">f</td>');
    });

    it("escapes cell text", () => {
      expect(html("| 1 < 2 |\n| --- |")).toContain("<th>1 &lt; 2</th>");
    });
  });

  describe("escaping", () => {
    it("escapes HTML special characters in text", () => {
      expect(html(`5 < 6 & "quotes" > 'x'`)).toBe(
        "<p>5 &lt; 6 &amp; &quot;quotes&quot; &gt; 'x'</p>\n",
      );
    });

    it("escapes code so it is shown, not run", () => {
      expect(html("```html\n<script>alert(1)</script>\n```")).toBe(
        '<pre><code class="language-html">&lt;script&gt;alert(1)&lt;/script&gt;\n</code></pre>\n',
      );
    });

    it("escapes the language name inside the class attribute", () => {
      expect(html('```a"onmouseover="x\ncode\n```')).toBe(
        '<pre><code class="language-a&quot;onmouseover=&quot;x">code\n</code></pre>\n',
      );
    });
  });

  it("returns the parser's warnings alongside the HTML", () => {
    const result = markdownToHtml("```\nnever closed", "post.md");
    expect(result.html).toBe("<pre><code>never closed\n</code></pre>\n");
    expect(result.diagnostics).toHaveLength(1);
  });
});
