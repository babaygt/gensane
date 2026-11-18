import { describe, expect, it } from "vitest";
import {
  countExampleMarkers,
  declaresSymbol,
  findCodeFences,
  findLinks,
  findVerifiedExamples,
  findWarningExamples,
  isExternalLink,
  linkedSymbol,
} from "./doc-rules.ts";

describe("findCodeFences", () => {
  it("reads the language, the text and the comment before the fence", () => {
    expect(findCodeFences("<!-- example -->\n```markdown\n# A\nb\n```")).toEqual([
      { info: "markdown", text: "# A\nb", marker: "example" },
    ]);
  });

  it("keeps a shorter fence inside a longer one", () => {
    expect(findCodeFences("````markdown\n```ts\nx\n```\n````")[0]?.text).toBe("```ts\nx\n```");
  });

  it("still finds the comment when a formatter puts a blank line after it", () => {
    expect(findCodeFences("<!-- example -->\n\n```markdown\nx\n```")[0]?.marker).toBe("example");
  });

  it("has no marker when the line before is not a comment", () => {
    expect(findCodeFences("text\n```\nx\n```")[0]?.marker).toBeUndefined();
  });
});

describe("countExampleMarkers", () => {
  it("counts example and warning markers", () => {
    expect(countExampleMarkers("<!-- example -->\ntext\n<!-- warns GS101 -->\n<!-- other -->")).toBe(2);
  });
});

describe("findVerifiedExamples", () => {
  it("pairs a marked example with the html after it", () => {
    const page = "<!-- example -->\n```markdown\n*a*\n```\n\n```html\n<p><em>a</em></p>\n```";
    expect(findVerifiedExamples(page)).toEqual([{ markdown: "*a*", html: "<p><em>a</em></p>" }]);
  });

  it("ignores fences that are not marked", () => {
    expect(findVerifiedExamples("```markdown\n*a*\n```\n\n```html\nwrong\n```")).toEqual([]);
  });

  it("rejects a marked example without an html fence", () => {
    expect(() => findVerifiedExamples("<!-- example -->\n```markdown\n*a*\n```")).toThrow(
      "without an html fence",
    );
  });
});

describe("findWarningExamples", () => {
  it("reads the expected code", () => {
    expect(findWarningExamples("<!-- warns GS101 -->\n```markdown\nx\n```")).toEqual([
      { code: "GS101", markdown: "x" },
    ]);
  });
});

describe("findLinks", () => {
  it("finds plain links and links to code", () => {
    expect(findLinks("See [the guide](a.md) and [`run`](b.ts).")).toEqual([
      { text: "the guide", target: "a.md" },
      { text: "`run`", target: "b.ts" },
    ]);
  });

  it("finds two links to code on one line", () => {
    expect(findLinks("Both [`a`](a.ts) and [`b`](b.ts).").map((link) => link.text)).toEqual([
      "`a`",
      "`b`",
    ]);
  });

  it("is not confused by a code span that shows a backtick", () => {
    expect(findLinks("| `` ` `` | [`a`](a.ts) |").map((link) => link.text)).toEqual(["`a`"]);
  });

  it("ignores link syntax inside inline code", () => {
    expect(findLinks("Write `[text](/url)` for a link.")).toEqual([]);
  });

  it("ignores link syntax inside a code fence", () => {
    expect(findLinks("```markdown\n[text](/url)\n```\n\n[real](a.md)")).toEqual([
      { text: "real", target: "a.md" },
    ]);
  });
});

describe("isExternalLink", () => {
  it.each([
    ["https://example.com", true],
    ["../a.md", false],
  ])("%s → %s", (target, expected) => {
    expect(isExternalLink(target)).toBe(expected);
  });
});

describe("linkedSymbol", () => {
  it.each([
    [{ text: "`parse`", target: "a.ts" }, "parse"],
    [{ text: "`#parse`", target: "a.ts" }, "#parse"],
    [{ text: "a file", target: "a.ts" }, undefined],
    [{ text: "`parse`", target: "a.md" }, undefined],
  ])("%j → %s", (link, expected) => {
    expect(linkedSymbol(link)).toBe(expected);
  });
});

describe("declaresSymbol", () => {
  it.each([
    ["export function parse(a) {}", "parse"],
    ["class Parser {}", "Parser"],
    ["export interface Node {}", "Node"],
    ["export type Kind = 1;", "Kind"],
    ["const LIMIT = 1;", "LIMIT"],
    ["class A {\n  #walk(a) {}\n}", "#walk"],
  ])("%j declares %s", (source, symbol) => {
    expect(declaresSymbol(source, symbol)).toBe(true);
  });

  it.each([
    ["parse(a);", "parse"],
    ["function parser() {}", "parse"],
    ["this.#walk(a);", "#walk"],
  ])("%j does not declare %s", (source, symbol) => {
    expect(declaresSymbol(source, symbol)).toBe(false);
  });
});
