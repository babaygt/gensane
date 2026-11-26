/**
 * Code in a language gensane doesn't color is worth a word in `gensane check`, so a site knows to set
 * `markdown.highlight`: once for each language, at its first block, since ten blocks are one fact.
 */
import type { Diagnostic } from "../../diagnostics/index.ts";
import type { ContentEntry, PlainCode } from "../content/entries.ts";
import { CoreCodes } from "../diagnostic-codes.ts";
import { problem } from "../problems.ts";

/** Names that ask for plain text, so nothing is missing; `console` is a terminal, commands and what they print. */
const MEANT_PLAIN: ReadonlySet<string> = new Set([
  "text",
  "txt",
  "plain",
  "plaintext",
  "console",
  "mermaid",
]);

/** In the order of the files, which is the order a reader of the warnings goes through them. */
export function uncoloredCode(entries: readonly ContentEntry[]): Diagnostic[] {
  const byLanguage = new Map<string, PlainCode[]>();
  for (const entry of entries) {
    for (const block of entry.plainCode) {
      const language = block.language.toLowerCase();
      if (!MEANT_PLAIN.has(language))
        byLanguage.set(language, [...(byLanguage.get(language) ?? []), block]);
    }
  }
  return [...byLanguage].flatMap(([language, [first, ...rest]]) => {
    if (first === undefined) return [];
    const blocks = rest.length === 0 ? "1 block" : `${rest.length + 1} blocks`;
    return [
      problem(
        CoreCodes.uncoloredCode,
        `gensane doesn't color code in "${language}" (${blocks}; this is the first)`,
        first.span,
        'color it with your own markdown.highlight in the config, or write "text" after the backticks',
        "warning",
      ),
    ];
  });
}
