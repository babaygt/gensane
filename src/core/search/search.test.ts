import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { search, wordsOf as scriptWordsOf } from "../../../themes/default/assets/search.js";
import { minimal } from "../test-helpers.ts";
import { buildSite } from "../index.ts";
import { loadContent } from "../content/load-content.ts";
import { searchDocuments, searchIndex } from "./search-index.ts";
import { textOf, wordsOf } from "./words.ts";

describe("wordsOf", () => {
  it.each([
    ["Hello, World!", ["hello", "world"]],
    ["Über Straße café", ["uber", "straße", "cafe"]],
    ["a to b", ["to"]],
    ["TypeScript typescript TYPESCRIPT", ["typescript"]],
    ["web-site 2026 x1", ["web", "site", "2026", "x1"]],
    ["日本語 тест", ["日本語", "тест"]],
    ["", []],
  ])("cuts %j into %j", (text, words) => {
    expect(wordsOf(text)).toEqual(words);
  });

  it("cuts any text exactly as the search script does, so a word in the index can always be found", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), (text) => {
        expect(scriptWordsOf(text)).toEqual(wordsOf(text));
      }),
    );
  });

  it("gives words that cut again into themselves", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), (text) => {
        for (const word of wordsOf(text)) expect(wordsOf(word)).toEqual([word]);
      }),
    );
  });
});

describe("textOf", () => {
  it("leaves out tags and character references, and keeps the words around them", () => {
    expect(textOf("<p>Tom &amp; <em>Jerry</em>&#39;s show</p>")).toBe("Tom   Jerry s show");
  });
});

const post = (title: string, date: string, extra = "", body = "") =>
  `---\ntitle: ${title}\ndate: ${date}\n${extra}---\n${body}`;

function documentsOf(files: Record<string, string>) {
  const loaded = loadContent(files);
  if (!loaded.ok) throw new Error(loaded.error[0]?.message);
  return searchDocuments(loaded.value.entries);
}

describe("searchDocuments", () => {
  it("holds what a post has to be found by", () => {
    const files = {
      "blog/hello.md": post(
        "Hello",
        "2026-11-17",
        "description: First\ntags: [Testing]\n",
        "Some *words* here.\n",
      ),
    };
    expect(documentsOf(files)).toEqual([
      {
        title: "Hello",
        url: "/blog/hello/",
        description: "First",
        tags: ["Testing"],
        date: "2026-11-17",
        words: ["some", "words", "here"],
      },
    ]);
  });

  it("uses a project's stack as its tags, and has no date for it", () => {
    const files = { "projects/gensane.md": "---\ntitle: Gensane\nstack: [TypeScript]\n---\n" };
    expect(documentsOf(files)).toEqual([
      { title: "Gensane", url: "/projects/gensane/", tags: ["TypeScript"], words: [] },
    ]);
  });

  it("leads a talk to the list of talks, and finds it by its event and place", () => {
    const files = {
      "talks/a.md":
        "---\ntitle: Compilers\nevent: JSConf\nlocation: Berlin\ndate: 2026-10-01\n---\nOn parsers.\n",
    };
    expect(documentsOf(files)).toEqual([
      {
        title: "Compilers",
        url: "/talks/",
        tags: [],
        date: "2026-10-01",
        words: ["jsconf", "berlin", "on", "parsers"],
      },
    ]);
  });

  it("holds pages, and leaves out experience and education, which have no page to find", () => {
    const files = {
      "pages/now.md": minimal.page,
      "experience/a.md": minimal.experience,
      "education/a.md": minimal.education,
    };
    expect(documentsOf(files).map(({ url }) => url)).toEqual(["/now/"]);
  });

  it("never holds a draft", () => {
    const files = {
      "blog/soon.md": post("Soon", "2026-11-18", "draft: true\n"),
      "projects/a.md": "---\ntitle: A\ndraft: true\n---\n",
    };
    expect(documentsOf(files)).toEqual([]);
  });
});

describe("the index in the site", () => {
  it("is written with the search page, even when drafts are shown, without the drafts", () => {
    const content = {
      "blog/a.md": post("A", "2026-11-17"),
      "blog/soon.md": post("Soon", "2026-11-18", "draft: true\n"),
    };
    const templates = {
      "search.html": "x",
      "post.html": "x",
      "blog.html": "x",
      "home.html": "x",
      "404.html": "x",
    };
    const built = buildSite({ content, templates, config: { drafts: true } });
    const files = built.ok ? built.value.files : [];
    const index = files.find(({ path }) => path === "search-index.json")?.content ?? "";
    expect(JSON.parse(index).documents.map(({ title }: { title: string }) => title)).toEqual(["A"]);
  });

  it("is JSON with the documents", () => {
    const loaded = loadContent({ "pages/now.md": minimal.page });
    const entries = loaded.ok ? loaded.value.entries : [];
    expect(JSON.parse(searchIndex(entries))).toEqual({ documents: searchDocuments(entries) });
  });
});

describe("search", () => {
  const documents = [
    { title: "Testing compilers", url: "/a/", tags: [], words: ["parsers"], date: "2026-01-01" },
    { title: "Hello", url: "/b/", tags: ["testing"], words: [], date: "2026-02-01" },
    { title: "Notes", url: "/c/", tags: [], description: "On testing", words: [] },
    { title: "Other", url: "/d/", tags: [], words: ["testing", "parsers"], date: "2026-03-01" },
    { title: "Older", url: "/e/", tags: [], words: ["testing"], date: "2025-01-01" },
  ];
  const titles = (query: string) =>
    search(documents, query).map(({ title }: { title: string }) => title);

  it("ranks a match in the title first, then tags, then the description, then the text, and the newest first among equals", () => {
    expect(titles("testing")).toEqual(["Testing compilers", "Hello", "Notes", "Other", "Older"]);
  });

  it("needs every word", () => {
    expect(titles("testing parsers")).toEqual(["Testing compilers", "Other"]);
  });

  it("finds the last word while it is still being typed, but only the last one", () => {
    expect(titles("pars")).toEqual(["Other", "Testing compilers"]);
    expect(titles("test parsers")).toEqual([]);
  });

  it("finds words without their accents and in any case", () => {
    expect(search([{ title: "Über uns", url: "/", tags: [], words: [] }], "UBER").length).toBe(1);
  });

  it("finds nothing for nothing, or for words too short to be words", () => {
    expect(titles("")).toEqual([]);
    expect(titles("a")).toEqual([]);
  });

  it("finds any document by any word of its title", () => {
    const document = fc.record({
      title: fc.string({ minLength: 1 }),
      url: fc.constant("/"),
      tags: fc.array(fc.string()),
      words: fc.constant<string[]>([]),
    });
    fc.assert(
      fc.property(document, (one) => {
        for (const word of wordsOf(one.title)) expect(search([one], word)).toEqual([one]);
      }),
    );
  });
});
