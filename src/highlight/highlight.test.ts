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
    [
      "sql",
      "SELECT name, 'it''s' FROM users -- all\nWHERE id = 42 /* x */",
      `${k("SELECT")} name, ${s("'it''s'")} ${k("FROM")} users ${c("-- all")}\n${k("WHERE")} id = ${n("42")} ${c("/* x */")}`,
    ],
    [
      "yaml",
      "title: Ada's notes # a comment\ndraft: true\ntags: ['a', \"b\"]\ncount: 3",
      `title: Ada's notes ${c("# a comment")}\ndraft: ${k("true")}\ntags: [${s("'a'")}, ${s('"b"')}]\ncount: ${n("3")}`,
    ],
    [
      "dockerfile",
      'FROM node:22 AS build\n# deps\nRUN npm ci && echo "done"\nCOPY . .',
      `${k("FROM")} node:${n("22")} ${k("AS")} build\n${c("# deps")}\n${k("RUN")} npm ci &amp;&amp; echo ${s('"done"')}\n${k("COPY")} . .`,
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
    for (const name of ["sql", "PostgreSQL", "postgres", "pgsql", "mysql", "sqlite"])
      expect(highlight("SELECT", name)).toBe(k("SELECT"));
    for (const name of ["yaml", "yml"]) expect(highlight("true", name)).toBe(k("true"));
    for (const name of ["dockerfile", "Dockerfile", "docker"])
      expect(highlight("FROM", name)).toBe(k("FROM"));
  });

  it("knows SQL's keywords in any case, as SQL does", () => {
    expect(highlight("select * From t", "sql")).toBe(`${k("select")} * ${k("From")} t`);
  });

  it("knows Postgres's words for a query plan, and the types of columns", () => {
    expect(highlight("EXPLAIN ANALYZE SELECT 1", "sql")).toBe(
      `${k("EXPLAIN")} ${k("ANALYZE")} ${k("SELECT")} ${n("1")}`,
    );
    expect(highlight("CREATE TABLE t (id bigint, body text, at timestamptz)", "sql")).toBe(
      `${k("CREATE")} ${k("TABLE")} t (id ${k("bigint")}, body ${k("text")}, at ${k("timestamptz")})`,
    );
  });

  it("knows a Dockerfile's instructions only in capitals, so the commands in them stay plain", () => {
    expect(highlight("RUN git add . && cp from to", "dockerfile")).toBe(
      `${k("RUN")} git add . &amp;&amp; cp from to`,
    );
  });

  it("starts a comment in YAML and a Dockerfile only at the start of a word, so an address keeps its #", () => {
    expect(highlight("url: https://a.b/#top # a note", "yaml")).toBe(
      `url: https://a.b/#top ${c("# a note")}`,
    );
    expect(highlight("RUN curl https://a.b/#top", "dockerfile")).toBe(
      `${k("RUN")} curl https://a.b/#top`,
    );
  });

  it("leaves a name in double quotes plain in SQL, since it names a column, not text", () => {
    expect(highlight('SELECT "user" FROM t', "sql")).toBe(`${k("SELECT")} "user" ${k("FROM")} t`);
  });

  it("takes an apostrophe in YAML's words for text, and a quote that starts a value for a string", () => {
    expect(highlight("note: it's 'quoted'", "yaml")).toBe(`note: it's ${s("'quoted'")}`);
  });

  it.each([undefined, "", "brainfuck", "constructor", "toString", "__proto__"])(
    "leaves code in an unknown language (%j) to stay plain",
    (language) => {
      expect(highlight("let a = 1;", language)).toBeUndefined();
    },
  );

  it("doesn't take a word inside another word, or a number at the end of a name, for a keyword or a number", () => {
    expect(highlight("letter let2 x1 _if", "ts")).toBe("letter let2 x1 _if");
    expect(highlight("1px2", "ts")).toBe(`${n("1")}px2`);
  });

  it("reads numbers as the languages write them", () => {
    expect(highlight("0x1f 0b101 0o17 1_000 2.5e-3", "ts")).toBe(
      [n("0x1f"), n("0b101"), n("0o17"), n("1_000"), n("2.5e-3")].join(" "),
    );
  });

  it("ends a string at the end of its line, but lets a backtick string and a block comment span lines", () => {
    expect(highlight('"open\nnext', "ts")).toBe(`${s('"open')}\nnext`);
    expect(highlight("`a\nb`", "ts")).toBe(s("`a\nb`"));
    expect(highlight("/* a\nb", "ts")).toBe(c("/* a\nb"));
  });

  it("lets Python's triple-quoted strings span lines", () => {
    expect(highlight('"""First\nsecond""" x', "python")).toBe(`${s('"""First\nsecond"""')} x`);
  });

  it("keeps an escaped quote inside its string", () => {
    expect(highlight('"say \\"hi\\"" x', "ts")).toBe(`${s('"say \\"hi\\""')} x`);
  });
});
