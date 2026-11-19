import { type Document, renderHtml } from "../../markdown/index.ts";

const WORDS_PER_MINUTE = 200;
const MORE_MARKER = "<!-- more -->";

/** The HTML before `<!-- more -->`, or else the first paragraph. */
export function excerptOf(document: Document): string {
  const marker = document.children.findIndex(
    (block) => block.kind === "html-block" && block.text.trim() === MORE_MARKER,
  );
  const blocks =
    marker >= 0
      ? document.children.slice(0, marker)
      : document.children.filter((block) => block.kind === "paragraph").slice(0, 1);
  return renderHtml({ kind: "document", children: blocks, span: document.span });
}

/**
 * Counts the words of the text, without the tags and attributes around it. Blocks are always
 * separated by a line break, so a tag inside a word, as in `one<em>two</em>`, doesn't split it.
 */
export function readingTimeOf(html: string): number {
  const words = html
    .replace(/<[^>]*>/g, "")
    .split(/\s+/)
    .filter((word) => word !== "").length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
