import { describe, expect, it } from "vitest";
import { type BuiltSite, CoreCodes, type SiteConfig, type SiteInput, buildSite } from "../index.ts";
import { minimal, plainTheme } from "../test-helpers.ts";

function built(input: Partial<SiteInput>): BuiltSite {
  const result = buildSite({ content: {}, templates: plainTheme, ...input });
  if (!result.ok) throw new Error(result.error.map((problem) => problem.message).join("\n"));
  return result.value;
}

function fileOf(site: BuiltSite, path: string): string | undefined {
  return site.files.find((file) => file.path === path)?.content;
}

/** Renders one page with one template replaced. */
function render(
  path: string,
  templateName: string,
  template: string,
  content: Readonly<Record<string, string>>,
  config: SiteInput["config"] = {},
): string | undefined {
  const site = built({ content, templates: { ...plainTheme, [templateName]: template }, config });
  return fileOf(site, path);
}

/** The site has an address, so that no test here expects the warning about a missing one. */
function problemsOf(input: Partial<SiteInput>) {
  const config = { site: { url: "https://example.com" } };
  const result = buildSite({ content: {}, templates: plainTheme, config, ...input });
  return result.ok ? result.value.warnings : result.error;
}

const talk = (title: string, date: string) =>
  `---\ntitle: ${title}\nevent: A meetup\ndate: ${date}\n---\n`;

const post = (date: string, extra = "", body = "") =>
  `---\ntitle: Post ${date}\ndate: ${date}\n${extra}---\n${body}`;

describe("output files", () => {
  it("writes a file for every page and the theme settings, sorted by path", () => {
    const content = {
      "index.md": minimal.page,
      "blog/hello.md": post("2026-01-01", "tags: [testing]\n"),
      "projects/gensane.md": minimal.project,
      "talks/a.md": minimal.talk,
      "experience/a.md": minimal.experience,
      "pages/now.md": minimal.page,
    };
    expect(built({ content }).files.map((file) => file.path)).toEqual([
      "404.html",
      "about/index.html",
      "assets/settings.css",
      "blog/hello/index.html",
      "blog/index.html",
      "index.html",
      "now/index.html",
      "projects/gensane/index.html",
      "projects/index.html",
      "search-index.json",
      "search/index.html",
      "tags/index.html",
      "tags/testing/index.html",
      "talks/index.html",
    ]);
  });

  it("renders each page with its template", () => {
    const site = built({
      content: { "blog/hello.md": post("2026-01-01") },
      templates: { ...plainTheme, "post.html": "post: {{ page.title }}", "blog.html": "list" },
    });
    expect([fileOf(site, "blog/hello/index.html"), fileOf(site, "blog/index.html")]).toEqual([
      "post: Post 2026-01-01",
      "list",
    ]);
  });

  it("writes the pages of a list", () => {
    const content = Object.fromEntries(
      [1, 2, 3].map((day) => [`blog/p${day}.md`, post(`2026-01-0${day}`)]),
    );
    const site = built({ content, config: { perPage: 2 } });
    expect(site.files.map((file) => file.path)).toContain("blog/page/2/index.html");
  });

  it("gives the same files whatever order the files were read in", () => {
    const content = {
      "blog/a.md": post("2026-01-01", "tags: [x]\n"),
      "blog/b.md": post("2026-01-01", "tags: [x]\n"),
      "pages/c.md": minimal.page,
    };
    const reversed = Object.fromEntries(Object.entries(content).toReversed());
    const theme = {
      ...plainTheme,
      "blog.html": "{% for p in pagination.items %}{{ p.url }}{% endfor %}",
    };
    expect(built({ content: reversed, templates: theme })).toEqual(
      built({ content, templates: theme }),
    );
  });
});

