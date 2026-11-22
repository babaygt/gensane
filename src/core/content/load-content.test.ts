import { describe, expect, it } from "vitest";
import { markdownToHtml } from "../../markdown/index.ts";
import { CoreCodes, loadContent } from "../index.ts";
import { codes, entryOf, loaded, minimal, problems } from "../test-helpers.ts";

const post = (body = "", extra = "") => `---\ntitle: Hello\ndate: 2026-11-17\n${extra}---\n${body}`;

function words(count: number): string {
  return Array.from({ length: count }, () => "word").join(" ");
}

describe("types of content", () => {
  it.each([
    ["blog/hello.md", minimal.post, "post", "/blog/hello/"],
    ["projects/gensane.md", minimal.project, "project", "/projects/gensane/"],
    ["pages/now.md", minimal.page, "page", "/now/"],
    ["index.md", minimal.page, "page", "/"],
    ["talks/jsconf.md", minimal.talk, "talk", undefined],
    ["experience/acme.md", minimal.experience, "experience", undefined],
    ["education/code.md", minimal.education, "education", undefined],
  ])("reads %s as a %s at %s", (path, source, type, url) => {
    expect(entryOf({ [path]: source }, path)).toMatchObject({ type, url });
  });

  it("reads files in folders inside a collection", () => {
    expect(entryOf({ "blog/2026/hello.md": minimal.post }, "blog/2026/hello.md").url).toBe(
      "/blog/hello/",
    );
  });

  it.each([
    ["pages/docs/start.md", "/docs/start/", "start"],
    ["pages/docs/guides/search.md", "/docs/guides/search/", "search"],
    ["pages/docs/index.md", "/docs/", "docs"],
    ["pages/docs/guides/index.md", "/docs/guides/", "guides"],
    ["pages/index.md", "/index/", "index"],
  ])("puts the page %s, in folders of pages, at %s", (path, url, slug) => {
    expect(entryOf({ [path]: minimal.page }, path)).toMatchObject({ url, slug });
  });

  it("lets a slug name a page in folders, but not move it out of them", () => {
    const path = "pages/docs/start.md";
    expect(entryOf({ [path]: "---\ntitle: Start\nslug: begin\n---\n" }, path).url).toBe(
      "/docs/begin/",
    );
  });

  it.each([
    ["pages/User_Guide/start.md", "User_Guide", 'rename the folder "user-guide"'],
    ["pages/docs/Über/start.md", "Über", 'rename the folder "uber"'],
    [
      "pages/docs/!!!/start.md",
      "!!!",
      'rename the folder with lowercase letters, digits and dashes, such as "guides"',
    ],
  ])("refuses the folder name in %s, which can't be part of a URL", (path, folder, hint) => {
    expect(problems({ [path]: minimal.page })).toMatchObject([
      {
        code: CoreCodes.invalidFolder,
        message: `the folder "${folder}" can't be part of a URL, which only allows lowercase letters, digits and single dashes`,
        hint,
        span: { file: `content/${path}`, start: { line: 1, column: 1 } },
      },
    ]);
  });

  it("takes an order for a page", () => {
    const path = "pages/docs/start.md";
    expect(entryOf({ [path]: "---\ntitle: Start\norder: 2\n---\n" }, path).fields).toMatchObject({
      order: 2,
    });
  });

  it.each(["notes/a.md", "about.md", "drafts/blog/a.md"])("rejects %s", (path) => {
    expect(problems({ [path]: minimal.page })).toMatchObject([
      {
        code: CoreCodes.unknownFolder,
        message: `there is no type of content for "${path}"`,
        hint: "put it in one of the folders: blog, projects, talks, experience, education or pages",
        span: { file: `content/${path}`, start: { line: 1, column: 1 } },
      },
    ]);
  });

  it("ignores a file that isn't Markdown, with a warning", () => {
    const result = problems({ "blog/cover.png": "", "blog/hello.md": minimal.post });
    expect(result).toMatchObject([
      {
        code: CoreCodes.notMarkdown,
        severity: "warning",
        message: "this file isn't Markdown, so it isn't part of the site",
        hint: "put images and other files in the `public` folder",
      },
    ]);
    expect(loaded({ "blog/cover.png": "", "blog/hello.md": minimal.post })).toHaveLength(1);
  });

  it("returns the entries in the order of their paths", () => {
    const files = {
      "pages/b.md": minimal.page,
      "blog/a.md": minimal.post,
      "index.md": minimal.page,
    };
    expect(loaded(files).map((entry) => entry.file)).toEqual([
      "blog/a.md",
      "index.md",
      "pages/b.md",
    ]);
  });
});

