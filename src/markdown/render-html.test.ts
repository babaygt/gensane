// End-to-end: Markdown source in, HTML out. Expected output follows the CommonMark
// reference renderer's format (one block per line, `<hr />`, `language-` classes).
import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./index.ts";

function html(source: string): string {
  return markdownToHtml(source, "test.md").html;
}

describe("markdownToHtml", () => {
  it.each([
    { name: "empty document", source: "", expected: "" },
    { name: "heading", source: "## Hello", expected: "<h2>Hello</h2>\n" },
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
      expected: "<h1>T</h1>\n<p>text</p>\n<hr />\n",
    },
  ])("renders $name", ({ source, expected }) => {
    expect(html(source)).toBe(expected);
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
