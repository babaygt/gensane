// Cases are adapted from the GitHub Flavored Markdown spec, section "Task list items".
import { describe, expect, it } from "vitest";
import { markdownToHtml, parseMarkdown } from "./index.ts";

function html(source: string): string {
  return markdownToHtml(source, "test.md").html;
}

const box = '<input disabled="" type="checkbox" />';
const checkedBox = '<input checked="" disabled="" type="checkbox" />';

describe("task lists", () => {
  it.each([
    ["- [ ] foo", `<ul>\n<li>${box} foo</li>\n</ul>\n`],
    ["- [x] foo", `<ul>\n<li>${checkedBox} foo</li>\n</ul>\n`],
    ["- [X] foo", `<ul>\n<li>${checkedBox} foo</li>\n</ul>\n`],
    ["1. [ ] foo", `<ol>\n<li>${box} foo</li>\n</ol>\n`],
    ["- [ ] *foo*", `<ul>\n<li>${box} <em>foo</em></li>\n</ul>\n`],
    [
      "- [x] foo\n\n- [ ] bar",
      `<ul>\n<li>\n<p>${checkedBox} foo</p>\n</li>\n<li>\n<p>${box} bar</p>\n</li>\n</ul>\n`,
    ],
    [
      "- [x] foo\n  - [ ] bar",
      `<ul>\n<li>${checkedBox} foo\n<ul>\n<li>${box} bar</li>\n</ul>\n</li>\n</ul>\n`,
    ],
  ])("%j", (source, expected) => {
    expect(html(source)).toBe(expected);
  });

  it.each([
    ["- [ ]", "nothing after the marker"],
    ["- [ ]foo", "no space after the marker"],
    ["- [ ] \n  foo", "the text is on the next line"],
    ["- [y] foo", "another character in the brackets"],
    ["- [  ] foo", "two spaces in the brackets"],
    ["- text [ ] foo", "not at the start"],
    ["[ ] foo", "not in a list"],
    ["> [ ] foo", "not in a list"],
    ["- # [ ] foo", "not in a paragraph"],
  ])("%j is not a task (%s)", (source) => {
    expect(html(source)).not.toContain("<input");
  });

  it("shows the checkbox only once in an item with several paragraphs", () => {
    expect(html("- [x] a\n\n  b")).toBe(
      `<ul>\n<li>\n<p>${checkedBox} a</p>\n<p>b</p>\n</li>\n</ul>\n`,
    );
  });

  it("records the state on the list item", () => {
    const [list] = parseMarkdown("- [x] a\n- [ ] b\n- c", "a.md").document.children;
    const items = list?.kind === "list" ? list.items : [];
    expect(items.map((item) => item.checked)).toEqual([true, false, undefined]);
  });

  it("keeps exact positions after the marker", () => {
    const [list] = parseMarkdown("- [x] *a*", "a.md").document.children;
    const paragraph = list?.kind === "list" ? list.items[0]?.children[0] : undefined;
    const emphasis = paragraph?.kind === "paragraph" ? paragraph.inlines?.[0] : undefined;
    expect(emphasis?.span.start).toEqual({ line: 1, column: 7, offset: 6 });
    expect(paragraph?.span.start).toEqual({ line: 1, column: 7, offset: 6 });
  });
});