describe("the page variable", () => {
  it("has the fields, the URL and the custom fields of the entry", () => {
    const html = render(
      "blog/hello/index.html",
      "post.html",
      "{{ page.title }}|{{ page.url }}|{{ page.slug }}|{{ page.mood }}|{{ page.tags | join }}",
      { "blog/hello.md": post("2026-01-01", "tags: [a, b]\nmood: happy\n") },
    );
    expect(html).toBe("Post 2026-01-01|/blog/hello/|hello|happy|a, b");
  });

  it("prints the HTML of the body without escaping it", () => {
    const html = render("blog/hello/index.html", "post.html", "{{ page.html }}", {
      "blog/hello.md": post("2026-01-01", "", "Hello *world*\n"),
    });
    expect(html).toBe("<p>Hello <em>world</em></p>\n");
  });

  it("has the excerpt, the reading time and the table of contents", () => {
    const html = render(
      "blog/hello/index.html",
      "post.html",
      "{{ page.excerpt }}|{{ page.readingTime }}|{% for item in page.toc %}{{ item.id }}:{{ item.text }} {% endfor %}",
      { "blog/hello.md": post("2026-01-01", "", "Intro\n\n## First part\n\n## Second\n") },
    );
    expect(html).toBe("<p>Intro</p>\n|1|first-part:First part second:Second ");
  });

  it.each([
    [
      "blog/a/index.html",
      "post.html",
      "blog/a.md",
      post("2026-01-01", "toc: false\n", "## A\n## B\n"),
    ],
    [
      "uses/index.html",
      "page.html",
      "pages/uses.md",
      "---\ntitle: Uses\ntoc: false\n---\n## A\n## B\n",
    ],
  ])(
    "gives %s no table of contents when its frontmatter says toc: false",
    (path, name, file, text) => {
      expect(render(path, name, "{{ page.toc | length }}", { [file]: text })).toBe("0");
      expect(problemsOf({ content: { [file]: text } })).toEqual([]);
    },
  );

  it("keeps the table of contents when the frontmatter says toc: true", () => {
    const content = { "pages/uses.md": "---\ntitle: Uses\ntoc: true\n---\n## A\n## B\n" };
    expect(render("uses/index.html", "page.html", "{{ page.toc | length }}", content)).toBe("2");
  });

  it.each([
    ["2026-11-25", "Later=true;Today=false;Earlier=false;"],
    [undefined, "Later=false;Today=false;Earlier=false;"],
  ])("marks the talks after the day of the build, %s, as upcoming", (today, shown) => {
    const content = {
      "talks/earlier.md": talk("Earlier", "2026-06-12"),
      "talks/today.md": talk("Today", "2026-11-25"),
      "talks/later.md": talk("Later", "2026-11-26"),
    };
    const template =
      "{% for talk in collections.talks %}{{ talk.title }}={{ talk.upcoming }};{% endfor %}";
    const config = today === undefined ? {} : { today };
    expect(render("talks/index.html", "talks.html", template, content, config)).toBe(shown);
  });

  it("is the same value as the post in a list, so a list can mark the current page", () => {
    const content = { "blog/a.md": post("2026-01-01"), "blog/b.md": post("2026-01-02") };
    const template =
      "{% for item in collections.posts %}{% if item == page %}[{{ item.slug }}]{% else %}{{ item.slug }}{% endif %}{% endfor %}";
    expect(render("blog/a/index.html", "post.html", template, content)).toBe("b[a]");
  });

  it("gives dates to the date filter", () => {
    const html = render(
      "blog/hello/index.html",
      "post.html",
      '{{ page.date | date("MMM d, yyyy") }}',
      {
        "blog/hello.md": post("2026-11-18"),
      },
    );
    expect(html).toBe("Nov 18, 2026");
  });

  it.each([
    ["blog/index.html", "blog.html", { "blog/a.md": post("2026-01-01") }, "Blog"],
    ["tags/index.html", "tags.html", { "blog/a.md": post("2026-01-01", "tags: [x]\n") }, "Tags"],
    ["tags/x/index.html", "tag.html", { "blog/a.md": post("2026-01-01", "tags: [x]\n") }, "x"],
    ["projects/index.html", "projects.html", { "projects/a.md": minimal.project }, "Projects"],
    ["talks/index.html", "talks.html", { "talks/a.md": minimal.talk }, "Talks"],
    ["about/index.html", "about.html", { "experience/a.md": minimal.experience }, "About"],
    ["404.html", "404.html", {}, "Page not found"],
    ["index.html", "home.html", {}, "Home"],
  ])("gives %s a title and a URL", (path, templateName, content, title) => {
    const html = render(path, templateName, "{{ page.title }}|{{ page.url }}", content);
    expect(html).toBe(`${title}|/${path.replace(/index\.html$/, "")}`);
  });

  it("uses the content of index.md for the home page, and of about.md for the about page", () => {
    const content = {
      "index.md": "---\ntitle: Welcome\n---\nHi\n",
      "pages/about.md": "---\ntitle: About me\n---\nMe\n",
    };
    const site = built({
      content,
      templates: {
        ...plainTheme,
        "home.html": "{{ page.title }}",
        "about.html": "{{ page.title }}",
      },
    });
    expect([fileOf(site, "index.html"), fileOf(site, "about/index.html")]).toEqual([
      "Welcome",
      "About me",
    ]);
  });
});

