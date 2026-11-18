/**
 * Raw HTML in Markdown. An HTML block starts in one of the seven ways CommonMark defines,
 * and each way has its own end condition. Inline, a complete tag is passed through as it is.
 */

/**
 * The numbers are the seven start conditions of the CommonMark spec, in the same order:
 * https://spec.commonmark.org/0.31.2/#html-blocks
 */
export type HtmlBlockType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Types 1 to 5 end at a marker; types 6 and 7 end at a blank line. */
export type MarkedHtmlBlockType = Exclude<HtmlBlockType, 6 | 7>;

// Pieces of regular expressions, combined below into the patterns for complete HTML tags.
const WHITESPACE = "[ \\t\\n]";
const ATTRIBUTE_NAME = "[a-zA-Z_:][a-zA-Z0-9_.:-]*";
const ATTRIBUTE_VALUE = `(?:[^ \\t\\n"'=<>\`]+|'[^']*'|"[^"]*")`;
const ATTRIBUTE = `${WHITESPACE}+${ATTRIBUTE_NAME}(?:${WHITESPACE}*=${WHITESPACE}*${ATTRIBUTE_VALUE})?`;
const OPEN_TAG = `<[A-Za-z][A-Za-z0-9-]*(?:${ATTRIBUTE})*${WHITESPACE}*/?>`;
const CLOSING_TAG = `</[A-Za-z][A-Za-z0-9-]*${WHITESPACE}*>`;

const VERBATIM_ELEMENTS = "pre|script|style|textarea";
const BLOCK_ELEMENTS =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|" +
  "dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|" +
  "head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|" +
  "option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";

const BLOCK_STARTS: readonly (readonly [MarkedHtmlBlockType | 6, RegExp])[] = [
  [1, new RegExp(`^ {0,3}<(?:${VERBATIM_ELEMENTS})(?:[ \\t>]|$)`, "i")],
  [2, /^ {0,3}<!--/],
  [3, /^ {0,3}<\?/],
  [5, /^ {0,3}<!\[CDATA\[/],
  [4, /^ {0,3}<![A-Za-z]/],
  [6, new RegExp(`^ {0,3}</?(?:${BLOCK_ELEMENTS})(?:[ \\t]|/?>|$)`, "i")],
];

const COMPLETE_TAG_LINE = new RegExp(`^ {0,3}(?:${OPEN_TAG}|${CLOSING_TAG})[ \\t]*$`);
const VERBATIM_TAG_NAME = new RegExp(`^ {0,3}</?(?:${VERBATIM_ELEMENTS})[ \\t/>]`, "i");

export function matchHtmlBlockStart(text: string): HtmlBlockType | undefined {
  for (const [type, pattern] of BLOCK_STARTS) {
    if (pattern.test(text)) return type;
  }
  return COMPLETE_TAG_LINE.test(text) && !VERBATIM_TAG_NAME.test(text) ? 7 : undefined;
}

const BLOCK_ENDS: Readonly<Record<MarkedHtmlBlockType, RegExp>> = {
  1: new RegExp(`</(?:${VERBATIM_ELEMENTS})>`, "i"),
  2: /-->/,
  3: /\?>/,
  4: />/,
  5: /\]\]>/,
};

export function endsHtmlBlock(type: MarkedHtmlBlockType, text: string): boolean {
  return BLOCK_ENDS[type].test(text);
}

const TAG = new RegExp(`${OPEN_TAG}|${CLOSING_TAG}`, "y");

/**
 * Returns where the raw HTML that starts at `pos` ends. `missing` remembers terminators that
 * do not occur in the rest of the text, so many unclosed comments don't rescan it each time.
 * The accepted forms are listed at https://spec.commonmark.org/0.31.2/#raw-html
 */
export function parseRawHtml(
  text: string,
  pos: number,
  missing: Map<string, number>,
): number | undefined {
  if (text.startsWith("<!-->", pos)) return pos + 5;
  if (text.startsWith("<!--->", pos)) return pos + 6;
  if (text.startsWith("<!--", pos)) return endOf(text, "-->", pos + 4, missing);
  if (text.startsWith("<?", pos)) return endOf(text, "?>", pos + 2, missing);
  if (text.startsWith("<![CDATA[", pos)) return endOf(text, "]]>", pos + 9, missing);
  if (/[A-Za-z]/.test(text[pos + 2] ?? "") && text.startsWith("<!", pos)) {
    return endOf(text, ">", pos + 2, missing);
  }
  TAG.lastIndex = pos;
  return TAG.test(text) ? TAG.lastIndex : undefined;
}

function endOf(
  text: string,
  terminator: string,
  from: number,
  missing: Map<string, number>,
): number | undefined {
  if ((missing.get(terminator) ?? Infinity) <= from) return undefined;
  const index = text.indexOf(terminator, from);
  if (index !== -1) return index + terminator.length;
  missing.set(terminator, from);
  return undefined;
}