describe("URLs", () => {
  it("leaves a date at the start of the file name out of the URL", () => {
    expect(
      entryOf({ "blog/2026-11-17-hello.md": minimal.post }, "blog/2026-11-17-hello.md").url,
    ).toBe("/blog/hello/");
  });

  it.each([
    ["Hello World!.md", "hello-world"],
    ["Über Café.md", "uber-cafe"],
    ["--why  TypeScript--.md", "why-typescript"],
    ["C# tips.md", "c-tips"],
    ["2026-11-17-Hello.md", "hello"],
    ["v2.0-release.md", "v2-0-release"],
  ])("makes a URL from the file name %s", (name, slug) => {
    expect(entryOf({ [`blog/${name}`]: minimal.post }, `blog/${name}`).slug).toBe(slug);
  });

  it("uses the slug field instead of the file name", () => {
    const entry = entryOf(
      { "blog/2026-11-17-a.md": post("", "slug: my-post\n") },
      "blog/2026-11-17-a.md",
    );
    expect(entry).toMatchObject({ slug: "my-post", url: "/blog/my-post/" });
  });

  it.each([
    ["My Post", 'write it as "my-post"'],
    ["über-uns", 'write it as "uber-uns"'],
    ["-hello", 'write it as "hello"'],
    ["a--b", 'write it as "a-b"'],
    ["???", 'use lowercase letters, digits and dashes, such as "my-post"'],
  ])("rejects the slug %j and says how to write it", (slug, hint) => {
    expect(problems({ "blog/a.md": post("", `slug: "${slug}"\n`) })).toMatchObject([
      {
        code: CoreCodes.invalidSlug,
        message: `"${slug}" can't be used in a URL, which only allows lowercase letters, digits and single dashes`,
        hint,
        span: { file: "content/blog/a.md", start: { line: 4, column: 7 } },
      },
    ]);
  });

  it.each(["blog/日本.md", "blog/2026-11-17.md", "blog/!!!.md"])(
    "explains a file name that gives no URL: %s",
    (path) => {
      expect(problems({ [path]: minimal.post })).toMatchObject([
        {
          code: CoreCodes.noSlug,
          message: `the file name "${path.split("/").at(-1)}" has nothing to use in a URL`,
          hint: "add a `slug:` field, such as `slug: my-post`",
        },
      ]);
    },
  );

  it("needs no URL for talks, experience and education", () => {
    expect(codes({ "talks/日本.md": minimal.talk })).toEqual([]);
  });

  it("accepts a file name without letters when it has a slug field", () => {
    expect(entryOf({ "blog/日本.md": post("", "slug: japan\n") }, "blog/日本.md").url).toBe(
      "/blog/japan/",
    );
  });

  it("rejects two files with the same URL, at the second one", () => {
    const files = { "blog/hello.md": minimal.post, "blog/2026-11-17-hello.md": minimal.post };
    expect(problems(files)).toMatchObject([
      {
        code: CoreCodes.duplicateUrl,
        message: '/blog/hello/ is already the URL of "content/blog/2026-11-17-hello.md"',
        hint: "rename one of the files, or give one of them a `slug:`",
        span: { file: "content/blog/hello.md", start: { line: 1, column: 1 } },
      },
    ]);
  });

  it("points at the slug field when it caused the clash", () => {
    const files = { "pages/a.md": minimal.page, "pages/b.md": "---\ntitle: B\nslug: a\n---\n" };
    expect(problems(files)).toMatchObject([
      {
        code: CoreCodes.duplicateUrl,
        span: { file: "content/pages/b.md", start: { line: 3, column: 7 } },
      },
    ]);
  });

  it("allows the same slug in different collections", () => {
    const files = { "blog/gensane.md": minimal.post, "projects/gensane.md": minimal.project };
    expect(codes(files)).toEqual([]);
  });

  it("doesn't warn about a date with a time on the same day", () => {
    const source = "---\ntitle: Hello\ndate: 2026-11-17T09:30\n---\n";
    expect(codes({ "blog/2026-11-17-hello.md": source })).toEqual([]);
  });

  it("warns when the date in the file name isn't the date of the post", () => {
    expect(problems({ "blog/2026-11-16-hello.md": minimal.post })).toMatchObject([
      {
        code: CoreCodes.dateMismatch,
        severity: "warning",
        message: 'the file name says 2026-11-16, but "date" is 2026-11-17',
        hint: "rename the file, or change the date",
        span: { start: { line: 3, column: 7 } },
      },
    ]);
  });
});