describe("the other variables", () => {
  it("gives every template the site settings", () => {
    const html = render("404.html", "404.html", "{{ site.title }}", {}, { site: { title: "Ada" } });
    expect(html).toBe("Ada");
  });

  it("gives every template every collection", () => {
    const content = {
      "blog/a.md": post("2026-01-01", "tags: [x]\n"),
      "projects/p.md": minimal.project,
      "talks/t.md": minimal.talk,
      "experience/e.md": minimal.experience,
      "education/d.md": minimal.education,
      "pages/z.md": minimal.page,
    };
    const names = ["posts", "projects", "talks", "experience", "education", "pages"];
    const template =
      names.map((name) => `{{ collections.${name} | length }}`).join("") +
      "|{{ collections.tags[0].name }}:{{ collections.tags[0].count }}";
    expect(render("404.html", "404.html", template, content)).toBe("111111|x:1");
  });

  it("gives list pages their pagination", () => {
    const content = Object.fromEntries(
      [1, 2, 3].map((day) => [`blog/p${day}.md`, post(`2026-01-0${day}`)]),
    );
    const template =
      "{% for item in pagination.items %}{{ item.url }} {% endfor %}{{ pagination.current }}/{{ pagination.total }} {{ pagination.previousUrl }} {{ pagination.nextUrl }}";
    const site = built({
      content,
      templates: { ...plainTheme, "blog.html": template },
      config: { perPage: 2 },
    });
    expect([fileOf(site, "blog/index.html"), fileOf(site, "blog/page/2/index.html")]).toEqual([
      "/blog/p3/ /blog/p2/ 1/2  /blog/page/2/",
      "/blog/p1/ 2/2 /blog/ ",
    ]);
  });

  it("gives posts the previous and next post, and nothing at the ends", () => {
    const content = { "blog/a.md": post("2026-01-01"), "blog/b.md": post("2026-01-02") };
    const template =
      "{% if previous %}{{ previous.url }}{% else %}none{% endif %} {% if next %}{{ next.url }}{% else %}none{% endif %}";
    const site = built({ content, templates: { ...plainTheme, "post.html": template } });
    expect([fileOf(site, "blog/a/index.html"), fileOf(site, "blog/b/index.html")]).toEqual([
      "none /blog/b/",
      "/blog/a/ none",
    ]);
  });

  it("gives tag pages their tag", () => {
    const html = render(
      "tags/testing/index.html",
      "tag.html",
      "{{ tag.name }} {{ tag.url }} {{ tag.count }}",
      { "blog/a.md": post("2026-01-01", "tags: [Testing]\n") },
    );
    expect(html).toBe("Testing /tags/testing/ 1");
  });

  it("uses the Markdown settings of the config", () => {
    const html = render(
      "blog/a/index.html",
      "post.html",
      "{{ page.html }}",
      { "blog/a.md": post("2026-01-01", "", "<b>hi</b>\n") },
      { markdown: { rawHtml: "escape" } },
    );
    expect(html).toContain("&lt;b&gt;");
  });

  it("uses filters from the config", () => {
    const html = render(
      "404.html",
      "404.html",
      '{{ "hi" | shout }}',
      {},
      {
        filters: { shout: (value) => `${String(value)}!` },
      },
    );
    expect(html).toBe("hi!");
  });

  it("lets templates extend and include each other", () => {
    const templates = {
      ...plainTheme,
      "base.html": '<main>{% block content %}{% endblock %}</main>{% include "footer.html" %}',
      "footer.html": "<footer>{{ site.title }}</footer>",
      "404.html": '{% extends "base.html" %}{% block content %}{{ page.title }}{% endblock %}',
    };
    const site = built({ templates, config: { site: { title: "Ada" } } });
    expect(fileOf(site, "404.html")).toBe("<main>Page not found</main><footer>Ada</footer>");
  });

  it("shows drafts when the config asks for them", () => {
    const content = { "blog/a.md": post("2026-01-01", "draft: true\n") };
    expect(built({ content }).files.map((file) => file.path)).not.toContain("blog/a/index.html");
    expect(built({ content, config: { drafts: true } }).files.map((file) => file.path)).toContain(
      "blog/a/index.html",
    );
  });
});

describe("a folder's own page", () => {
  const content = {
    "pages/notes/index.md": "---\ntitle: Notes\n---\n",
    "pages/notes/reading.md": "---\ntitle: Reading list\ndescription: Books\norder: 1\n---\n",
    "pages/notes/tools/index.md": "---\ntitle: Tools\ndescription: What I use\n---\n",
    "pages/notes/tools/editor.md": "---\ntitle: Editor\n---\n",
    "pages/notes/old/a.md": "---\ntitle: Old one\n---\n",
    "pages/now.md": "---\ntitle: Now\n---\n",
  };
  const items =
    "{% for item in folder.items %}{{ item.title }}{% if item.url %} {{ item.url }}{% endif %}{% if item.description %} ({{ item.description }}){% endif %}{% if item.items %} [{% for inner in item.items %}{{ inner.title }}{% endfor %}]{% endif %};{% endfor %}";

  it("gets the folder: the title, address and description of each page and folder in it", () => {
    expect(render("notes/index.html", "page.html", items, content)).toBe(
      "Reading list /notes/reading/ (Books);Old [Old one];Tools /notes/tools/ (What I use) [Editor];",
    );
  });

  it("gets its own folder, not the section, in a folder inside a section", () => {
    expect(render("notes/tools/index.html", "page.html", items, content)).toBe(
      "Editor /notes/tools/editor/;",
    );
  });

  it.each(["notes/reading/index.html", "notes/tools/editor/index.html", "now/index.html"])(
    "is the only page that gets one, not %s",
    (path) => {
      const template = "{% if folder %}a folder{% else %}none{% endif %}";
      expect(render(path, "page.html", template, content)).toBe("none");
    },
  );

  it("gives the section's tree the descriptions too", () => {
    const template = "{% for item in section.items %}{{ item.description }};{% endfor %}";
    expect(render("notes/reading/index.html", "page.html", template, content)).toBe(
      "Books;;What I use;",
    );
  });
});

/** A fenced code block in a language. */
const fence = (language: string, indent = "") =>
  `${indent}\`\`\`${language}\n${indent}x\n${indent}\`\`\`\n`;

function checkWarningsOf(input: Partial<SiteInput>) {
  const config = { site: { url: "https://example.com" }, ...input.config };
  // The post's HTML is printed, so its footnote has somewhere to lead.
  const templates = { ...plainTheme, "post.html": "{{ page.html }}" };
  const result = buildSite({ content: {}, templates, ...input, config });
  if (!result.ok) throw new Error(result.error.map((problem) => problem.message).join("\n"));
  return result.value;
}

