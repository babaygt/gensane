import { describe, expect, it } from "vitest";
import { CoreCodes, type SiteInput, buildSite } from "../index.ts";
import { minimal, plainTheme } from "../test-helpers.ts";

const site = { url: "https://example.com" };

/** Posts show their body, so that links to its headings can be checked. */
const theme = { ...plainTheme, "post.html": "<h1>{{ page.title }}</h1>{{ page.html }}" };

function problemsOf(input: Partial<SiteInput>) {
  const result = buildSite({
    content: {},
    templates: theme,
    ...input,
    config: { site, ...input.config },
  });
  return result.ok ? result.value.warnings : result.error;
}

function codesOf(input: Partial<SiteInput>): string[] {
  return problemsOf(input).map((problem) => problem.code);
}

function post(body: string, extra = ""): string {
  return `---\ntitle: A post\ndate: 2026-01-01\n${extra}---\n${body}`;
}

const other = { "blog/other.md": minimal.post, "pages/about.md": minimal.page };

describe("links in content", () => {
  it.each([
    "[home](/)",
    "[a post](/blog/other/)",
    "[a post](/blog/other)",
    "[about](/about/)",
    "[a list](/blog/)",
    "[the feed](/feed.xml)",
    "[a sitemap](/sitemap.xml)",
    "[with a query](/blog/other/?ref=home)",
    "[a sibling](../other/)",
    "[itself](./)",
  ])("accepts %s", (link) => {
    expect(codesOf({ content: { ...other, "blog/a.md": post(`${link}\n`) } })).toEqual([]);
  });

  it.each([
    "[web](https://example.org/missing)",
    "[web](http://example.org/)",
    "[same scheme](//example.org/x)",
    "[mail](mailto:ada@example.com)",
    "[phone](tel:+49123)",
  ])("leaves %s alone", (link) => {
    expect(codesOf({ content: { "blog/a.md": post(`${link}\n`) } })).toEqual([]);
  });

  it("reports a link to a page that doesn't exist, at the link", () => {
    const content = { ...other, "blog/a.md": post("Intro\n\nSee [this](/blog/othr/).\n") };
    expect(problemsOf({ content })).toMatchObject([
      {
        code: CoreCodes.brokenLink,
        severity: "error",
        message: '"/blog/othr/" doesn\'t lead to a page or a file of the site',
        hint: 'did you mean "/blog/other/"?',
        span: { file: "content/blog/a.md", start: { line: 7, column: 12 } },
      },
    ]);
  });

  it("resolves a relative link from the page it is on", () => {
    const content = { ...other, "blog/a.md": post("[wrong](other/)\n") };
    expect(problemsOf({ content })[0]?.message).toBe(
      '"/blog/a/other/" doesn\'t lead to a page or a file of the site',
    );
  });

  it("explains a link to a draft", () => {
    const content = {
      "blog/a.md": post("[soon](/blog/soon/)\n"),
      "blog/soon.md": post("", "draft: true\n"),
    };
    expect(problemsOf({ content })).toMatchObject([
      {
        code: CoreCodes.brokenLink,
        hint: '"/blog/soon/" is a draft, so it isn\'t published',
      },
    ]);
  });

  it("accepts a link to a draft when drafts are shown", () => {
    const content = {
      "blog/a.md": post("[soon](/blog/soon/)\n"),
      "blog/soon.md": post("", "draft: true\n"),
    };
    expect(codesOf({ content, config: { drafts: true } })).toEqual([]);
  });

  it("gives a general hint when nothing is close", () => {
    const content = { "blog/a.md": post("[x](/completely/different/)\n") };
    expect(problemsOf({ content })[0]?.hint).toBe(
      "check the address, or put the file in the `public` folder",
    );
  });

  it("leaves a relative link alone where there is no page to start from", () => {
    const content = { "talks/a.md": `${minimal.talk}[notes](notes.pdf)\n` };
    expect(codesOf({ content })).toEqual([]);
  });

  it("checks the links of a draft when drafts are shown", () => {
    const content = { "blog/a.md": post("[x](/nowhere/)\n", "draft: true\n") };
    expect(codesOf({ content, config: { drafts: true } })).toEqual([CoreCodes.brokenLink]);
  });

  it("names the content folder of the config", () => {
    const content = { "blog/a.md": post("[x](/nowhere/)\n") };
    const [found] = problemsOf({ content, config: { contentFolder: "site/content" } });
    expect(found?.span.file).toBe("site/content/blog/a.md");
  });

  it("points at the start of the file when the link is written differently", () => {
    const content = { "blog/a.md": post("[x](/nowhere&amp;x/)\n") };
    expect(problemsOf({ content })).toMatchObject([
      { span: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } },
    ]);
  });

  it("doesn't check links once building has found an error", () => {
    const content = { "blog/a.md": post("[x](/nowhere/)\n") };
    const templates = { ...theme, "404.html": "{{ 1 / 0 }}" };
    expect(codesOf({ content, templates })).toEqual(["GS333"]);
  });

  it("checks links in HTML written in the Markdown", () => {
    const content = { "blog/a.md": post('<a href="/nowhere/">x</a>\n') };
    expect(codesOf({ content })).toEqual([CoreCodes.brokenLink]);
  });

  it("checks the links of talks, experience and education, which have no page of their own", () => {
    const content = { "talks/a.md": `${minimal.talk}[slides](/slides.pdf)\n` };
    expect(codesOf({ content })).toEqual([CoreCodes.brokenLink]);
  });

  it("doesn't check the links of drafts that aren't published", () => {
    const content = { "blog/a.md": post("[x](/nowhere/)\n", "draft: true\n") };
    expect(codesOf({ content })).toEqual([]);
  });

  it("reports each broken link once", () => {
    const content = { "blog/a.md": post("[x](/nowhere/) and [again](/nowhere/)\n") };
    expect(codesOf({ content })).toEqual([CoreCodes.brokenLink]);
  });
});

