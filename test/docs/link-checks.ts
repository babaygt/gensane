import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";
import { declaresSymbol, findLinks, headingIds, isExternalLink, linkedSymbol } from "./doc-rules.ts";

/** Every link on a page must lead to a file, and every linked name must exist in that file. */
export function checkLinks(path: string, text: string): void {
  const localLinks = findLinks(text).filter((link) => !isExternalLink(link.target));
  // Pictures in HTML too, such as the screenshots of the README, but not the HTML of examples in code.
  const outsideCode = text.replaceAll(/^(`{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
  const pictures = [...outsideCode.matchAll(/\s(?:src|srcset)="([^"]+)"/g)]
    .map(([, target]) => target ?? "")
    .filter((target) => !isExternalLink(target));

  it.each(pictures)("shows %s", (target) => {
    expect(existsSync(resolve(dirname(path), target))).toBe(true);
  });

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
