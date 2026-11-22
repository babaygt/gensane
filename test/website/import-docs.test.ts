import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPOSITORY, outsideCode, placesOf, rewriteLink } from "../../scripts/import-docs.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const placed = placesOf();
const addresses = new Map(
  placed.flatMap(({ node, url }) => (node.from === undefined ? [] : [[node.from, url] as const])),
);

describe("the structure of the documentation", () => {
  it("has every page of docs/ exactly once, so a new page can't be left out", () => {
    const pages = readdirSync(join(packageRoot, "docs"), { recursive: true })
      .map(String)
      .filter((path) => path.endsWith(".md"))
      .map((path) => path.split("\\\\").join("/"))
      .toSorted();
    const listed = placed.flatMap(({ node }) => (node.from === undefined ? [] : [node.from]));
    expect(listed.toSorted()).toEqual(pages);
  });

  it("gives every page and folder an address of its own", () => {
    const urls = placed.map(({ url }) => url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("rewriteLink", () => {
  it.each([
    ["init.md", "cli/README.md", "/docs/reference/commands/init/"],
    ["../core/site.md#sections", "cli/theme.md", "/docs/reference/site/pages/#sections"],
    ["README.md", "core/content.md", "/docs/internals/core/"],
    ["../../src/cli/run-cli.ts", "cli/README.md", `${REPOSITORY}/blob/main/src/cli/run-cli.ts`],
    ["../../src/core", "core/README.md", `${REPOSITORY}/tree/main/src/core`],
    ["https://example.com", "cli/README.md", "https://example.com"],
    ["#exit-codes", "cli/README.md", "#exit-codes"],
  ])("leads %s, written in %s, to %s", (target, from, expected) => {
    expect(rewriteLink(target, from, addresses)).toBe(expected);
  });

  it("refuses a link to a page that isn't in the structure", () => {
    expect(() => rewriteLink("missing.md", "cli/README.md", addresses)).toThrow(
      "cli/README.md links to missing.md, which isn't in the documentation's structure",
    );
  });
});

const upper = (text: string) => text.toUpperCase();

describe("outsideCode", () => {
  it.each([
    ["a `b` c", "A `b` C"],
    ["a `` ` `` b", "A `` ` `` B"],
    ["a ``x`y`` b `z`", "A ``x`y`` B `z`"],
    ["a `open", "A `OPEN"],
  ])("changes %j only outside its inline code", (line, expected) => {
    expect(outsideCode(line, upper)).toBe(expected);
  });
});

describe("links to the code", () => {
  it("lead only to files and folders the repository has", async () => {
    const { readFile } = await import("node:fs/promises");
    const missing: string[] = [];
    for (const { node } of placed) {
      if (node.from === undefined) continue;
      const markdown = await readFile(join(packageRoot, "docs", node.from), "utf8");
      for (const [, target = ""] of markdown.matchAll(/\]\((\.\.\/\.\.\/[^)#\s]+)/g)) {
        const path = rewriteLink(target, node.from, addresses).replace(
          /^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/main\//,
          "",
        );
        if (!existsSync(join(packageRoot, path))) missing.push(`${node.from}: ${target}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