describe("code gensane doesn't color", () => {
  const content = {
    "blog/a.md": post(
      "2026-01-01",
      "",
      `Intro.\n\n${fence("elixir")}\n- An item:\n\n${fence("zig", "  ")}`,
    ),
    "blog/b.md": post(
      "2026-01-02",
      "",
      `${fence("Elixir")}\n> ${fence("elixir").trimEnd().replaceAll("\n", "\n> ")}\n\nSee[^1].\n\n[^1]: A note.\n\n${fence("zig", "    ")}`,
    ),
  };

  it("is a warning for check, one for each language, at its first block, with how many there are", () => {
    expect(checkWarningsOf({ content }).checkWarnings).toMatchObject([
      {
        code: "GS419",
        severity: "warning",
        message: 'gensane doesn\'t color code in "elixir" (3 blocks; this is the first)',
        hint: 'color it with your own markdown.highlight in the config, or write "text" after the backticks',
        span: { file: "content/blog/a.md", start: { line: 7, column: 1 } },
      },
      {
        code: "GS419",
        message: 'gensane doesn\'t color code in "zig" (2 blocks; this is the first)',
        span: { file: "content/blog/a.md", start: { line: 13, column: 3 } },
      },
    ]);
  });

  it("says one block when there is one", () => {
    const one = { "blog/a.md": post("2026-01-01", "", fence("zig")) };
    expect(checkWarningsOf({ content: one }).checkWarnings.map(({ message }) => message)).toEqual([
      'gensane doesn\'t color code in "zig" (1 block; this is the first)',
    ]);
  });

  it("isn't a warning of the build", () => {
    expect(checkWarningsOf({ content }).warnings).toEqual([]);
  });

  it.each(["text", "txt", "plain", "plaintext", "console", "mermaid", "TEXT", ""])(
    "leaves out code meant to stay plain, such as %j",
    (language) => {
      const plain = { "blog/a.md": post("2026-01-01", "", fence(language)) };
      expect(checkWarningsOf({ content: plain }).checkWarnings).toEqual([]);
    },
  );

  it("leaves out code gensane colors", () => {
    const colored = { "blog/a.md": post("2026-01-01", "", fence("sql") + fence("ts")) };
    expect(checkWarningsOf({ content: colored }).checkWarnings).toEqual([]);
  });

  it("asks the site's own highlighter, and says nothing when the config turns colors off", () => {
    const everything = { markdown: { highlight: (code: string) => code } };
    expect(checkWarningsOf({ content, config: everything }).checkWarnings).toEqual([]);
    const off = { markdown: { highlight: false as const } };
    expect(checkWarningsOf({ content, config: off }).checkWarnings).toEqual([]);
  });

  it("leaves out drafts that aren't built", () => {
    const draft = { "blog/a.md": post("2026-01-01", "draft: true\n", fence("zig")) };
    expect(checkWarningsOf({ content: draft }).checkWarnings).toEqual([]);
  });

  it("counts drafts when they are built, with --drafts", () => {
    const draft = { "blog/a.md": post("2026-01-01", "draft: true\n", fence("zig")) };
    const config = { drafts: true };
    expect(checkWarningsOf({ content: draft, config }).checkWarnings).toHaveLength(1);
  });
});

describe("problems", () => {
  it("names a template that the site needs and the theme doesn't have, once", () => {
    const { "post.html": _, ...withoutPost } = plainTheme;
    const content = { "blog/a.md": post("2026-01-01"), "blog/b.md": post("2026-01-02") };
    expect(problemsOf({ content, templates: withoutPost })).toMatchObject([
      {
        code: CoreCodes.missingTemplate,
        message: 'there is no template "post.html", which /blog/a/ needs',
        hint: "add post.html to the theme",
        span: { file: "post.html", start: { line: 1, column: 1 } },
      },
    ]);
  });

  it("doesn't need templates for pages the site doesn't have", () => {
    const { "post.html": _, "blog.html": __, ...withoutBlog } = plainTheme;
    expect(problemsOf({ templates: withoutBlog })).toEqual([]);
  });

  it("reports mistakes in templates before rendering", () => {
    const templates = { ...plainTheme, "post.html": "{{ page.title | nope }}" };
    expect(problemsOf({ templates }).map((problem) => problem.code)).toEqual(["GS320"]);
  });

  it("reports a mistake that a template makes on every page once", () => {
    const templates = { ...plainTheme, "post.html": "{{ missing }}" };
    const content = { "blog/a.md": post("2026-01-01"), "blog/b.md": post("2026-01-02") };
    expect(problemsOf({ content, templates }).map((problem) => problem.code)).toEqual(["GS330"]);
  });

  it("reports the same mistake in two templates, at the same place, twice", () => {
    const templates = { ...plainTheme, "post.html": "{{ missing }}", "blog.html": "{{ missing }}" };
    const content = { "blog/a.md": post("2026-01-01") };
    expect(problemsOf({ content, templates }).map((problem) => problem.span.file)).toEqual([
      "blog.html",
      "post.html",
    ]);
  });

  it("keeps the warnings about content when a later step fails", () => {
    const content = { "blog/2026-01-02-a.md": post("2026-01-01"), "pages/blog.md": minimal.page };
    expect(
      problemsOf({ content })
        .map((problem) => problem.code)
        .toSorted(),
    ).toEqual([CoreCodes.dateMismatch, CoreCodes.reservedUrl]);
    const templates = { ...plainTheme, "post.html": "{{ page.title | nope }}" };
    expect(
      problemsOf({ content: { "blog/2026-01-02-a.md": post("2026-01-01") }, templates })
        .map((problem) => problem.code)
        .toSorted(),
    ).toEqual(["GS320", CoreCodes.dateMismatch]);
  });

  it("reports the problems of the content, and stops before rendering", () => {
    const templates = { ...plainTheme, "post.html": "{{ missing }}" };
    const content = { "blog/a.md": "---\ntitle: A\n---\n", "notes/b.md": "" };
    expect(problemsOf({ content, templates }).map((problem) => problem.code)).toEqual([
      "GS220",
      CoreCodes.unknownFolder,
    ]);
  });

  it("collects the warnings of every step", () => {
    const content = {
      "blog/2026-01-02-a.md": post("2026-01-01", "tags: [X]\n"),
      "blog/b.md": post("2026-01-03", "tags: [x, x]\n"),
      "blog/c.md": post("2026-01-04", "tags: [x]\n"),
    };
    const templates = { ...plainTheme, "post.html": "{{ page.titel }}" };
    expect(
      problemsOf({ content, templates })
        .map((problem) => problem.code)
        .toSorted(),
    ).toEqual(["GS331", CoreCodes.dateMismatch, CoreCodes.tagSpelling]);
  });

  it("uses the content folder of the config in problems", () => {
    const result = buildSite({
      content: { "notes/a.md": "" },
      templates: plainTheme,
      config: { contentFolder: "site/content" },
    });
    expect(result.ok ? undefined : result.error[0]?.span.file).toBe("site/content/notes/a.md");
  });
});

