import { describe, expect, it } from "vitest";
import { slugify } from "./heading-ids.ts";
import { markdownToHtml, parseMarkdown } from "./index.ts";

function html(source: string): string {
  return markdownToHtml(source, "test.md").html;
}

function toc(source: string): unknown {
  return markdownToHtml(source, "test.md").tableOfContents;
}

describe("slugify", () => {
  it.each([
    ["Hello World", "hello-world"],
    ["  Spaced   Out  ", "spaced-out"],
    ["C++ & C#", "c-c"],
    ["What's new?", "whats-new"],
    ["snake_case-name", "snake_case-name"],
    ["Über Größe", "über-größe"],
    ["日本語 タイトル", "日本語-タイトル"],
    ["Version 2.0", "version-20"],
    ["???", "section"],
    ["", "section"],
  ])("%j → %j", (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });
});

describe("heading ids", () => {
  it("adds an id to every heading", () => {
    expect(html("# Hello World")).toBe('<h1 id="hello-world">Hello World</h1>\n');
  });

  it("uses the text without its formatting", () => {
    expect(html("## *Fast* `code` [link](/u)")).toBe(
      '<h2 id="fast-code-link"><em>Fast</em> <code>code</code> <a href="/u">link</a></h2>\n',
    );
  });

  it("numbers repeated headings", () => {
    expect(html("# A\n\n# A\n\n# A")).toBe(
      '<h1 id="a">A</h1>\n<h1 id="a-1">A</h1>\n<h1 id="a-2">A</h1>\n',
    );
  });

  it("does not reuse an id that a later heading already has by its own text", () => {
    expect(html("# A-1\n\n# A\n\n# A")).toBe(
      '<h1 id="a-1">A-1</h1>\n<h1 id="a">A</h1>\n<h1 id="a-2">A</h1>\n',
    );
  });

  it("keeps ids unique across containers", () => {
    expect(html("# A\n\n> # A\n\n- # A")).toContain('id="a-2"');
  });

  // No timing assertion, which would be flaky: counting from 1 for every repeated heading
  // takes far longer than Vitest's 5 second test timeout on this input.
  it("handles thousands of identical headings", () => {
    expect(html("# A\n\n".repeat(100_000))).toContain('id="a-99999"');
  });

  it("can be turned off", () => {
    expect(markdownToHtml("# A", "a.md", { headingIds: false }).html).toBe("<h1>A</h1>\n");
  });

  it("stores the id on the heading", () => {
    const [heading] = parseMarkdown("# A", "a.md").document.children;
    expect(heading).toMatchObject({ kind: "heading", id: "a" });
  });
});

describe("table of contents", () => {
  it("is empty without headings", () => {
    expect(toc("text")).toEqual([]);
  });

  it("nests headings by level", () => {
    expect(toc("# A\n\n## B\n\n### C\n\n## D\n\n# E")).toEqual([
      {
        id: "a",
        text: "A",
        level: 1,
        children: [
          {
            id: "b",
            text: "B",
            level: 2,
            children: [{ id: "c", text: "C", level: 3, children: [] }],
          },
          { id: "d", text: "D", level: 2, children: [] },
        ],
      },
      { id: "e", text: "E", level: 1, children: [] },
    ]);
  });

  it("tolerates skipped levels and a document that starts deep", () => {
    expect(toc("### A\n\n# B\n\n### C")).toEqual([
      { id: "a", text: "A", level: 3, children: [] },
      {
        id: "b",
        text: "B",
        level: 1,
        children: [{ id: "c", text: "C", level: 3, children: [] }],
      },
    ]);
  });

  it("uses plain text", () => {
    expect(toc("# *A* `b`")).toMatchObject([{ text: "A b" }]);
  });

  it("leaves out headings inside quotes and lists", () => {
    expect(toc("> # A\n\n- # B\n\n# C")).toMatchObject([{ id: "c" }]);
  });

  it("is empty when heading ids are turned off", () => {
    expect(markdownToHtml("# A", "a.md", { headingIds: false }).tableOfContents).toEqual([]);
  });
});
