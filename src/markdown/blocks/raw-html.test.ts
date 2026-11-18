import { describe, expect, it } from "vitest";
import { DiagnosticCodes, markdownToHtml, parseMarkdown } from "../index.ts";

function html(source: string): string {
  return markdownToHtml(source, "test.md").html;
}

describe("HTML blocks", () => {
  it.each([
    ["<div>\n*not emphasis*\n</div>", "<div>\n*not emphasis*\n</div>\n"],
    ["<div>\n\n*emphasis*\n\n</div>", "<div>\n<p><em>emphasis</em></p>\n</div>\n"],
    ["<pre>\n\n*kept*\n\n</pre>\nafter", "<pre>\n\n*kept*\n\n</pre>\n<p>after</p>\n"],
    ["<!-- one line --> *x*\n*y*", "<!-- one line --> *x*\n<p><em>y</em></p>\n"],
    ["  <div>\n  a", "  <div>\n  a\n"],
    ["text\n<div>\nmore", "<p>text</p>\n<div>\nmore\n"],
    ["text\n<a href='x'>\nmore", "<p>text\n<a href='x'>\nmore</p>\n"],
    ["<a href='x'>\n*raw*\n\n*p*", "<a href='x'>\n*raw*\n<p><em>p</em></p>\n"],
    ["> <div>\n> a\nb", "<blockquote>\n<div>\na\n</blockquote>\n<p>b</p>\n"],
    ["- <div>\n- b", "<ul>\n<li>\n<div>\n</li>\n<li>b</li>\n</ul>\n"],
  ])("%j", (source, expected) => {
    expect(html(source)).toBe(expected);
  });

  it("warns when a comment or script is never closed", () => {
    const { diagnostics } = markdownToHtml("text\n\n<!-- forgot\nmore", "post.md");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: DiagnosticCodes.unclosedHtmlBlock,
        severity: "warning",
        hint: expect.stringContaining("-->"),
        span: expect.objectContaining({ start: { line: 3, column: 1, offset: 6 } }),
      }),
    ]);
  });

  it.each(["<div>\nnever closed", "<!-- closed -->", "<pre>\n</pre>"])(
    "does not warn for %j",
    (source) => {
      expect(markdownToHtml(source, "post.md").diagnostics).toEqual([]);
    },
  );

  it("covers its lines with a span", () => {
    const [block] = parseMarkdown("<div>\na\n\nb", "a.md").document.children;
    expect(block).toMatchObject({
      kind: "html-block",
      text: "<div>\na",
      span: { start: { offset: 0 }, end: { offset: 7 } },
    });
  });
});

describe("inline raw HTML", () => {
  it.each([
    ["a <b>c</b> d", "<p>a <b>c</b> d</p>\n"],
    ["<kbd>Ctrl</kbd> + C", "<p><kbd>Ctrl</kbd> + C</p>\n"],
    ['*<span title="*">x</span>*', '<p><em><span title="*">x</span></em></p>\n'],
    ["a <!-- *c* --> b", "<p>a <!-- *c* --> b</p>\n"],
    ['a <b title="x\ny"> c', '<p>a <b title="x\ny"> c</p>\n'],
    ["1 < 2 > 0", "<p>1 &lt; 2 &gt; 0</p>\n"],
    ["a <3 b", "<p>a &lt;3 b</p>\n"],
    ["<https://a.dev>", '<p><a href="https://a.dev">https://a.dev</a></p>\n'],
  ])("%j", (source, expected) => {
    expect(html(source)).toBe(expected);
  });

  it("records the tag and its position", () => {
    const [block] = parseMarkdown("a <b>", "a.md").document.children;
    const tag = block?.kind === "paragraph" ? block.inlines?.[1] : undefined;
    expect(tag).toMatchObject({ kind: "raw-html", text: "<b>", span: { start: { offset: 2 } } });
  });

  // No timing assertion, which would be flaky: without remembering that `-->` is missing,
  // this input takes far longer than Vitest's 5 second test timeout.
  it("handles many unclosed comments", () => {
    expect(html("a <!--".repeat(100_000))).toContain("a &lt;!--a &lt;!--");
  });

  it("uses the tag text in an image description", () => {
    expect(html("![a <b>](/u)")).toBe('<p><img src="/u" alt="a &lt;b&gt;" /></p>\n');
  });
});

function escaped(source: string): string {
  return markdownToHtml(source, "test.md", { rawHtml: "escape" }).html;
}

describe('the rawHtml: "escape" option', () => {
  it.each([
    ["<script>alert(1)</script>", "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n"],
    ["<div>\na\n</div>", "<p>&lt;div&gt;\na\n&lt;/div&gt;</p>\n"],
    ["a <b>c</b>", "<p>a &lt;b&gt;c&lt;/b&gt;</p>\n"],
    ["*<b>*", "<p><em>&lt;b&gt;</em></p>\n"],
    ["**<b>**", "<p><strong>&lt;b&gt;</strong></p>\n"],
    ["~~<b>~~", "<p><del>&lt;b&gt;</del></p>\n"],
    ["[<b>](/u)", '<p><a href="/u">&lt;b&gt;</a></p>\n'],
    ["# <b>", "&lt;b&gt;</h1>\n"],
    ["> <b>", "<blockquote>\n<p>&lt;b&gt;</p>\n</blockquote>\n"],
    ["- <b>", "<ul>\n<li>&lt;b&gt;</li>\n</ul>\n"],
    ["| <b> |\n| - |\n| <i> |", "<th>&lt;b&gt;</th>"],
    ["| <b> |\n| - |\n| <i> |", "<td>&lt;i&gt;</td>"],
  ])("%j", (source, expected) => {
    expect(escaped(source)).toContain(expected);
  });

  it("leaves everything else alone", () => {
    expect(escaped("**a** [b](/u)\n\n```\n<c>\n```")).toBe(html("**a** [b](/u)\n\n```\n<c>\n```"));
  });

  it("allows raw HTML when set to allow", () => {
    expect(markdownToHtml("a <b>", "a.md", { rawHtml: "allow" }).html).toBe("<p>a <b></p>\n");
  });
});