describe("fields and body", () => {
  it("gives the validated fields, and keeps custom fields apart", () => {
    const entry = entryOf({ "blog/a.md": post("", "tags: [a, b]\nmood: happy\n") }, "blog/a.md");
    expect(entry).toMatchObject({
      fields: {
        title: "Hello",
        tags: ["a", "b"],
        draft: false,
        date: { year: 2026, month: 11, day: 17 },
      },
      extra: { mood: "happy" },
    });
  });

  it("keeps drafts, so a later step can decide whether to show them", () => {
    expect(entryOf({ "blog/a.md": post("", "draft: true\n") }, "blog/a.md").fields).toMatchObject({
      draft: true,
    });
  });

  it("turns the body into HTML and a table of contents", () => {
    const body = "## First\n\nText\n\n## Second\n";
    const entry = entryOf({ "blog/a.md": post(body) }, "blog/a.md");
    expect(entry.html).toBe(markdownToHtml(body, "x.md").html);
    expect(entry.tableOfContents.map((heading) => heading.id)).toEqual(["first", "second"]);
  });

  it("passes options to the Markdown compiler", () => {
    const entries = loaded(
      { "blog/a.md": post("<b>hi</b>\n") },
      { markdown: { rawHtml: "escape" } },
    );
    expect(entries[0]?.html).toContain("&lt;b&gt;");
  });

  it("reports frontmatter problems with the path inside the content folder", () => {
    expect(problems({ "blog/a.md": "---\ntitle: [oops\n---\n" })).toMatchObject([
      { span: { file: "content/blog/a.md", start: { line: 2 } } },
    ]);
  });

  it("reports missing fields", () => {
    expect(
      problems({ "talks/a.md": "---\ntitle: A talk\n---\n" }).map((problem) => problem.message),
    ).toEqual(['the required field "event" is missing', 'the required field "date" is missing']);
  });

  it("points Markdown warnings at the right line of the file", () => {
    const result = problems({ "blog/a.md": post("Text\n\nMore[^missing]\n") });
    expect(result).toMatchObject([
      {
        severity: "warning",
        span: { file: "content/blog/a.md", start: { line: 7, column: 5, offset: 48 } },
      },
    ]);
  });

  it("reports the problems of every file, sorted by file", () => {
    const files = { "talks/b.md": "---\ntitle: x\n---\n", "blog/a.md": "---\n---\n" };
    expect(problems(files).map((problem) => problem.span.file)).toEqual([
      "content/blog/a.md",
      "content/blog/a.md",
      "content/talks/b.md",
      "content/talks/b.md",
    ]);
  });

  it("fails when there is an error, and keeps the warnings with the errors", () => {
    const files = { "blog/a.md": "---\n---\n", "pages/z.md": `${minimal.page}Text[^x]\n` };
    const result = loadContent(files);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.error.map((problem) => problem.severity)).toEqual([
      "error",
      "error",
      "warning",
    ]);
  });

  it("passes on the warnings about frontmatter", () => {
    expect(codes({ "pages/a.md": "---\ntitle: A\ndescripton: typo\n---\n" })).toEqual(["GS224"]);
  });

  it("sorts a clash of URLs in with the other problems", () => {
    const files = {
      "blog/a.md": minimal.post,
      "blog/b.md": post("", "slug: a\n"),
      "pages/cover.png": "",
    };
    expect(problems(files).map((found) => [found.span.file, found.code])).toEqual([
      ["content/blog/b.md", CoreCodes.duplicateUrl],
      ["content/pages/cover.png", CoreCodes.notMarkdown],
    ]);
  });

  it("names the content folder in problems", () => {
    const result = loadContentProblems({ "notes/a.md": "" }, "site/content");
    expect(result[0]?.span.file).toBe("site/content/notes/a.md");
  });
});

