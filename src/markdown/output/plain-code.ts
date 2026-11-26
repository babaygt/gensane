/** The code blocks no highlighter colored: a colored block has become HTML, so what is still code is plain. */
import { assertNever } from "../../diagnostics/index.ts";
import type { Block, CodeBlock, Document } from "../ast.ts";

/** In the order they are written, then those in footnotes. */
export function plainCodeBlocks(document: Document): CodeBlock[] {
  const footnotes = document.footnotes?.flatMap((footnote) => footnote.children) ?? [];
  return [...document.children, ...footnotes].flatMap(codeIn);
}

function codeIn(block: Block): CodeBlock[] {
  switch (block.kind) {
    case "code":
      return [block];
    case "block-quote":
    case "footnote-definition":
      return block.children.flatMap(codeIn);
    case "list":
      return block.items.flatMap((item) => item.children.flatMap(codeIn));
    case "heading":
    case "paragraph":
    case "html-block":
    case "table":
    case "thematic-break":
      return [];
    default:
      return assertNever(block);
  }
}
