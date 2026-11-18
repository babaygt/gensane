import { describe, expect, it } from "vitest";
import { markdownToHtml, parseMarkdown } from "./index.ts";
import { withoutSpans } from "./test-helpers.ts";

function html(source: string): string {
  return markdownToHtml(source, "test.md").html;
}

function inline(source: string): string {
  return html(source)
    .replace(/^<p>/, "")
    .replace(/<\/p>\n$/, "");
}

describe("inline links", () => {
  it.each([
    ["[a](/u)", '<a href="/u">a</a>'],
    ['[a](/u "t")', '<a href="/u" title="t">a</a>'],
    ["[a]()", '<a href="">a</a>'],
    ["[a](<b c>)", '<a href="b%20c">a</a>'],
    ["[*a*](/u)", '<a href="/u"><em>a</em></a>'],
    ["*[a](/u)*", '<em><a href="/u">a</a></em>'],
    ["[`]`](/u)", '<a href="/u"><code>]</code></a>'],
    ["[a](/u", "[a](/u"],
    ["[a] (/u)", "[a] (/u)"],
    ["[a [b](/u) c](/v)", '[a <a href="/u">b</a> c](/v)'],
    ["*[a*](/u)", '*<a href="/u">a*</a>'],
    ["[a](/ü?q=1 2)", "[a](/ü?q=1 2)"],
    ["[a](/ü)", '<a href="/%C3%BC">a</a>'],
    ["[a](/%20b)", '<a href="/%20b">a</a>'],
    ['[a](/"b)', '<a href="/%22b">a</a>'],
    ['[a](<b>"t")', "[a](&lt;b&gt;&quot;t&quot;)"],
    ["*a [b*c](/u)", '*a <a href="/u">b*c</a>'],
    ["[a](/\ud83d)", '<a href="/%EF%BF%BD">a</a>'],
  ])("%s", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });
});

describe("reference links", () => {
  const defs = '\n\n[ref]: /u "t"';

  it.each([
    ["[a][ref]", '<a href="/u" title="t">a</a>'],
    ["[a][REF]", '<a href="/u" title="t">a</a>'],
    ["[ref][]", '<a href="/u" title="t">ref</a>'],
    ["[ref]", '<a href="/u" title="t">ref</a>'],
    ["[other]", "[other]"],
    ["[a][other]", "[a][other]"],
  ])("%s", (source, expected) => {
    expect(inline(`${source}${defs}`)).toBe(expected);
  });

  it("ends a label at the first bracket, even inside a code span", () => {
    expect(inline("[a`]`b]\n\n[a`]: /u")).toBe("[a<code>]</code>b]");
  });

  it("uses the first definition of a label", () => {
    expect(inline("[a]\n\n[a]: /first\n[a]: /second")).toBe('<a href="/first">a</a>');
  });

  it("finds definitions anywhere in the document", () => {
    expect(html("[a]\n\n> [a]: /u")).toBe(
      '<p><a href="/u">a</a></p>\n<blockquote>\n</blockquote>\n',
    );
  });

  it("removes a paragraph that only holds definitions", () => {
    expect(html("[a]: /u")).toBe("");
  });

  it("keeps the text after a definition as a paragraph", () => {
    expect(html("[a]: /u\nrest [a]")).toBe('<p>rest <a href="/u">a</a></p>\n');
  });

  it("does not let a definition interrupt a paragraph", () => {
    expect(html("text\n[a]: /u")).toBe("<p>text\n[a]: /u</p>\n");
  });
});

