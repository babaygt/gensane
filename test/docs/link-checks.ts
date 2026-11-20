import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";
import { declaresSymbol, findLinks, headingIds, isExternalLink, linkedSymbol } from "./doc-rules.ts";

/** Every link on a page must lead to a file, and every linked name must exist in that file. */
export function checkLinks(path: string, text: string): void {
  const localLinks = findLinks(text).filter((link) => !isExternalLink(link.target));

  it.each(localLinks.map((link) => [link.target, link] as const))("links to %s", (target) => {
    const [file = "", part] = target.split("#");
    const linked = resolve(dirname(path), file);
    expect(existsSync(linked)).toBe(true);
    // A link to a part of a page, such as `folders.md#where-the-site-is-written`, needs that heading.
    const ids = part === undefined ? [] : headingIds(readFileSync(linked, "utf8"));
    expect(part === undefined || ids.includes(part)).toBe(true);
  });

  const codeLinks = localLinks.flatMap((link) => {
    const symbol = linkedSymbol(link);
    return symbol === undefined ? [] : [[symbol, link.target] as const];
  });
  it.each(codeLinks)("%s exists in %s", (symbol, target) => {
    const source = readFileSync(resolve(dirname(path), target), "utf8");
    expect(declaresSymbol(source, symbol)).toBe(true);
  });
}