describe("images and files", () => {
  it("accepts an image in the public folder", () => {
    const content = { "blog/a.md": post("![me](/images/me.png)\n") };
    expect(codesOf({ content, publicFiles: ["images/me.png"] })).toEqual([]);
  });

  it("reports an image that is missing, and suggests a close one", () => {
    const content = { "blog/a.md": post("![me](/images/me.jpg)\n") };
    expect(problemsOf({ content, publicFiles: ["images/me.jpeg"] })).toMatchObject([
      {
        code: CoreCodes.brokenLink,
        message: '"/images/me.jpg" doesn\'t lead to a page or a file of the site',
        hint: 'did you mean "/images/me.jpeg"?',
      },
    ]);
  });

  it("reads an ampersand in an address", () => {
    const content = { "blog/a.md": post("![logo](/files/a&b.png)\n") };
    expect(codesOf({ content, publicFiles: ["files/a&b.png"] })).toEqual([]);
  });

  it("reads spaces and other characters written as %20", () => {
    const content = { "blog/a.md": post("![me](/images/my%20photo.png)\n") };
    expect(codesOf({ content, publicFiles: ["images/my photo.png"] })).toEqual([]);
  });

  it("checks the cover of a post", () => {
    const content = { "blog/a.md": post("", "cover: /images/cover.png\n") };
    expect(problemsOf({ content })).toMatchObject([
      {
        code: CoreCodes.brokenLink,
        span: { file: "content/blog/a.md", start: { line: 4, column: 8 } },
      },
    ]);
    expect(codesOf({ content, publicFiles: ["images/cover.png"] })).toEqual([]);
  });

  it("leaves a cover on another site alone", () => {
    const content = { "blog/a.md": post("", "cover: https://example.org/cover.png\n") };
    expect(codesOf({ content })).toEqual([]);
  });

  it.each([
    ["feed.xml", "the feed"],
    ["sitemap.xml", "the sitemap"],
    ["index.html", "the page /"],
    ["blog/index.html", "the page /blog/"],
  ])("rejects public/%s, which would replace %s", (path, what) => {
    const content = { "blog/a.md": minimal.post };
    expect(problemsOf({ content, publicFiles: [path] })).toMatchObject([
      {
        code: CoreCodes.publicFileClash,
        message: `"public/${path}" would replace ${what}, which the site writes`,
        hint: "rename the file, or move it into a folder",
        span: { file: `public/${path}`, start: { line: 1, column: 1 } },
      },
    ]);
  });
});

