import { describe, expect, it } from "vitest";
import { type BuiltSite, CoreCodes, type SiteInput, buildSite } from "../index.ts";
import { minimal } from "../test-helpers.ts";

/** A template for every kind of page, each printing the title, so that a site always builds. */
const plainTheme: Readonly<Record<string, string>> = Object.fromEntries(
  [
    "home",
    "post",
    "blog",
    "tag",
    "tags",
    "project",
    "projects",
    "talks",
    "about",
    "page",
    "404",
  ].map((name) => [`${name}.html`, `<h1>{{ page.title }}</h1>`]),
);

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

function problemsOf(input: Partial<SiteInput>) {
  const result = buildSite({ content: {}, templates: plainTheme, ...input });
  return result.ok ? result.value.warnings : result.error;
}

const post = (date: string, extra = "", body = "") =>
  `---\ntitle: Post ${date}\ndate: ${date}\n${extra}---\n${body}`;

describe("output files", () => {
  it("writes a file for every page, sorted by path", () => {
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
      "blog/hello/index.html",
      "blog/index.html",
      "index.html",
      "now/index.html",
      "projects/gensane/index.html",
      "projects/index.html",
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
