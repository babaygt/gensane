/**
 * A site served under a path, such as `https://ada.github.io/notes/`, needs `/notes` in front of every
 * link that starts at the root. Authors and themes write `/about/`, and this adds the path to the
 * finished HTML. It is a small scanner for tags and their attributes, not a full HTML parser: it only
 * finds where attribute values start, and changes nothing else.
 */

/** The attributes that hold an address, or a list of them in `srcset`; `action` is where a form goes. */
const ADDRESS_ATTRIBUTES = new Set(["href", "src", "srcset", "action"]);
/** Elements whose content is not HTML, so a `<` inside them doesn't start a tag. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);

function isRootRelative(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

function isSpace(character: string | undefined): boolean {
  return (
    character === " " ||
    character === "\n" ||
    character === "\t" ||
    character === "\r" ||
    character === "\f"
  );
}

class AttributeScanner {
  readonly #html: string;
  #index = 0;
  /** Where the path goes, as offsets into the HTML. */
  readonly insertions: number[] = [];

  constructor(html: string) {
    this.#html = html;
  }

  scan(): void {
    while (this.#index < this.#html.length) {
      const open = this.#html.indexOf("<", this.#index);
      if (open === -1) return;
      this.#index = open;
      if (this.#html.startsWith("<!--", open)) this.#skipPast("-->");
      else if (/^<[a-zA-Z]/.test(this.#html.slice(open, open + 2))) this.#tag();
      // `</p>`, `<!doctype html>` and a `<` in text have no attributes to change.
      else this.#index++;
    }
  }

  #skipPast(end: string): void {
    const found = this.#html.indexOf(end, this.#index);
    this.#index = found === -1 ? this.#html.length : found + end.length;
  }

  #skipSpaces(): void {
    while (isSpace(this.#html[this.#index])) this.#index++;
  }

  #readWhile(test: (character: string) => boolean): string {
    const start = this.#index;
    while (this.#index < this.#html.length && test(this.#html[this.#index] ?? "")) this.#index++;
    return this.#html.slice(start, this.#index);
  }

  #tag(): void {
    this.#index++;
    const name = this.#readWhile(
      (character) => !isSpace(character) && character !== ">" && character !== "/",
    ).toLowerCase();
    for (;;) {
      this.#skipSpaces();
      const next = this.#html[this.#index];
      if (next === undefined) return;
      if (next === ">") break;
      this.#attribute();
    }
    this.#index++;
    if (RAW_TEXT.has(name)) {
      const close = this.#html.toLowerCase().indexOf(`</${name}`, this.#index);
      this.#index = close === -1 ? this.#html.length : close;
    }
  }

  #attribute(): void {
    const name = this.#readWhile(
      (character) => !isSpace(character) && !"\"'>/=".includes(character),
    ).toLowerCase();
    if (name === "") {
      // The `/` of `<img />`, or a stray quote or `=`; step over it so the scan always moves on.
      this.#index++;
      return;
    }
    this.#skipSpaces();
    if (this.#html[this.#index] !== "=") return;
    this.#index++;
    this.#skipSpaces();
    const quote = this.#html[this.#index];
    let start: number;
    let end: number;
    if (quote === '"' || quote === "'") {
      start = this.#index + 1;
      const close = this.#html.indexOf(quote, start);
      end = close === -1 ? this.#html.length : close;
      this.#index = end + 1;
    } else {
      start = this.#index;
      this.#readWhile((character) => !isSpace(character) && character !== ">");
      end = this.#index;
    }
    if (ADDRESS_ATTRIBUTES.has(name)) this.#addresses(name, start, end);
  }

  /** `srcset` lists addresses with sizes, such as `/a.png 1x, /b.png 2x`. */
  #addresses(name: string, start: number, end: number): void {
    const value = this.#html.slice(start, end);
    if (name !== "srcset") {
      if (isRootRelative(value)) this.insertions.push(start);
      return;
    }
    let offset = 0;
    for (const candidate of value.split(",")) {
      const leading = candidate.length - candidate.trimStart().length;
      if (isRootRelative(candidate.trimStart())) this.insertions.push(start + offset + leading);
      offset += candidate.length + 1;
    }
  }
}

/** Adds `path`, such as `/notes`, to every `href`, `src`, `srcset` and `action` address that starts with one `/`. */
export function withBasePath(html: string, path: string): string {
  const scanner = new AttributeScanner(html);
  scanner.scan();
  let result = "";
  let last = 0;
  for (const at of scanner.insertions) {
    result += html.slice(last, at) + path;
    last = at;
  }
  return result + html.slice(last);
}
