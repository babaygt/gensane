/**
 * Final stage of the compiler: turn the syntax tree into HTML.
 *
 * This is the only place that produces HTML, so escaping is decided here once
 * instead of being spread across the code. Output follows the format of the
 * CommonMark reference renderer, which lets us compare against its examples.
 */
import { assertNever } from "../diagnostics/index.ts";
import type {
  CalloutKind,
  Footnote,
  FootnoteReference,
  Block,
  Document,
  Inline,
  ListItem,
  Table,
  TableAlignment,
  TableRow,
} from "./ast.ts";
import { plainTextOf } from "./inline-text.ts";

export function renderHtml(document: Document): string {
  return renderBlocks(document.children) + renderFootnotes(document.footnotes ?? []);
}

function renderBlocks(blocks: readonly Block[]): string {
  return blocks.map(renderBlock).join("");
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case "heading": {
      const id = block.id === undefined ? "" : ` id="${escapeHtml(block.id)}"`;
      return `<h${block.level}${id}>${renderText(block)}</h${block.level}>\n`;
    }
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
      return block.callout === undefined
        ? `<blockquote>\n${renderBlocks(block.children)}</blockquote>\n`
        : renderCallout(block.callout, block.children);
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
    case "footnote-definition":
      // Definitions have moved to the end of the document by the time a tree is rendered.
      return "";
    default:
      return assertNever(block);
  }
}

const CALLOUT_TITLES: Readonly<Record<CalloutKind, string>> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
};

function renderCallout(kind: CalloutKind, children: readonly Block[]): string {
  const title = `<p class="callout-title">${CALLOUT_TITLES[kind]}</p>\n`;
  return `<div class="callout callout-${kind}">\n${title}${renderBlocks(children)}</div>\n`;
}

function renderCheckbox(checked: boolean): string {
  return `<input ${checked ? 'checked="" ' : ""}disabled="" type="checkbox" /> `;
}

/** In a tight list, paragraphs are written without `<p>`; other blocks start on a new line. */
function renderListItem(item: ListItem, tight: boolean): string {
  // A task's checkbox goes in front of the text of its first paragraph.
  let checkbox = item.checked === undefined ? "" : renderCheckbox(item.checked);
  let html = "<li>";
  for (const child of item.children) {
    if (child.kind === "paragraph") {
      const content = `${checkbox}${renderText(child)}`;
      if (tight) {
        html += content;
      } else {
        if (!html.endsWith("\n")) html += "\n";
        html += `<p>${content}</p>\n`;
      }
    } else {
      if (!html.endsWith("\n")) html += "\n";
      html += renderBlock(child);
    }
    checkbox = "";
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
    case "footnote-reference":
      return renderFootnoteReference(inline);
    case "link":
      return `<a href="${renderUrl(inline.url)}"${renderTitle(inline.title)}>${renderInlines(inline.children)}</a>`;
    case "image": {
      const alt = escapeHtml(plainTextOf(inline.children));
      return `<img src="${renderUrl(inline.url)}" alt="${alt}"${renderTitle(inline.title)} />`;
    }
    default:
      return assertNever(inline);
  }
}

function renderFootnoteReference(reference: FootnoteReference): string {
  const { label, number, referenceIndex = 1 } = reference;
  if (number === undefined) return escapeHtml(`[^${label}]`);
  const id = `fnref-${number}${referenceSuffix(referenceIndex)}`;
  return `<sup class="footnote-ref"><a href="#fn-${number}" id="${id}">${number}</a></sup>`;
}

/** The first reference to a note has no suffix; later ones get `-2`, `-3` and so on. */
function referenceSuffix(referenceIndex: number): string {
  return referenceIndex === 1 ? "" : `-${referenceIndex}`;
}

function renderFootnotes(footnotes: readonly Footnote[]): string {
  if (footnotes.length === 0) return "";
  const items = footnotes.map(renderFootnote).join("");
  return `<section class="footnotes">\n<ol>\n${items}</ol>\n</section>\n`;
}

/** The links back to the text join the last paragraph of the note, if it ends with one. */
function renderFootnote(footnote: Footnote): string {
  const links = Array.from({ length: footnote.referenceCount }, (_, position) =>
    renderBackReference(footnote.number, position + 1),
  ).join(" ");
  const last = footnote.children.at(-1);
  const body =
    last?.kind === "paragraph"
      ? `${renderBlocks(footnote.children.slice(0, -1))}<p>${renderText(last)} ${links}</p>\n`
      : `${renderBlocks(footnote.children)}<p>${links}</p>\n`;
  return `<li id="fn-${footnote.number}">\n${body}</li>\n`;
}

function renderBackReference(number: number, referenceIndex: number): string {
  const suffix = referenceSuffix(referenceIndex);
  const mark = referenceIndex === 1 ? "↩" : `↩${referenceIndex}`;
  return `<a href="#fnref-${number}${suffix}" class="footnote-backref" aria-label="Back to reference ${number}${suffix}">${mark}</a>`;
}

function renderTitle(title: string | undefined): string {
  return title === undefined ? "" : ` title="${escapeHtml(title)}"`;
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
