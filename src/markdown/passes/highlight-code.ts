/**
 * Gives every code block to a highlighter, such as Shiki, at build time, so readers get colored code
 * without any JavaScript. A highlighted block becomes HTML; a block the highlighter gives nothing for
 * stays as it is.
 */
import { assertNever } from "../../diagnostics/index.ts";
import type { Block, Document } from "../ast.ts";
import { escapeHtml } from "../output/render-html.ts";

/** The HTML for the inside of `<code>`, or `undefined` to leave the block as it is. */
export type Highlighter = (code: string, language: string | undefined) => string | undefined;

export function highlightCode(document: Document, highlight: Highlighter): Document {
  const footnotes = document.footnotes?.map((footnote) => ({
    ...footnote,
    children: footnote.children.map((block) => highlightBlock(block, highlight)),
  }));
  return {
    ...document,
    children: document.children.map((block) => highlightBlock(block, highlight)),
    ...(footnotes === undefined ? {} : { footnotes }),
  };
}

function highlightBlock(block: Block, highlight: Highlighter): Block {
  switch (block.kind) {
    case "code": {
      const html = highlight(block.text, block.language);
      if (html === undefined) return block;
      const languageClass =
        block.language === undefined ? "" : ` class="language-${escapeHtml(block.language)}"`;
      return {
        kind: "html-block",
        text: `<pre><code${languageClass}>${html}</code></pre>`,
        span: block.span,
      };
    }
    case "block-quote":
    case "footnote-definition":
      return {
        ...block,
        children: block.children.map((child) => highlightBlock(child, highlight)),
      };
    case "list": {
      const items = block.items.map((item) => ({
        ...item,
        children: item.children.map((child) => highlightBlock(child, highlight)),
      }));
      return { ...block, items };
    }
    case "heading":
    case "paragraph":
    case "html-block":
    case "table":
    case "thematic-break":
      return block;
    default:
      return assertNever(block);
  }
}
