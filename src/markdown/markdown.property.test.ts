// Property-based tests: instead of hand-picked examples, fast-check generates
// thousands of random Markdown-like documents and checks rules that must hold
// for every input. When one fails, it shrinks the input to a minimal example.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { positionAt } from "../diagnostics/index.ts";
import { markdownToHtml, parseMarkdown } from "./index.ts";
import { allSpans } from "./test-helpers.ts";

/** Random documents built from the pieces that matter to the block parser. */
const markdownLike = fc.string({
  unit: fc.constantFrom(
    "\n",
    "\r\n",
    "\r",
    " ",
    "    ",
    "\t",
    "#",
    "## ",
    "```",
    "~~~",
    "````",
    "---",
    "***",
    "___",
    "===",
    "- - -",
    ">",
    "> ",
    "- ",
    "* ",
    "1. ",
    "2) ",
    "[",
    "]",
    "](",
    ")",
    "![",
    "[a]: /u\n",
    "[a]",
    "<http://a>",
    "&amp;",
    "&#35;",
    "*",
    "**",
    "_",
    "__",
    "~~",
    "  \n",
    "|",
    "| ",
    " | ",
    "\\|",
    "| - |",
    ":-:",
    "  ",
    "a",
    "word",
    "<",
    ">",
    "&",
    '"',
    "`",
    "\\",
  ),
  maxLength: 60,
});

describe("Markdown parser properties", () => {
  it("never throws, whatever the input", () => {
    fc.assert(
      fc.property(fc.oneof(markdownLike, fc.string({ unit: "binary" })), (source) => {
        expect(() => markdownToHtml(source, "x.md")).not.toThrow();
      }),
    );
  });

  it("gives every block a span inside the source, in document order", () => {
    fc.assert(
      fc.property(markdownLike, (source) => {
        const { document } = parseMarkdown(source, "x.md");
        let previousEnd = 0;
        for (const block of document.children) {
          const { start, end } = block.span;
          expect(start.offset).toBeGreaterThanOrEqual(previousEnd);
          expect(end.offset).toBeGreaterThanOrEqual(start.offset);
          expect(end.offset).toBeLessThanOrEqual(source.length);
          previousEnd = end.offset;
        }
      }),
    );
  });

  it("computes the same line:column as an independent, simpler implementation, at any depth", () => {
    fc.assert(
      fc.property(markdownLike, (source) => {
        const { document, diagnostics } = parseMarkdown(source, "x.md");
        const spans = [...allSpans(document.children), ...diagnostics.map((d) => d.span)];
        for (const span of spans) {
          expect(span.start).toEqual(positionAt(source, span.start.offset));
          expect(span.end).toEqual(positionAt(source, span.end.offset));
        }
      }),
    );
  });

  it("never lets user text produce HTML tags", () => {
    const ourTags =
      /<\/?(?:h[1-6]|p|pre|code|hr|blockquote|ul|ol|li|table|thead|tbody|tr|th|td|em|strong|del|br|a)(?: class="language-[^"<>]*"| start="\d+"| align="(?:left|center|right)"| href="[^"<>]*"(?: title="[^"<>]*")?)? ?\/?>|<img src="[^"<>]*" alt="[^"<>]*"(?: title="[^"<>]*")? \/>/g;
    fc.assert(
      fc.property(markdownLike, (source) => {
        const withoutOurTags = markdownToHtml(source, "x.md").html.replace(ourTags, "");
        expect(withoutOurTags).not.toMatch(/[<>]/);
      }),
    );
  });

  it("always produces properly nested HTML", () => {
    const tag = /<(\/?)([a-z0-9]+)[^>]*?(\/?)>/g;
    fc.assert(
      fc.property(markdownLike, (source) => {
        const open: string[] = [];
        const mismatches: string[] = [];
        for (const [, closing, name = "", selfClosing] of markdownToHtml(
          source,
          "x.md",
        ).html.matchAll(tag)) {
          if (selfClosing) continue;
          if (!closing) open.push(name);
          else if (open.pop() !== name) mismatches.push(name);
        }
        expect({ mismatches, unclosed: open }).toEqual({ mismatches: [], unclosed: [] });
      }),
    );
  });
});
