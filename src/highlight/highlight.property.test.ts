import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LANGUAGE_NAMES, highlight } from "./index.ts";

const languages = Object.keys(LANGUAGE_NAMES);

/** Code that looks like code: words, quotes, comment marks, numbers and line breaks, in any order. */
const codeLike = fc
  .array(
    fc.oneof(
      fc.constantFrom(
        "const",
        "let",
        "def",
        "fn",
        "if",
        "return",
        "<p",
        "</p>",
        "<script>",
        "</script>",
        ">",
        "@media",
      ),
      fc.constantFrom(
        '"',
        "'",
        "`",
        '"""',
        "//",
        "#",
        "/*",
        "*/",
        "<!--",
        "-->",
        "\\",
        "\n",
        " ",
        "=",
        "&",
        "<",
      ),
      fc.constantFrom("42", "0x1f", "1.5e3", "12px", "#fff", "a1", "x"),
      fc.string({ maxLength: 4 }),
    ),
    { maxLength: 40 },
  )
  .map((parts) => parts.join(""));

function textOf(html: string): string {
  return html
    .replaceAll(/<span class="hl-[a-z]+">|<\/span>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

describe("highlight, for any code in any language", () => {
  it("keeps every character of the code, in order", () => {
    fc.assert(
      fc.property(codeLike, fc.constantFrom(...languages), (code, language) => {
        expect(textOf(highlight(code, language) ?? "")).toBe(code);
      }),
      { numRuns: 2000 },
    );
  });

  it("writes no HTML but its own spans, which never nest", () => {
    fc.assert(
      fc.property(codeLike, fc.constantFrom(...languages), (code, language) => {
        const html = highlight(code, language) ?? "";
        const withoutSpans = html.replaceAll(
          /<span class="hl-(?:keyword|string|number|comment)">[^<]*<\/span>/g,
          "",
        );
        expect(withoutSpans).not.toMatch(/[<>]/);
      }),
      { numRuns: 2000 },
    );
  });

  it("finishes quickly even on long code", () => {
    const long = 'let a = "b"; // c\n'.repeat(20_000);
    const started = performance.now();
    for (const language of ["ts", "python", "html", "css", "sh"]) highlight(long, language);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
