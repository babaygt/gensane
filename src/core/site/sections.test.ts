import { describe, expect, it } from "vitest";
import type { EntryOf } from "../content/entries.ts";
import { loaded } from "../test-helpers.ts";
import { type SectionFolder, foldersAbove, readingOrder, sectionsOf } from "./sections.ts";

const page = (title: string, order?: number) =>
  `---\ntitle: ${title}\n${order === undefined ? "" : `order: ${order}\n`}---\n`;

function pagesOf(files: Readonly<Record<string, string>>): EntryOf<"page">[] {
  return loaded(files).filter((entry): entry is EntryOf<"page"> => entry.type === "page");
}

/** The tree as titles, so a test reads like the sidebar. */
function outline(folder: SectionFolder): unknown[] {
  return folder.items.map((item) =>
    item.kind === "page" ? item.page.fields.title : { [item.title]: outline(item) },
  );
}

const docs = {
  "pages/docs/index.md": page("Docs"),
  "pages/docs/start.md": page("Start", 1),
  "pages/docs/faq.md": page("FAQ"),
  "pages/docs/guides/index.md": page("Guides", 2),
  "pages/docs/guides/write.md": page("Write"),
  "pages/docs/guides/search.md": page("Search"),
  "pages/docs/reference/cli/init.md": page("init"),
  "pages/about.md": page("About"),
};

describe("sectionsOf", () => {
  const sections = sectionsOf(pagesOf(docs));
  const section = sections.get("docs");

  it("makes a section of each folder of pages, and nothing of pages outside folders", () => {
    expect([...sections.keys()]).toEqual(["docs"]);
  });

  it("orders by `order`, lower first, then by title, with a folder in its index's place", () => {
    expect(section === undefined ? [] : outline(section)).toEqual([
      "Start",
      { Guides: ["Search", "Write"] },
      "FAQ",
      { Reference: [{ Cli: ["init"] }] },
    ]);
  });

  it("names a folder after its index page, or else its name with a capital letter", () => {
    expect(section?.title).toBe("Docs");
    expect(section?.page?.file).toBe("pages/docs/index.md");
  });
});

describe("readingOrder", () => {
  it("goes through each folder's own page and then what is in it", () => {
    const section = sectionsOf(pagesOf(docs)).get("docs");
    expect(
      section === undefined ? [] : readingOrder(section).map((entry) => entry.fields.title),
    ).toEqual(["Docs", "Start", "Guides", "Search", "Write", "FAQ", "init"]);
  });
});

describe("foldersAbove", () => {
  const pages = pagesOf(docs);
  const section = sectionsOf(pages).get("docs");
  const above = (file: string) => {
    const entry = pages.find((candidate) => candidate.file === file);
    return section === undefined || entry === undefined
      ? []
      : foldersAbove(section, entry).map((folder) => folder.title);
  };

  it.each([
    ["pages/docs/guides/search.md", ["Docs", "Guides"]],
    ["pages/docs/guides/index.md", ["Docs"]],
    ["pages/docs/start.md", ["Docs"]],
    ["pages/docs/index.md", []],
    ["pages/docs/reference/cli/init.md", ["Docs", "Reference", "Cli"]],
  ])("gives the folders above %s", (file, titles) => {
    expect(above(file)).toEqual(titles);
  });
});