describe("a site under a path", () => {
  const under = { site: { url: "https://ada.github.io/notes/" } };
  const content = {
    "blog/hello.md": `${minimal.post}See [about](/about/) and ![me](/images/me.png).\n`,
    "pages/about.md": minimal.page,
  };
  const templates = {
    ...plainTheme,
    "post.html": '<a href="/">Home</a><link href="/assets/style.css">{{ page.html }}',
  };

  it("adds the path to links in pages, from content and from templates", () => {
    const site = built({
      content,
      templates,
      config: under,
      publicFiles: ["images/me.png"],
      themeAssets: ["assets/style.css"],
    });
    expect(fileOf(site, "blog/hello/index.html")).toBe(
      '<a href="/notes/">Home</a><link href="/notes/assets/style.css"><p>See <a href="/notes/about/">about</a> and <img src="/notes/images/me.png" alt="me" />.</p>\n',
    );
  });

  it("checks links as they are written, so /about/ still leads to the about page", () => {
    expect(
      problemsOf({
        content,
        templates,
        config: under,
        publicFiles: ["images/me.png"],
        themeAssets: ["assets/style.css"],
      }),
    ).toEqual([]);
  });

  it("adds the path to links in the content of the feed", () => {
    const site = built({
      content,
      templates,
      config: under,
      publicFiles: ["images/me.png"],
      themeAssets: ["assets/style.css"],
    });
    expect(fileOf(site, "feed.xml")).toContain(
      "&lt;a href=&quot;/notes/about/&quot;&gt;about&lt;/a&gt;",
    );
  });

  it("leaves links as they are written when the site is served at the root, as in gensane dev", () => {
    const site = built({
      content,
      templates,
      config: { ...under, servedAtRoot: true },
      publicFiles: ["images/me.png"],
      themeAssets: ["assets/style.css"],
    });
    expect(fileOf(site, "blog/hello/index.html")).toContain('<a href="/about/">about</a>');
  });

  it("changes nothing for a site at the root", () => {
    const site = built({
      content,
      templates,
      config: { site: { url: "https://example.com" } },
      publicFiles: ["images/me.png"],
      themeAssets: ["assets/style.css"],
    });
    expect(fileOf(site, "blog/hello/index.html")).toContain('<a href="/">Home</a>');
  });

  it("changes only pages, not other files the site writes", () => {
    const site = built({
      content,
      templates,
      config: under,
      publicFiles: ["images/me.png"],
      themeAssets: ["assets/style.css"],
    });
    expect(fileOf(site, "sitemap.xml")).toContain("<loc>https://ada.github.io/notes/about/</loc>");
  });
});

describe("the theme", () => {
  it("gives every template the theme settings, with their defaults", () => {
    const content = { "pages/about.md": minimal.page };
    const templates = {
      ...plainTheme,
      "about.html": "{{ theme.palette }} {{ theme.font }} {{ theme.home.sections | join }}",
    };
    const site = built({ content, templates, config: { theme: { font: "serif" } } });
    expect(fileOf(site, "about/index.html")).toBe(
      "default serif intro, recent-posts, featured-projects, talks",
    );
  });

  it("writes the settings as CSS, which links can lead to", () => {
    const content = { "blog/a.md": `${minimal.post}[styles](/assets/settings.css)\n` };
    const site = built({ content, config: { theme: { palette: "nord", colorScheme: "light" } } });
    expect(fileOf(site, "assets/settings.css")).toContain("--background: #eceff4;");
    expect(problemsOf({ content })).toEqual([]);
  });

  it("refuses a theme asset that would replace the settings", () => {
    const content = { "blog/a.md": minimal.post };
    expect(problemsOf({ content, themeAssets: ["assets/settings.css"] })).toMatchObject([
      {
        code: CoreCodes.themeFileClash,
        message:
          '"theme/assets/settings.css" would replace the theme settings, which the site writes',
      },
    ]);
  });
});

