/**
 * The words search finds, as the build and the search script both cut them: lowercase, without
 * accents, at least 2 letters or digits long, each once. The script in the theme has the same rules,
 * and a test checks that both always agree.
 */
export function wordsOf(text: string): string[] {
  const words = text
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2);
  return [...new Set(words)];
}

/** The text of some HTML, without its tags, and with character references as a space. */
export function textOf(html: string): string {
  return html.replaceAll(/<[^>]*>/g, "").replaceAll(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, " ");
}