describe("images", () => {
  it.each([
    ["![a](/u)", '<img src="/u" alt="a" />'],
    ['![a](/u "t")', '<img src="/u" alt="a" title="t" />'],
    ["![*a* `b`](/u)", '<img src="/u" alt="a b" />'],
    ["![a [b](/v)](/u)", '<img src="/u" alt="a b" />'],
    ["[![a](/i)](/u)", '<a href="/u"><img src="/i" alt="a" /></a>'],
    ["!a", "!a"],
    ["![<](/u)", '<img src="/u" alt="&lt;" />'],
    ["![a\nb](/u)", '<img src="/u" alt="a\nb" />'],
    ["\\![a](/u)", '!<a href="/u">a</a>'],
  ])("%s", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });

  it("supports references", () => {
    expect(inline("![a]\n\n[a]: /u")).toBe('<img src="/u" alt="a" />');
  });
});

describe("autolinks", () => {
  it.each([
    ["<https://a.b/c?d=1>", '<a href="https://a.b/c?d=1">https://a.b/c?d=1</a>'],
    ["<me@a.example>", '<a href="mailto:me@a.example">me@a.example</a>'],
    ["<not a link>", "&lt;not a link&gt;"],
  ])("%s", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });
});

describe("character references", () => {
  it.each([
    ["&copy; 2026", "© 2026"],
    ["&amp;", "&amp;"],
    ["&#42;a&#42;", "*a*"],
    ["&unknown;", "&amp;unknown;"],
    ["AT&T", "AT&amp;T"],
    ["`&amp;`", "<code>&amp;amp;</code>"],
    ["[a](/u?x=1&amp;y=2)", '<a href="/u?x=1&amp;y=2">a</a>'],
  ])("%s", (source, expected) => {
    expect(inline(source)).toBe(expected);
  });

  it("applies to the language of a code fence", () => {
    expect(html("``` f&ouml;\n```")).toBe('<pre><code class="language-fö"></code></pre>\n');
  });
});

function firstInlines(source: string): unknown {
  const [block] = parseMarkdown(source, "a.md").document.children;
  return block?.kind === "paragraph" ? block.inlines : undefined;
}

describe("syntax tree", () => {
  it("keeps the raw URL and title on a link", () => {
    expect(withoutSpans(firstInlines('[a](/ü "t")'))).toEqual([
      { kind: "link", url: "/ü", title: "t", children: [{ kind: "text", text: "a" }] },
    ]);
  });

  it("gives an image its description as children", () => {
    expect(withoutSpans(firstInlines("![a](/u)"))).toEqual([
      { kind: "image", url: "/u", children: [{ kind: "text", text: "a" }] },
    ]);
  });
});

const parens = (levels: number) => `${"(".repeat(levels)}b${")".repeat(levels)}`;

describe("limits on hostile input", () => {
  it("allows 32 levels of parentheses in a destination", () => {
    expect(inline(`[a](${parens(32)})`)).toContain("<a href=");
  });

  it("reads deeper parentheses as text", () => {
    expect(inline(`[a](${parens(33)})`)).not.toContain("<a href=");
  });

  // No timing assertions, which would be flaky: without the limits these inputs take far
  // longer than Vitest's 5 second test timeout.
  it("handles many unclosed destinations", () => {
    expect(inline("[a](b".repeat(100_000))).toContain("[a](b[a](b");
  });

  it("handles thousands of nested images", () => {
    const source = `${"![".repeat(100_000)}a${"](/u)".repeat(100_000)}`;
    expect(html(source)).toContain("<img");
  });
});

describe("source positions", () => {
  it("cover the whole link", () => {
    const [block] = parseMarkdown("x [a](/u) y", "a.md").document.children;
    const link = block?.kind === "paragraph" ? block.inlines?.[1] : undefined;
    expect(link?.span).toMatchObject({ start: { offset: 2 }, end: { offset: 9 } });
  });

  it("stay exact in text that follows a definition", () => {
    const [block] = parseMarkdown("[a]: /u\nrest *b*", "a.md").document.children;
    const emphasis = block?.kind === "paragraph" ? block.inlines?.[1] : undefined;
    expect(block?.span.start).toEqual({ line: 2, column: 1, offset: 8 });
    expect(emphasis?.span.start).toEqual({ line: 2, column: 6, offset: 13 });
  });
});
