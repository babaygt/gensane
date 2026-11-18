/**
 * Final stage of the compiler: turn the syntax tree into HTML.
 *
 * This is the only place that produces HTML, so escaping is decided here once
 * instead of being spread across the code. Output follows the format of the
 * CommonMark reference renderer, which lets us compare against its examples.
 */
import { assertNever } from "../diagnostics/index.ts";
import type { Block, Document, ListItem, Table, TableAlignment, TableRow } from "./ast.ts";

export function renderHtml(document: Document): string {
  return renderBlocks(document.children);
}

function renderBlocks(blocks: readonly Block[]): string {
  return blocks.map(renderBlock).join("");
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
    case "block-quote":
      return `<blockquote>\n${renderBlocks(block.children)}</blockquote>\n`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const start = block.ordered && block.start !== 1 ? ` start="${block.start}"` : "";
      const items = block.items.map((item) => renderListItem(item, block.tight)).join("");
      return `<${tag}${start}>\n${items}</${tag}>\n`;
    }
    case "table":
      return renderTable(block);
    default:
      return assertNever(block);
  }
}

/** In a tight list, paragraphs are written without `<p>`; other blocks start on a new line. */
function renderListItem(item: ListItem, tight: boolean): string {
  let html = "<li>";
  for (const child of item.children) {
    if (tight && child.kind === "paragraph") {
      html += escapeHtml(child.text);
    } else {
      if (!html.endsWith("\n")) html += "\n";
      html += renderBlock(child);
    }
  }
  return `${html}</li>\n`;
}

function renderTable(table: Table): string {
  const head = `<thead>\n${renderRow(table.header, "th", table.alignments)}</thead>\n`;
  const rows = table.rows.map((row) => renderRow(row, "td", table.alignments)).join("");
  const body = table.rows.length === 0 ? "" : `<tbody>\n${rows}</tbody>\n`;
  return `<table>\n${head}${body}</table>\n`;
}

function renderRow(row: TableRow, tag: "th" | "td", alignments: readonly TableAlignment[]): string {
  const cells = row.cells.map((cell, column) => {
    const alignment = alignments[column] ?? "none";
    const align = alignment === "none" ? "" : ` align="${alignment}"`;
    return `<${tag}${align}>${escapeHtml(cell.text)}</${tag}>\n`;
  });
  return `<tr>\n${cells.join("")}</tr>\n`;
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
