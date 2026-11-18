import { describe, expect, it } from "vitest";
import { markdownToHtml, parseMarkdown } from "./index.ts";

function html(source: string): string {
  return markdownToHtml(source, "test.md").html;
}

describe("callouts", () => {
  it.each([
    ["NOTE", "note", "Note"],
    ["TIP", "tip", "Tip"],
    ["IMPORTANT", "important", "Important"],
    ["WARNING", "warning", "Warning"],
    ["CAUTION", "caution", "Caution"],
  ])("renders [!%s]", (marker, kind, title) => {
    expect(html(`> [!${marker}]\n> Be careful.`)).toBe(
      `<div class="callout callout-${kind}">\n<p class="callout-title">${title}</p>\n<p>Be careful.</p>\n</div>\n`,
    );
  });

  it("ignores the case of the marker", () => {
    expect(html("> [!note]\n> a")).toContain("callout-note");
  });

  it("allows spaces after the marker", () => {
    expect(html("> [!TIP]  \n> a")).toContain("callout-tip");
  });

  it("keeps other blocks inside", () => {
    expect(html("> [!NOTE]\n> a\n>\n> - b")).toBe(
      '<div class="callout callout-note">\n<p class="callout-title">Note</p>\n<p>a</p>\n<ul>\n<li>b</li>\n</ul>\n</div>\n',
    );
  });

  it("can hold only a title", () => {
    expect(html("> [!NOTE]")).toBe(
      '<div class="callout callout-note">\n<p class="callout-title">Note</p>\n</div>\n',
    );
  });

  it("works when nested in another block quote", () => {
    expect(html("> > [!TIP]\n> > a")).toContain('<blockquote>\n<div class="callout callout-tip">');
  });

  it("works when nested in a list", () => {
    expect(html("- > [!TIP]\n  > a")).toContain("callout-tip");
  });

  it.each([
    ["> [!OTHER]\n> a", "an unknown kind"],
    ["> [!NOTE] title\n> a", "text after the marker"],
    ["> a\n> [!NOTE]", "not on the first line"],
    ["[!NOTE]\na", "not in a block quote"],
  ])("%j stays as it is (%s)", (source) => {
    expect(html(source)).not.toContain("callout");
  });

  it("records the kind on the block quote", () => {
    const [quote] = parseMarkdown("> [!WARNING]\n> a", "a.md").document.children;
    expect(quote).toMatchObject({ kind: "block-quote", callout: "warning" });
  });

  it("keeps exact positions after the marker", () => {
    const [quote] = parseMarkdown("> [!NOTE]\n> *a*", "a.md").document.children;
    const paragraph = quote?.kind === "block-quote" ? quote.children[0] : undefined;
    const emphasis = paragraph?.kind === "paragraph" ? paragraph.inlines?.[0] : undefined;
    expect(emphasis?.span.start).toEqual({ line: 2, column: 3, offset: 12 });
  });
});
