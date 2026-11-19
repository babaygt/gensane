import { describe, expect, it } from "vitest";
import {
  countExampleMarkers,
  countFrontmatterMarkers,
  countTemplateMarkers,
  declaresSymbol,
  findCodeFences,
  findFieldRows,
  findFrontmatterExamples,
  findLinks,
  findSection,
  findTemplateExamples,
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

describe("countFrontmatterMarkers", () => {
  it("counts every kind of marker, even a misspelled one", () => {
    const page = "<!-- reads -->\n<!-- valid post -->\n<!-- reports GS201 -->\n<!-- reports oops -->";
    expect(countFrontmatterMarkers(page)).toBe(4);
  });

  it("counts a marker with a missing or extra ending", () => {
    expect(countFrontmatterMarkers("<!-- read -->\n<!-- report GS201 -->\n<!-- reported GS201 -->")).toBe(3);
  });

  it("ignores other comments", () => {
    expect(countFrontmatterMarkers("<!-- example -->\n<!-- readers -->")).toBe(0);
  });
});

describe("findFrontmatterExamples", () => {
  it("pairs a read example with its data", () => {
    const page = '<!-- reads -->\n```yaml\na: 1\n```\n\n```json\n{ "a": 1 }\n```';
    expect(findFrontmatterExamples(page)).toEqual([
      { kind: "reads", source: "a: 1", data: { a: 1 } },
    ]);
  });

  it("reads the type of a valid example", () => {
    expect(findFrontmatterExamples("<!-- valid talk -->\n```yaml\na: 1\n```")).toEqual([
      { kind: "valid", source: "a: 1", contentType: "talk" },
    ]);
  });

  it("reads the code, the type and the output of a problem", () => {
    const page = "<!-- reports GS221 as post -->\n```yaml\na: 1\n```\n\n```text\nwrong\n```";
    expect(findFrontmatterExamples(page)).toEqual([
      { kind: "reports", source: "a: 1", code: "GS221", contentType: "post", output: "wrong" },
    ]);
  });

  it("allows a problem that needs no type of content", () => {
    const page = "<!-- reports GS201 -->\n```yaml\n---\n```\n\n```text\nwrong\n```";
    expect(findFrontmatterExamples(page)[0]).toMatchObject({ contentType: undefined });
  });

  it("rejects a read example without data", () => {
    expect(() => findFrontmatterExamples("<!-- reads -->\n```yaml\na: 1\n```")).toThrow(
      "without a json fence",
    );
  });

  it("rejects a problem without its output", () => {
    expect(() => findFrontmatterExamples("<!-- reports GS201 -->\n```yaml\n---\n```")).toThrow(
      "without a text fence",
    );
  });
});

describe("findSection", () => {
  const page = "# Top\n\n## One\n\ntext\n\n### Inner\n\n## Two\n\nmore";

  it("ends at the next heading of the same level", () => {
    expect(findSection(page, "## One")).toBe("## One\n\ntext\n\n### Inner\n");
  });

  it("runs to the end of the page for the last section", () => {
    expect(findSection(page, "## Two")).toBe("## Two\n\nmore");
  });

  it("is empty for a heading that does not exist", () => {
    expect(findSection(page, "## Three")).toBe("");
  });
});

describe("findFieldRows", () => {
  it("reads the field and whether it is required", () => {
    expect(findFieldRows("| `title` | Yes | Text |\n| `tags` | No | List |")).toEqual([
      { field: "title", required: true },
      { field: "tags", required: false },
    ]);
  });

  it("ignores other rows", () => {
    expect(findFieldRows("| Field | Required |\n| --- | --- |")).toEqual([]);
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

describe("findTemplateExamples", () => {
  it("reads a template, its variables and the html it renders", () => {
    const page = [
      "<!-- renders -->",
      "```jinja",
      "{{ a }}",
      "```",
      "```json",
      '{ "a": 1 }',
      "```",
      "```html",
      "1",
      "```",
    ].join("\n");
    expect(findTemplateExamples(page)).toEqual([
      {
        kind: "renders",
        code: undefined,
        files: { "page.html": "{{ a }}" },
        name: "page.html",
        variables: { a: 1 },
        output: "1",
      },
    ]);
  });

  it("reads several named files, and renders the one the marker names", () => {
    const page = [
      "<!-- renders post.html -->",
      "```jinja base.html",
      "B",
      "```",
      "```jinja post.html",
      "P",
      "```",
      "```html",
      "x",
      "```",
    ].join("\n");
    expect(findTemplateExamples(page)[0]).toMatchObject({
      files: { "base.html": "B", "post.html": "P" },
      name: "post.html",
      variables: {},
    });
  });

  it("renders the first file when the marker names none", () => {
    const page = "<!-- renders -->\n```jinja a.html\nA\n```\n```jinja b.html\nB\n```\n```html\nA\n```";
    expect(findTemplateExamples(page)[0]?.name).toBe("a.html");
  });

  it("reads a problem example with its code and expected text", () => {
    const page = "<!-- reports GS320 -->\n```jinja\n{{ a | b }}\n```\n```text\nproblem\n```";
    expect(findTemplateExamples(page)[0]).toMatchObject({
      kind: "reports",
      code: "GS320",
      output: "problem",
    });
  });

  it("rejects an example without its output", () => {
    expect(() => findTemplateExamples("<!-- renders -->\n```jinja\nx\n```")).toThrow(
      "without a html fence",
    );
    expect(() => findTemplateExamples("<!-- reports GS301 -->\n```jinja\nx\n```")).toThrow(
      "without a text fence",
    );
  });

  it("rejects a marker without a template", () => {
    expect(() => findTemplateExamples("<!-- renders -->\n```html\nx\n```")).toThrow(
      "without a jinja fence",
    );
  });

  it("counts misspelled markers too", () => {
    const page = "<!-- renders -->\n<!-- reports GS1 -->\n<!-- render -->\n<!-- reported GS1 -->";
    expect(countTemplateMarkers(page)).toBe(4);
    expect(countTemplateMarkers("<!-- other -->\n<!-- prerender -->")).toBe(0);
  });
});

