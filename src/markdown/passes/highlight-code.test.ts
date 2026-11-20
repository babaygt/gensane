import { describe, expect, it } from "vitest";
import { markdownToHtml } from "../index.ts";

function html(
  markdown: string,
  highlight: (code: string, language: string | undefined) => string | undefined,
) {
  return markdownToHtml(markdown, "a.md", { highlight }).html;
}

const marking = (code: string) => `<mark>${code.trimEnd()}</mark>`;

describe("highlightCode", () => {
  it("puts what the highlighter gives inside <code>, with the language", () => {
    expect(html("```ts\nconst a = 1;\n```\n", marking)).toBe(
      '<pre><code class="language-ts"><mark>const a = 1;</mark></code></pre>\n',
    );
  });

  it("gives the highlighter the code as written, and the language", () => {
    const seen: [string, string | undefined][] = [];
    html("```ts title=a\nif (a < b) {}\n```\n\n```\nplain\n```\n", (code, language) => {
      seen.push([code, language]);
      return undefined;
    });
    expect(seen).toEqual([
      ["if (a < b) {}\n", "ts"],
      ["plain\n", undefined],
    ]);
  });

  it("leaves a block as it is when the highlighter gives nothing", () => {
    expect(html("```ts\na < b\n```\n", () => undefined)).toBe(
      '<pre><code class="language-ts">a &lt; b\n</code></pre>\n',
    );
  });

  it("highlights code without a language, with no class", () => {
    expect(html("```\nx\n```\n", marking)).toBe("<pre><code><mark>x</mark></code></pre>\n");
  });

  it("highlights code inside lists, quotes and footnotes", () => {
    const markdown =
      "- ```\n  a\n  ```\n\n> ```\n> b\n> ```\n\nNote[^1]\n\n[^1]: ```\n    c\n    ```\n";
    const result = html(markdown, marking);
    expect(result).toContain("<mark>a</mark>");
    expect(result).toContain("<mark>b</mark>");
    expect(result).toContain("<mark>c</mark>");
  });

  it("keeps the highlighted HTML even when raw HTML is escaped", () => {
    const result = markdownToHtml("```ts\nx\n```\n\n<b>raw</b>\n", "a.md", {
      highlight: marking,
      rawHtml: "escape",
    }).html;
    expect(result).toContain("<mark>x</mark>");
    expect(result).toContain("&lt;b&gt;raw&lt;/b&gt;");
  });

  it("escapes the language in the class", () => {
    expect(html('```a"b\nx\n```\n', marking)).toContain('class="language-a&quot;b"');
  });

  it("leaves indented code alone, which the compiler doesn't read as code", () => {
    expect(html("Text\n\n    not code\n", marking)).not.toContain("<mark>");
  });
});