describe("colors in code", () => {
  const content = { "pages/about.md": `${minimal.page}\n\`\`\`ts\nconst a = 1;\n\`\`\`\n` };
  const templates = { ...plainTheme, "about.html": "{{ page.html }}" };
  const code = (markdown: NonNullable<SiteInput["config"]>) =>
    fileOf(built({ content, templates, config: markdown }), "about/index.html") ?? "";

  it("are added by gensane itself, at build time", () => {
    expect(code({})).toContain(
      '<pre><code class="language-ts"><span class="hl-keyword">const</span> a = <span class="hl-number">1</span>;',
    );
  });

  it("come from the config's own highlighter instead, when it has one", () => {
    expect(code({ markdown: { highlight: () => "mine" } })).toContain(
      '<code class="language-ts">mine</code>',
    );
  });

  it("are left out with highlight: false", () => {
    expect(code({ markdown: { highlight: false } })).toContain(
      '<code class="language-ts">const a = 1;\n</code>',
    );
  });
});

describe("the icon of the site", () => {
  const content = { "pages/about.md": minimal.page };
  const templates = { ...plainTheme, "about.html": "{{ favicon }}" };

  it("is made from the first letter of the title, in the palette's colors", () => {
    const site = built({ content, templates, config: { site: { title: "ivy's notes" } } });
    expect(fileOf(site, "about/index.html")).toBe("/assets/favicon.svg");
    const icon = fileOf(site, "assets/favicon.svg") ?? "";
    expect(icon).toContain('<rect width="64" height="64" rx="14" fill="#5b4bdb"/>');
    expect(icon).toMatch(/fill="#ffffff">I<\/text>/);
  });

  it("writes a letter that is HTML safely", () => {
    const site = built({ content, templates, config: { site: { title: "<site>" } } });
    expect(fileOf(site, "assets/favicon.svg")).toContain(">&lt;</text>");
  });

  it.each([
    [["favicon.svg"], [], "/favicon.svg"],
    [["favicon.ico"], [], "/favicon.ico"],
    [["favicon.png"], [], "/favicon.png"],
    [["favicon.ico", "favicon.png"], [], "/favicon.png"],
    [[], ["assets/favicon.svg"], "/assets/favicon.svg"],
  ])(
    "uses the site's or the theme's own icon (%j, %j) instead of making one",
    (publicFiles, themeAssets, url) => {
      const site = built({
        content,
        templates,
        publicFiles,
        themeAssets,
        config: { site: { title: "Ivy" } },
      });
      expect(fileOf(site, "about/index.html")).toBe(url);
      expect(fileOf(site, "assets/favicon.svg")).toBeUndefined();
    },
  );

  it.each([{}, { title: "   " }])(
    "is left out when the title has no letter (%j)",
    (siteSettings) => {
      const site = built({ content, templates, config: { site: siteSettings } });
      expect(fileOf(site, "about/index.html")).toBe("");
      expect(fileOf(site, "assets/favicon.svg")).toBeUndefined();
    },
  );
});

describe("analytics and the site's own head", () => {
  const content = { "pages/about.md": minimal.page };
  const templates = {
    ...plainTheme,
    "about.html":
      "{{ analytics.google }}|{{ analytics.plausible }}|{{ analytics.cloudflare }}|{{ head }}",
  };

  it("gives templates the ID of each service", () => {
    const analytics = { google: "G-ABC123", plausible: "pa-x", cloudflare: "abc" };
    const site = built({ content, templates, config: { analytics } });
    expect(fileOf(site, "about/index.html")).toBe("G-ABC123|pa-x|abc|");
  });

  it("lets a template ask for a service a site without analytics doesn't have", () => {
    const site = built({
      content,
      templates: {
        ...plainTheme,
        "about.html": "{% if analytics.google %}on{% else %}off{% endif %}",
      },
    });
    expect(fileOf(site, "about/index.html")).toBe("off");
  });

  it("gives templates the site's own head as it is, unescaped", () => {
    const head = '<meta name="x" content="a&amp;b">';
    const site = built({ content, templates, head });
    expect(fileOf(site, "about/index.html")).toBe(`|||${head}`);
  });

  it("adds the path of the site to the addresses in the site's own head, as on the rest of the page", () => {
    const site = built({
      content,
      templates,
      head: '<link rel="stylesheet" href="/fonts.css">',
      config: { site: { url: "https://example.com/notes/" } },
    });
    expect(fileOf(site, "about/index.html")).toContain('href="/notes/fonts.css"');
  });
});

describe("the day of the build", () => {
  const content = { "pages/about.md": minimal.page };
  const templates = {
    ...plainTheme,
    "about.html": '{% if today %}{{ today | date("d MMM yyyy") }}{% endif %}',
  };

  it("is a date templates can write", () => {
    const site = built({ content, templates, config: { today: "2026-11-21" } });
    expect(fileOf(site, "about/index.html")).toBe("21 Nov 2026");
  });

  it("is nothing when it isn't known, without a warning", () => {
    const site = built({ content, templates, config: { site: { url: "https://example.com" } } });
    expect(fileOf(site, "about/index.html")).toBe("");
    expect(site.warnings).toEqual([]);
  });
});

