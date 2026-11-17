/**
 * Final stage of the compiler: turn the syntax tree into HTML.
 *
 * This is the only place that produces HTML, so escaping is decided here once
 * instead of being spread across the code. Output follows the format of the
 * CommonMark reference renderer, which lets us compare against its examples.
 */
import { assertNever } from "../diagnostics/index.ts";
import type { Block, Document } from "./ast.ts";

export function renderHtml(document: Document): string {
  return document.children.map(renderBlock).join("");
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case "heading":
      return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>\n`;
    case "paragraph":
      return `<p>${escapeHtml(block.text)}</p>\n`;
    case "code": {
      const cls = block.lang === undefined ? "" : ` class="language-${escapeHtml(block.lang)}"`;
      return `<pre><code${cls}>${escapeHtml(block.text)}</code></pre>\n`;
    }
    case "thematic-break":
      return "<hr />\n";
    default:
      return assertNever(block);
  }
}

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Makes text safe to place in HTML content and in double-quoted attributes. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ESCAPES[ch] ?? ch);
}
