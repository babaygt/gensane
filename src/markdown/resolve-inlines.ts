/**
 * Runs the inline parser over every block that contains text, producing a new tree.
 * This is a separate pass because block structure must be known first.
 */
import { assertNever } from "../diagnostics/index.ts";
import type { Block, Document, TableRow } from "./ast.ts";
import { parseInlines } from "./inline-parser.ts";

export function resolveInlines(document: Document): Document {
  const file = document.span.file;

  function resolveBlock(block: Block): Block {
    switch (block.kind) {
      case "heading":
      case "paragraph":
        return { ...block, inlines: parseInlines(block.text, block.segments, file) };
      case "block-quote":
        return { ...block, children: block.children.map(resolveBlock) };
      case "list": {
        const items = block.items.map((item) => ({
          ...item,
          children: item.children.map(resolveBlock),
        }));
        return { ...block, items };
      }
      case "table":
        return {
          ...block,
          header: resolveRow(block.header),
          rows: block.rows.map(resolveRow),
        };
      case "code":
      case "thematic-break":
        return block;
      default:
        return assertNever(block);
    }
  }

  function resolveRow(row: TableRow): TableRow {
    const cells = row.cells.map((cell) => ({
      ...cell,
      inlines: parseInlines(cell.text, cell.segments, file),
    }));
    return { ...row, cells };
  }

  return { ...document, children: document.children.map(resolveBlock) };
}