describe("navigation and the feed", () => {
  const menu =
    '{% for item in navigation %}{{ item.title }} {{ item.url }};{% endfor %} {{ feed | default("no feed") }}';
  const templates = { ...plainTheme, "home.html": menu };

  it("lists the blog, projects, talks and about pages, in that order, only when the site has them", () => {
    const content = {
      "talks/a.md": minimal.talk,
      "blog/a.md": minimal.post,
      "experience/a.md": minimal.experience,
    };
    const site = built({ content, templates });
    expect(fileOf(site, "index.html")).toBe("Blog /blog/;Talks /talks/;About /about/; no feed");
  });

  it("lists projects between the blog and the talks", () => {
    const content = {
      "talks/a.md": minimal.talk,
      "projects/a.md": minimal.project,
      "blog/a.md": minimal.post,
    };
    expect(fileOf(built({ content, templates }), "index.html")).toBe(
      "Blog /blog/;Projects /projects/;Talks /talks/; no feed",
    );
  });

  it("uses the menu of the config instead, in its order, with /uses read as /uses/", () => {
    const content = {
      "blog/a.md": minimal.post,
      "talks/a.md": minimal.talk,
      "pages/uses.md": "---\ntitle: Uses\n---\n",
    };
    const nav = [
      { title: "Uses", url: "/uses" },
      { title: "Writing", url: "/blog/" },
      { title: "CV", url: "https://example.com/cv.pdf" },
    ];
    expect(fileOf(built({ content, templates, config: { nav } }), "index.html")).toBe(
      "Uses /uses/;Writing /blog/;CV https://example.com/cv.pdf; no feed",
    );
  });

  it("leaves a file, a part of a page and a query as they are written", () => {
    const content = { "pages/about.md": "---\ntitle: About\n---\n## Contact\n" };
    const nav = [
      { title: "CV", url: "/cv.pdf" },
      { title: "Contact", url: "/about/#contact" },
      { title: "About", url: "/about?from=menu" },
    ];
    const site = built({ content, templates, config: { nav }, publicFiles: ["cv.pdf"] });
    expect(fileOf(site, "index.html")).toBe(
      "CV /cv.pdf;Contact /about/#contact;About /about?from=menu; no feed",
    );
  });

  it("marks the item of the page, and of the pages below it, but never another site", () => {
    const current = "{% for item in navigation %}{{ item.title }}:{{ item.current }};{% endfor %}";
    const nav = [
      { title: "Home", url: "/" },
      { title: "Writing", url: "/blog/" },
      { title: "CV", url: "https://example.com/blog/" },
    ];
    const site = built({
      content: { "blog/a.md": minimal.post },
      templates: {
        ...plainTheme,
        "home.html": current,
        "blog.html": current,
        "post.html": current,
      },
      config: { nav },
    });
    expect(fileOf(site, "index.html")).toBe("Home:page;Writing:false;CV:false;");
    expect(fileOf(site, "blog/index.html")).toBe("Home:false;Writing:page;CV:false;");
    expect(fileOf(site, "blog/a/index.html")).toBe("Home:false;Writing:true;CV:false;");
  });

  it("marks the blog of the menu made from the site on a post too", () => {
    const current = "{% for item in navigation %}{{ item.title }}:{{ item.current }};{% endfor %}";
    const site = built({
      content: { "blog/a.md": minimal.post },
      templates: { ...plainTheme, "post.html": current },
    });
    expect(fileOf(site, "blog/a/index.html")).toBe("Blog:true;");
  });

  it("gives the addresses of the lists the site has, whatever the menu is", () => {
    const content = { "blog/a.md": minimal.post, "talks/a.md": minimal.talk };
    const lists = "{{ lists.blog }}|{{ lists.projects }}|{{ lists.talks }}";
    const site = built({
      content,
      templates: { ...plainTheme, "home.html": lists },
      config: { nav: [{ title: "Talks", url: "/talks/" }] },
    });
    expect(fileOf(site, "index.html")).toBe("/blog/||/talks/");
  });

  it("checks that each page of the menu is there, and points at the config", () => {
    const result = buildSite({
      content: { "pages/uses.md": "---\ntitle: Uses\n---\n" },
      templates: plainTheme,
      config: {
        site: { url: "https://example.com" },
        nav: [
          { title: "Uses", url: "/usses/" },
          { title: "Elsewhere", url: "https://example.com/nowhere/" },
        ],
      },
    });
    expect(result.ok ? [] : result.error).toMatchObject([
      {
        code: CoreCodes.brokenLink,
        message: '"/usses/" doesn\'t lead to a page or a file of the site',
        hint: 'did you mean "/uses/"?',
        span: { file: "gensane.config.ts" },
      },
    ]);
  });

  it("lists nothing for a site with nothing to list", () => {
    expect(fileOf(built({ content: {}, templates }), "index.html")).toBe(" no feed");
  });

  it("gives the address of the feed when the site has one", () => {
    const site = built({
      content: { "blog/a.md": minimal.post },
      templates,
      config: { site: { url: "https://example.com" } },
    });
    expect(fileOf(site, "index.html")).toBe("Blog /blog/; /feed.xml");
  });

  it("has no feed when every post is a draft, even with drafts shown", () => {
    const draft = minimal.post.replace("---\n", "---\ndraft: true\n");
    const config = { site: { url: "https://example.com" }, drafts: true };
    const site = built({ content: { "blog/a.md": draft }, templates, config });
    expect(fileOf(site, "index.html")).toBe("Blog /blog/; no feed");
  });
});

