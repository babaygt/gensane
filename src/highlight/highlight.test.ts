import { describe, expect, it } from "vitest";
import { highlight } from "./index.ts";

const k = (text: string) => `<span class="hl-keyword">${text}</span>`;
const s = (text: string) => `<span class="hl-string">${text}</span>`;
const n = (text: string) => `<span class="hl-number">${text}</span>`;
const c = (text: string) => `<span class="hl-comment">${text}</span>`;

describe("highlight", () => {
  it.each([
    [
      "ts",
      'const answer = 42; // the answer\nlet name = "Ada";',
      `${k("const")} answer = ${n("42")}; ${c("// the answer")}\n${k("let")} name = ${s('"Ada"')};`,
    ],
    ["js", "/* note */ `a ${b}`", `${c("/* note */")} ${s("`a ${b}`")}`],
    [
      "json",
      '{ "on": true, "n": -1.5e3 }',
      `{ ${s('"on"')}: ${k("true")}, ${s('"n"')}: -${n("1.5e3")} }`,
    ],
    [
      "css",
      "@media (width > 40rem) { a { color: #fff; margin: 0 !important } }",
      `${k("@media")} (width &gt; ${n("40rem")}) { a { color: ${n("#fff")}; margin: ${n("0")} !${k("important")} } }`,
    ],
    [
      "sh",
      "export A=1 # set it\necho a#b 'it''s'",
      `${k("export")} A=${n("1")} ${c("# set it")}\necho a#b ${s("'it''s'")}`,
    ],
    [
      "python",
      'def f():\n    """Doc"""\n    return None  # nothing',
      `${k("def")} f():\n    ${s('"""Doc"""')}\n    ${k("return")} ${k("None")}  ${c("# nothing")}`,
    ],
    [
      "rust",
      "fn f<'a>(x: &'a str) -> char { 'x' }",
      `${k("fn")} f&lt;'a&gt;(x: &amp;'a str) -&gt; char { ${s("'x'")} }`,
    ],
    [
      "go",
      "func main() { r := '\\n'; s := `raw` }",
      `${k("func")} main() { r := ${s("'\\n'")}; s := ${s("`raw`")} }`,
    ],
  ])("colors %s", (language, code, html) => {
    expect(highlight(code, language)).toBe(html);
  });

  it("colors HTML tags, their values and comments, but not an apostrophe in text", () => {
    expect(highlight('<!-- hi --><p class="lead">It\'s <b>bold</b></p>', "html")).toBe(
      `${c("&lt;!-- hi --&gt;")}&lt;${k("p")} class=${s('"lead"')}&gt;It's &lt;${k("b")}&gt;bold&lt;/${k("b")}&gt;&lt;/${k("p")}&gt;`,
    );
  });

  it("colors scripts and styles inside HTML in their own languages", () => {
    expect(highlight("<script>let a = 1;</script><style>a { margin: 0 }</style>", "html")).toBe(
      `&lt;${k("script")}&gt;${k("let")} a = ${n("1")};&lt;/${k("script")}&gt;&lt;${k("style")}&gt;a { margin: ${n("0")} }&lt;/${k("style")}&gt;`,
    );
  });

  it("knows a language by any of its names, in any case", () => {
    expect(highlight("let", "TypeScript")).toBe(k("let"));
    expect(highlight("let", "tsx")).toBe(k("let"));
  });

  it.each([undefined, "", "brainfuck", "constructor", "toString", "__proto__"])(
    "leaves code in an unknown language (%j) to stay plain",
    (language) => {
      expect(highlight("let a = 1;", language)).toBeUndefined();
    },
  );

  it("doesn't take a word inside another word, or a number at the end of a name, for a keyword or a number", () => {
    expect(highlight("letter let2 x1 _if", "ts")).toBe("letter let2 x1 _if");
  });

  it("ends a string at the end of its line, but lets a backtick string and a block comment span lines", () => {
    expect(highlight('"open\nnext', "ts")).toBe(`${s('"open')}\nnext`);
    expect(highlight("`a\nb`", "ts")).toBe(s("`a\nb`"));
    expect(highlight("/* a\nb", "ts")).toBe(c("/* a\nb"));
  });

  it("keeps an escaped quote inside its string", () => {
    expect(highlight('"say \\"hi\\"" x', "ts")).toBe(`${s('"say \\"hi\\""')} x`);
  });
});
