/** What a highlighter finds in code. Everything that isn't one of these kinds is plain text. */
export type TokenKind = "keyword" | "string" | "number" | "comment" | "plain";

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** The HTML for inside `<code>`: plain text escaped, every other token in a `<span class="hl-...">`. */
export function renderTokens(tokens: readonly Token[]): string {
  return tokens
    .map(({ kind, text }) =>
      kind === "plain" ? escapeHtml(text) : `<span class="hl-${kind}">${escapeHtml(text)}</span>`,
    )
    .join("");
}

/** Joins neighbouring tokens of the same kind, so the HTML has no more spans than it needs. */
export function merged(tokens: readonly Token[]): Token[] {
  const result: Token[] = [];
  for (const token of tokens) {
    if (token.text === "") continue;
    const last = result.at(-1);
    if (last?.kind === token.kind)
      result[result.length - 1] = { kind: last.kind, text: last.text + token.text };
    else result.push(token);
  }
  return result;
}