/** The config with `llms` turned on. */
const withLlms = (config: SiteConfig) => ({ ...config, llms: true });

describe("llms.txt", () => {
  const content = {
    "index.md": "---\ntitle: Home\n---\nWelcome.\n",
    "pages/about.md": "---\ntitle: About\ndescription: Who Ada is\n---\nI build compilers.\n",
    "pages/docs/index.md": "---\ntitle: Docs\n---\nThe docs.\n",
    "pages/docs/start.md": "---\ntitle: Start\norder: 1\n---\nStart here.\n",
    "pages/docs/guides/search.md": "---\ntitle: Search\n---\nFinding things.\n",
    "blog/2026-01-01-old.md": post("2026-01-01", "", "Old.\n"),
    "blog/2026-02-01-new.md": post(
      "2026-02-01",
      "description: The newer one\n",
      "New, with [a link](/about/).\n",
    ),
    "blog/2026-03-01-draft.md": post("2026-03-01", "draft: true\n", "Not yet.\n"),
    "projects/tiny-calc.md": "---\ntitle: tiny-calc\ndescription: A calculator\n---\nIt adds.\n",
    "talks/a.md": minimal.talk,
  };
  const site = { title: "Ada's notes", url: "https://ada.dev", description: "Notes on compilers" };

  it("is only written when the config asks for it", () => {
    const files = built({ content, config: { site } }).files.map(({ path }) => path);
    expect(files.filter((path) => path.endsWith(".md") || path.endsWith(".txt"))).toEqual([]);
  });

  it("lists the pages, each section in reading order, the posts and the projects, with full addresses", () => {
    expect(fileOf(built({ content, config: withLlms({ site }) }), "llms.txt")).toBe(
      [
        "# Ada's notes",
        "",
        "> Notes on compilers",
        "",
        "## Pages",
        "",
        "- [Home](https://ada.dev/index.md)",
        "- [About](https://ada.dev/about/index.md): Who Ada is",
        "",
        "## Docs",
        "",
        "- [Docs](https://ada.dev/docs/index.md)",
        "- [Start](https://ada.dev/docs/start/index.md)",
        "- [Search](https://ada.dev/docs/guides/search/index.md)",
        "",
        "## Posts",
        "",
        "- [Post 2026-02-01](https://ada.dev/blog/new/index.md): The newer one",
        "- [Post 2026-01-01](https://ada.dev/blog/old/index.md)",
        "",
        "## Projects",
        "",
        "- [tiny-calc](https://ada.dev/projects/tiny-calc/index.md): A calculator",
        "",
      ].join("\n"),
    );
  });

  it("writes each listed page as Markdown, with its title and description, beside its HTML", () => {
    const files = built({ content, config: withLlms({ site }) });
    expect(fileOf(files, "blog/new/index.md")).toBe(
      "# Post 2026-02-01\n\n> The newer one\n\nNew, with [a link](/about/).\n",
    );
    expect(fileOf(files, "index.md")).toBe("# Home\n\nWelcome.\n");
    expect(files.files.map(({ path }) => path).filter((path) => path.endsWith(".md"))).toEqual([
      "about/index.md",
      "blog/new/index.md",
      "blog/old/index.md",
      "docs/guides/search/index.md",
      "docs/index.md",
      "docs/start/index.md",
      "index.md",
      "projects/tiny-calc/index.md",
    ]);
  });

  it("leaves drafts out, even when they are shown", () => {
    const files = built({ content, config: withLlms({ site, drafts: true }) });
    expect(fileOf(files, "llms.txt")).not.toContain("draft");
    expect(fileOf(files, "blog/draft/index.md")).toBeUndefined();
  });

  it("adds the site's path to the addresses of a site under a path", () => {
    const under = { ...site, url: "https://ada.github.io/notes" };
    expect(fileOf(built({ content, config: withLlms({ site: under }) }), "llms.txt")).toContain(
      "- [About](https://ada.github.io/notes/about/index.md): Who Ada is",
    );
  });

  it("uses addresses from the root without the site's address, and the host or a plain name for a title", () => {
    const text = fileOf(
      built({ content: { "pages/now.md": minimal.page }, config: withLlms({}) }),
      "llms.txt",
    );
    expect(text).toBe("# Site\n\n## Pages\n\n- [About](/now/index.md)\n");
    const hosted = built({ content: {}, config: withLlms({ site: { url: "https://ada.dev" } }) });
    expect(fileOf(hosted, "llms.txt")).toBe("# ada.dev\n");
  });

  it("keeps the brackets of a title from ending its link", () => {
    const files = built({
      content: { "pages/now.md": "---\ntitle: Now [2026]\n---\n" },
      config: withLlms({}),
    });
    expect(fileOf(files, "llms.txt")).toContain("- [Now \\[2026\\]](/now/index.md)");
  });
});
