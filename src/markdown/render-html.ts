/**
 * Final stage of the compiler: turn the syntax tree into HTML.
 *
 * This is the only place that produces HTML, so escaping is decided here once
 * instead of being spread across the code. Output follows the format of the
 * CommonMark reference renderer, which lets us compare against its examples.
 */
import { assertNever } from "../diagnostics/index.ts";
import type { Block, Document, Inline, ListItem, Table, TableAlignment, TableRow } from "./ast.ts";

export function renderHtml(document: Document): string {
  return renderBlocks(document.children);
}

function renderBlocks(blocks: readonly Block[]): string {
  return blocks.map(renderBlock).join("");
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case "heading":
      return `<h${block.level}>${renderText(block)}</h${block.level}>\n`;
    case "paragraph":
      return `<p>${renderText(block)}</p>\n`;
    case "code": {
      const languageClass =
        block.language === undefined ? "" : ` class="language-${escapeHtml(block.language)}"`;
      return `<pre><code${languageClass}>${escapeHtml(block.text)}</code></pre>\n`;
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
    case "html-block":
      return `${block.text}\n`;
    default:
      return assertNever(block);
  }
}

/** In a tight list, paragraphs are written without `<p>`; other blocks start on a new line. */
function renderListItem(item: ListItem, tight: boolean): string {
  let html = "<li>";
  for (const child of item.children) {
    if (tight && child.kind === "paragraph") {
      html += renderText(child);
    } else {
      if (!html.endsWith("\n")) html += "\n";
      html += renderBlock(child);
    }
  }
  return `${html}</li>\n`;
}

/** A tree that skipped the inline stage still renders, with its text shown literally. */
function renderText(node: { readonly text: string; readonly inlines?: readonly Inline[] }): string {
  return node.inlines === undefined ? escapeHtml(node.text) : renderInlines(node.inlines);
}

function renderInlines(inlines: readonly Inline[]): string {
  return inlines.map(renderInline).join("");
}

function renderInline(inline: Inline): string {
  switch (inline.kind) {
    case "text":
      return escapeHtml(inline.text);
    case "code-span":
      return `<code>${escapeHtml(inline.text)}</code>`;
    case "emphasis":
      return `<em>${renderInlines(inline.children)}</em>`;
    case "strong":
      return `<strong>${renderInlines(inline.children)}</strong>`;
    case "strikethrough":
      return `<del>${renderInlines(inline.children)}</del>`;
    case "hard-break":
      return "<br />\n";
    case "soft-break":
      return "\n";
    case "raw-html":
      return inline.text;
    case "link":
      return `<a href="${renderUrl(inline.url)}"${renderTitle(inline.title)}>${renderInlines(inline.children)}</a>`;
    case "image": {
      const alt = escapeHtml(plainText(inline.children));
      return `<img src="${renderUrl(inline.url)}" alt="${alt}"${renderTitle(inline.title)} />`;
    }
    default:
      return assertNever(inline);
  }
}

function renderTitle(title: string | undefined): string {
  return title === undefined ? "" : ` title="${escapeHtml(title)}"`;
}

/** The text of an image description, without any formatting. */
function plainText(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => {
      switch (inline.kind) {
        case "text":
        case "code-span":
        case "raw-html":
          return inline.text;
        case "hard-break":
        case "soft-break":
          return "\n";
        case "emphasis":
        case "strong":
        case "strikethrough":
        case "link":
        case "image":
          return plainText(inline.children);
        default:
          return assertNever(inline);
      }
    })
    .join("");
}

/** Percent-encodes a URL for an attribute, leaving existing `%XX` sequences alone. */
function renderUrl(url: string): string {
  // `encodeURI` throws on half of a surrogate pair, which random input can contain.
  const wellFormed = url.replace(/\p{Surrogate}/gu, "\uFFFD");
  const encoded = wellFormed
    .split(/(%[0-9a-fA-F]{2})/)
    .map((part, partIndex) => (partIndex % 2 === 1 ? part : encodeURI(part)))
    .join("");
  return escapeHtml(encoded);
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
    return `<${tag}${align}>${renderText(cell)}</${tag}>\n`;
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
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character] ?? character);
}
