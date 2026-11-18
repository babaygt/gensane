/** Character references (`&copy;`, `&#35;`, `&#x22;`) and backslash escapes. */
import { HTML_ENTITIES } from "./html-entities.ts";

const REFERENCE = /&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z][A-Za-z0-9]*));/y;

export interface DecodedReference {
  readonly text: string;
  readonly end: number;
}

/** Decodes the reference that starts at `position`, if there is a valid one. */
export function decodeCharacterReference(
  text: string,
  position: number,
): DecodedReference | undefined {
  REFERENCE.lastIndex = position;
  const match = REFERENCE.exec(text);
  if (match === null) return undefined;
  const end = position + match[0].length;

  const [, hex, decimal, name] = match;
  if (name !== undefined) {
    return Object.hasOwn(HTML_ENTITIES, name)
      ? { text: HTML_ENTITIES[name] ?? "", end }
      : undefined;
  }
  const code = hex === undefined ? Number(decimal) : Number.parseInt(hex, 16);
  return { text: codePointToString(code), end };
}

/** Invalid code points become the replacement character, as the spec requires. */
function codePointToString(code: number): string {
  const isSurrogate = code >= 0xd800 && code <= 0xdfff;
  return code === 0 || code > 0x10ffff || isSurrogate ? "�" : String.fromCodePoint(code);
}

const ESCAPE_OR_REFERENCE = /\\[!-/:-@[-`{-~]|&#?[A-Za-z0-9]+;/g;

/** Resolves escapes and references in text that is not parsed further, such as a URL. */
export function unescapeString(text: string): string {
  return text.replace(ESCAPE_OR_REFERENCE, (match) =>
    match.startsWith("\\") ? match.slice(1) : (decodeCharacterReference(match, 0)?.text ?? match),
  );
}
