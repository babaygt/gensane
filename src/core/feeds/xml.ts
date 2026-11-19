const XML_ESCAPES: ReadonlyMap<string, string> = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&apos;"],
]);

/** Makes text safe inside XML elements and attributes. */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => XML_ESCAPES.get(character) ?? character);
}