describe("excerpt", () => {
  it("is everything before the more marker", () => {
    const entry = entryOf(
      { "blog/a.md": post("One\n\nTwo\n\n<!-- more -->\n\nThree\n") },
      "blog/a.md",
    );
    expect(entry.excerpt).toBe(markdownToHtml("One\n\nTwo\n", "x.md").html);
  });

  it("is the first paragraph without a marker", () => {
    const entry = entryOf({ "blog/a.md": post("# Title\n\nFirst *one*\n\nSecond\n") }, "blog/a.md");
    expect(entry.excerpt).toBe(markdownToHtml("First *one*\n", "x.md").html);
  });

  it("is empty without a paragraph", () => {
    expect(entryOf({ "blog/a.md": post("# Only a heading\n") }, "blog/a.md").excerpt).toBe("");
  });

  it("finds a marker with spaces around it", () => {
    const body = "One\n\nTwo\n\n  <!-- more -->  \n\nThree\n";
    const entry = entryOf({ "blog/a.md": post(body) }, "blog/a.md");
    expect(entry.excerpt).toBe(markdownToHtml("One\n\nTwo\n", "x.md").html);
  });

  it("doesn't take other HTML for the marker", () => {
    const entry = entryOf({ "blog/a.md": post("One\n\nTwo\n\n<div>x</div>\n") }, "blog/a.md");
    expect(entry.excerpt).toBe(markdownToHtml("One\n", "x.md").html);
  });

  it("ignores a marker inside other content", () => {
    const entry = entryOf({ "blog/a.md": post("One\n\n> <!-- more -->\n") }, "blog/a.md");
    expect(entry.excerpt).toBe(markdownToHtml("One\n", "x.md").html);
  });
});

describe("reading time", () => {
  it.each([
    [0, 1],
    [1, 1],
    [200, 1],
    [201, 2],
    [400, 2],
    [401, 3],
  ])("is %i words → %i minutes", (count, minutes) => {
    expect(entryOf({ "blog/a.md": post(words(count)) }, "blog/a.md").readingTime).toBe(minutes);
  });

  it("counts the words of the text, not the HTML around them", () => {
    const body = `${words(199)} [link](https://example.com "a long title here")\n`;
    expect(entryOf({ "blog/a.md": post(body) }, "blog/a.md").readingTime).toBe(1);
  });

  it("doesn't split a word with emphasis inside it", () => {
    const body = `${words(199)} one*two*\n`;
    expect(entryOf({ "blog/a.md": post(body) }, "blog/a.md").readingTime).toBe(1);
  });

  it("counts the words of separate blocks and table cells apart", () => {
    const body = `${words(199)}\n\n| a | b |\n| - | - |\n`;
    expect(entryOf({ "blog/a.md": post(body) }, "blog/a.md").readingTime).toBe(2);
  });
});

function loadContentProblems(files: Readonly<Record<string, string>>, contentFolder: string) {
  const result = loadContent(files, { contentFolder });
  return result.ok ? result.value.warnings : result.error;
}

/** A talk, which has no slug of its own, with one more field. */
const talk = (field: string) =>
  `---\ntitle: A talk\nevent: A meetup\ndate: 2026-10-01\n${field}: something\n---\n`;

describe("fields named like what the build gives templates", () => {
  it.each([
    ["url", "the address of the page"],
    ["slug", "the slug of the page"],
    ["type", "the type of content"],
    ["html", "the HTML of the body"],
    ["excerpt", "the excerpt"],
    ["toc", "the table of contents"],
    ["readingTime", "the reading time"],
  ])("warns about %s, which templates see as %s, at the field's name", (field, meaning) => {
    expect(problems({ "talks/a.md": talk(field) })).toMatchObject([
      {
        code: CoreCodes.hiddenField,
        severity: "warning",
        message: `templates see "${field}" as ${meaning}, not as this field`,
        hint: "give the field another name",
        span: { file: "content/talks/a.md", start: { line: 5, column: 1 } },
      },
    ]);
  });

  it("doesn't warn about a field the type of content has, such as the slug of a post", () => {
    expect(codes({ "blog/a.md": post("", "slug: hello\n") })).toEqual([]);
  });

  it("doesn't warn about other fields of one's own", () => {
    expect(codes({ "talks/a.md": talk("mood") })).toEqual([]);
  });
});
