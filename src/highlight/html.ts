/**
 * HTML needs a scanner of its own, because the same character means different things inside and
 * outside a tag: an apostrophe in text is just text, but in a tag it starts a value. Code inside
 * `<script>` and `<style>` is colored as JavaScript and CSS.
 */
import { SPECS } from "./languages.ts";
import { scan } from "./scanner.ts";
import type { Token } from "./tokens.ts";

const TAG_NAME = /<\/?([A-Za-z][\w:-]*)/y;

export function scanHtml(code: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  const take = (kind: Token["kind"], end: number) => {
    tokens.push({ kind, text: code.slice(at, end) });
    at = end;
  };
  while (at < code.length) {
    if (code.startsWith("<!--", at)) {
      const end = code.indexOf("-->", at + 4);
      take("comment", end === -1 ? code.length : end + 3);
      continue;
    }
    TAG_NAME.lastIndex = at;
    const tag = TAG_NAME.exec(code);
    if (tag === null) {
      take("plain", at + 1);
      continue;
    }
    const name = tag[1] ?? "";
    take("plain", at + tag[0].length - name.length);
    take("keyword", at + name.length);
    at = scanInsideTag(code, at, tokens);
    const inner = !tag[0].startsWith("</") && ["script", "style"].includes(name.toLowerCase());
    if (inner) {
      const close = code.toLowerCase().indexOf(`</${name.toLowerCase()}`, at);
      const end = close === -1 ? code.length : close;
      tokens.push(
        ...scan(code.slice(at, end), name.toLowerCase() === "style" ? SPECS.css : SPECS.javascript),
      );
      at = end;
    }
  }
  return tokens;
}

/** From after a tag's name to after its `>`: values in quotes are strings, the rest is plain. */
function scanInsideTag(code: string, start: number, tokens: Token[]): number {
  let at = start;
  while (at < code.length && code[at] !== ">") {
    const quote = code[at];
    if (quote === '"' || quote === "'") {
      const close = code.indexOf(quote, at + 1);
      const end = close === -1 ? code.length : close + 1;
      tokens.push({ kind: "string", text: code.slice(at, end) });
      at = end;
    } else {
      tokens.push({ kind: "plain", text: code[at] ?? "" });
      at += 1;
    }
  }
  if (at < code.length) {
    tokens.push({ kind: "plain", text: ">" });
    at += 1;
  }
  return at;
}