describe("the theme's assets", () => {
  it("accepts links to them, in templates and in content", () => {
    const content = { "blog/a.md": post("![logo](/assets/logo.svg)\n") };
    const templates = { ...theme, "post.html": '<link href="/assets/style.css">{{ page.html }}' };
    const themeAssets = ["assets/style.css", "assets/logo.svg"];
    expect(codesOf({ content, templates, themeAssets })).toEqual([]);
  });

  it("rejects a public file at the same path as one of them", () => {
    const content = { "blog/a.md": minimal.post };
    const input = { content, publicFiles: ["assets/style.css"], themeAssets: ["assets/style.css"] };
    expect(problemsOf(input)).toMatchObject([
      {
        code: CoreCodes.themeFileClash,
        message: '"public/assets/style.css" would replace "assets/style.css" of the theme',
        hint: "rename the file, or move it out of the theme's assets folder",
        span: { file: "public/assets/style.css", start: { line: 1, column: 1 } },
      },
    ]);
  });

  it("rejects one that would replace a page", () => {
    const content = { "pages/assets.md": minimal.page };
    expect(problemsOf({ content, themeAssets: ["assets/index.html"] })).toMatchObject([
      {
        code: CoreCodes.themeFileClash,
        message: '"theme/assets/index.html" would replace the page /assets/, which the site writes',
        hint: "rename the file of the theme",
        span: { file: "theme/assets/index.html" },
      },
    ]);
  });
});

describe("links to a part of a page", () => {
  it("accepts a link to a heading on the same page", () => {
    const content = { "blog/a.md": post("[down](#why)\n\n## Why\n") };
    expect(codesOf({ content })).toEqual([]);
  });

  it("accepts a link to a heading on another page, and to an id from a template", () => {
    const content = {
      "blog/a.md": post("## Why\n"),
      "blog/b.md": post("[there](/blog/a/#why) [top](/blog/a/#top)\n"),
    };
    const templates = { ...theme, "post.html": '<a id="top"></a>{{ page.html }}' };
    expect(codesOf({ content, templates })).toEqual([]);
  });

  it("warns about a missing part, and suggests a close one", () => {
    const content = { "blog/a.md": post("[down](#whyy)\n\n## Why\n") };
    expect(problemsOf({ content })).toMatchObject([
      {
        code: CoreCodes.missingAnchor,
        severity: "warning",
        message: '"#whyy" leads to /blog/a/, which has no element with the id "whyy"',
        hint: 'did you mean "#why"?',
      },
    ]);
  });

  it("reads an ampersand in an id", () => {
    const content = { "blog/a.md": post('[x](#a&b)\n\n<span id="a&amp;b"></span>\n') };
    expect(codesOf({ content })).toEqual([]);
  });

  it("explains a missing part when nothing is close", () => {
    const content = { "blog/a.md": post("[down](#zzzzzz)\n") };
    expect(problemsOf({ content })[0]?.hint).toBe(
      "check the id of the heading or element it should lead to",
    );
  });

  it("doesn't look inside files from the public folder", () => {
    const content = { "blog/a.md": post("[x](/old/page.html#part)\n") };
    expect(codesOf({ content, publicFiles: ["old/page.html"] })).toEqual([]);
  });
});

describe("links in templates", () => {
  it("reports a written link that leads nowhere, at its place in the template", () => {
    const templates = { ...theme, "404.html": '<p>Sorry.</p>\n<a href="/abuot/">About</a>' };
    expect(problemsOf({ templates, content: { "pages/about.md": minimal.page } })).toMatchObject([
      {
        code: CoreCodes.brokenLink,
        hint: 'did you mean "/about/"?',
        span: { file: "404.html", start: { line: 2, column: 10 } },
      },
    ]);
  });

  it("reads an ampersand written in a template", () => {
    const templates = { ...theme, "404.html": '<img src="/files/a&amp;b.png">' };
    expect(codesOf({ templates, publicFiles: ["files/a&b.png"] })).toEqual([]);
  });

  it("checks templates that no page uses, such as partials", () => {
    const templates = { ...theme, "nav.html": '<a href="/nowhere/">x</a>' };
    expect(codesOf({ templates })).toEqual([CoreCodes.brokenLink]);
  });

  it.each([
    '<a href="{{ page.url }}">x</a>',
    '<a href="/blog/{{ page.title }}/">x</a>',
    '<a href="/blog/{% if true %}x{% endif %}/">x</a>',
    '<a href="relative/">x</a>',
    '<img src="https://example.org/x.png">',
    '<a href="/">home</a>',
  ])("leaves %s to the pages it builds", (link) => {
    expect(codesOf({ templates: { ...theme, "404.html": link } })).toEqual([]);
  });
});
