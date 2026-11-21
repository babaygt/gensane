/**
 * The highlighter gensane uses when the config has none: it colors keywords, strings, numbers and
 * comments in the languages a developer's blog uses most, at build time and with no dependency.
 */
import { scanHtml } from "./html.ts";
import { LANGUAGE_NAMES, SPECS } from "./languages.ts";
import { scan } from "./scanner.ts";
import { merged, renderTokens } from "./tokens.ts";

export { LANGUAGE_NAMES } from "./languages.ts";
export type { Token, TokenKind } from "./tokens.ts";

/** The HTML for inside `<code>`, or `undefined` for a language it doesn't know, which then stays plain. */
export function highlight(code: string, language: string | undefined): string | undefined {
  const key = language?.toLowerCase();
  // Only the table's own names: `constructor` and the like are not languages.
  const name =
    key !== undefined && Object.hasOwn(LANGUAGE_NAMES, key) ? LANGUAGE_NAMES[key] : undefined;
  if (name === undefined) return undefined;
  const tokens = name === "html" ? scanHtml(code) : scan(code, SPECS[name]);
  return renderTokens(merged(tokens));
}
