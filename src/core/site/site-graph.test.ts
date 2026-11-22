import { describe, expect, it } from "vitest";
import { CoreCodes, type GraphOptions, type SiteGraph, buildSiteGraph } from "../index.ts";
import { loaded, minimal } from "../test-helpers.ts";

type Files = Readonly<Record<string, string>>;

function graphOf(files: Files, options: GraphOptions = {}): SiteGraph {
  const result = buildSiteGraph(loaded(files), options);
  if (!result.ok) throw new Error(result.error[0]?.message);
  return result.value.graph;
}

function graphProblems(files: Files, options: GraphOptions = {}) {
  const result = buildSiteGraph(loaded(files), options);
  return result.ok ? result.value.warnings : result.error;
}

function post(date: string, extra = ""): string {
  return `---\ntitle: Post\ndate: ${date}\n${extra}---\n`;
}

function project(extra = ""): string {
  return `---\ntitle: Project\n${extra}---\n`;
}

/** Posts named `p1.md` to `pN.md`, one day apart, so `pN` is the newest. */
function manyPosts(count: number, extra = ""): Record<string, string> {
  const files: Record<string, string> = {};
  for (let day = 1; day <= count; day++) {
    files[`blog/p${day}.md`] = post(`2026-01-${String(day).padStart(2, "0")}`, extra);
  }
  return files;
}

function homePageFile(graph: SiteGraph): string | undefined {
  const [home] = graph.routes;
  return home?.kind === "home" ? home.page?.file : "no home";
}

const urls = (entries: readonly { readonly url: string | undefined }[]) =>
  entries.map((entry) => entry.url);

function talk(date: string): string {
  return `---\ntitle: T\nevent: E\ndate: ${date}\n---\n`;
}

function job(start: string, extra = ""): string {
  return `---\ncompany: C\nrole: R\nstart: ${start}\n${extra}---\n`;
}

function degree(start: string): string {
  return `---\nschool: S\ndegree: D\nstart: ${start}\n---\n`;
}

describe("collections", () => {
  it("lists posts newest first, and posts on the same day by URL", () => {
    const files = {
      "blog/b.md": post("2026-01-01"),
      "blog/a.md": post("2026-01-01"),
      "blog/c.md": post("2026-03-01"),
    };
    expect(urls(graphOf(files).collections.posts)).toEqual(["/blog/c/", "/blog/a/", "/blog/b/"]);
  });

  it("leaves drafts out of every collection", () => {
    const files = {
      "blog/a.md": post("2026-01-01", "draft: true\n"),
      "projects/b.md": project("draft: true\n"),
      "pages/c.md": "---\ntitle: C\ndraft: true\n---\n",
      "blog/d.md": post("2026-01-01"),
    };
    const { collections } = graphOf(files);
    expect([collections.posts, collections.projects, collections.pages].map(urls)).toEqual([
      ["/blog/d/"],
      [],
      [],
    ]);
  });

  it("keeps drafts when asked to, for previews", () => {
    const files = { "blog/a.md": post("2026-01-01", "draft: true\n") };
    expect(urls(graphOf(files, { drafts: true }).collections.posts)).toEqual(["/blog/a/"]);
  });

  it("lists featured projects first, then by order, then by title", () => {
    const files = {
      "projects/a.md": "---\ntitle: Banana\n---\n",
      "projects/b.md": "---\ntitle: apple\n---\n",
      "projects/c.md": "---\ntitle: Zed\norder: 2\n---\n",
      "projects/d.md": "---\ntitle: Yak\norder: 1\n---\n",
      "projects/e.md": "---\ntitle: Xylophone\nfeatured: true\n---\n",
    };
    expect(urls(graphOf(files).collections.projects)).toEqual([
      "/projects/e/",
      "/projects/d/",
      "/projects/c/",
      "/projects/b/",
      "/projects/a/",
    ]);
  });

  it("lists posts on the same day by their time", () => {
    const files = {
      "blog/a.md": post("2026-01-01T09:00:00Z"),
      "blog/b.md": post("2026-01-01T18:00:00Z"),
    };
    expect(urls(graphOf(files).collections.posts)).toEqual(["/blog/b/", "/blog/a/"]);
  });

  it("lists talks newest first", () => {
    const files = { "talks/a.md": talk("2025-01-01"), "talks/b.md": talk("2026-01-01") };
    expect(graphOf(files).collections.talks.map((entry) => entry.file)).toEqual([
      "talks/b.md",
      "talks/a.md",
    ]);
  });

  it("lists experience by order, then the newest start first", () => {
    const files = {
      "experience/a.md": job("2020-01"),
      "experience/b.md": job("2024-06"),
      "experience/c.md": job("2019-01", "order: 1\n"),
      "experience/d.md": job("2024-06-15"),
    };
    expect(graphOf(files).collections.experience.map((entry) => entry.file)).toEqual([
      "experience/c.md",
      "experience/d.md",
      "experience/b.md",
      "experience/a.md",
    ]);
  });

  it("lists education the same way", () => {
    const files = { "education/a.md": degree("2015-09"), "education/b.md": degree("2020-09") };
    expect(graphOf(files).collections.education.map((entry) => entry.file)).toEqual([
      "education/b.md",
      "education/a.md",
    ]);
  });

  it("lists pages by their URL, not their file name", () => {
    const files = { "pages/a.md": "---\ntitle: A\nslug: zebra\n---\n", "pages/b.md": minimal.page };
    expect(urls(graphOf(files).collections.pages)).toEqual(["/b/", "/zebra/"]);
  });

  it("lists pages by URL, without the home page", () => {
    const files = {
      "index.md": minimal.page,
      "pages/z.md": minimal.page,
      "pages/a.md": minimal.page,
    };
    expect(urls(graphOf(files).collections.pages)).toEqual(["/a/", "/z/"]);
  });
});

describe("tags", () => {
  it("gives each tag a URL and its posts, newest first, and sorts tags by name", () => {
    const files = {
      "blog/a.md": post("2026-01-01", "tags: [testing, Compilers]\n"),
      "blog/b.md": post("2026-02-01", "tags: [testing]\n"),
    };
    expect(
      graphOf(files).collections.tags.map((tag) => [tag.name, tag.url, urls(tag.posts)]),
    ).toEqual([
      ["Compilers", "/tags/compilers/", ["/blog/a/"]],
      ["testing", "/tags/testing/", ["/blog/b/", "/blog/a/"]],
    ]);
  });

  it("lists a post once, even when it has a tag twice", () => {
    const files = { "blog/a.md": post("2026-01-01", "tags: [a, a]\n") };
    expect(graphOf(files).collections.tags[0]?.posts).toHaveLength(1);
  });

  it("leaves out the tags of drafts", () => {
    const files = { "blog/a.md": post("2026-01-01", "tags: [secret]\ndraft: true\n") };
    expect(graphOf(files).collections.tags).toEqual([]);
  });

  it("lists tags with the same URL together, under the spelling most posts use", () => {
    const files = {
      "blog/a.md": post("2026-01-01", "tags: [typescript]\n"),
      "blog/b.md": post("2026-01-02", "tags: [typescript]\n"),
      "blog/c.md": post("2026-01-03", "tags: [TypeScript]\n"),
    };
    const [tag] = graphOf(files).collections.tags;
    expect([tag?.name, tag?.posts.length]).toEqual(["typescript", 3]);
    expect(graphProblems(files)).toMatchObject([
      {
        code: CoreCodes.tagSpelling,
        severity: "warning",
        message:
          'the tag "TypeScript" is listed as "typescript", because both have the URL /tags/typescript/',
        hint: "write the tag the same way in every post",
        span: { file: "content/blog/c.md" },
      },
    ]);
  });

  it("counts a spelling once for each post, even when a post repeats it", () => {
    const files = {
      "blog/a.md": post("2026-01-01", "tags: [Ab, Ab]\n"),
      "blog/b.md": post("2026-01-02", "tags: [ab]\n"),
      "blog/c.md": post("2026-01-03", "tags: [ab]\n"),
    };
    expect(graphOf(files).collections.tags[0]?.name).toBe("ab");
  });

  it("warns at the first file, in file order, that uses another spelling", () => {
    const files = {
      "blog/a.md": post("2026-01-01", "tags: [ab]\n"),
      "blog/b.md": post("2026-01-02", "tags: [ab]\n"),
      "blog/c.md": post("2026-01-03", "tags: [ab]\n"),
      "blog/m.md": post("2026-01-04", "tags: [Ab]\n"),
      "blog/z.md": post("2026-01-05", "tags: [Ab]\n"),
    };
    expect(graphProblems(files).map((problem) => problem.span.file)).toEqual(["content/blog/m.md"]);
  });

  it("sorts tags by the name people see", () => {
    const files = { "blog/a.md": post("2026-01-01", "tags: [a+, a b]\n") };
    expect(graphOf(files).collections.tags.map((tag) => tag.name)).toEqual(["a b", "a+"]);
  });

  it("chooses the first spelling in sorted order when both are used equally", () => {
    const files = {
      "blog/a.md": post("2026-01-01", "tags: [typescript]\n"),
      "blog/b.md": post("2026-01-02", "tags: [TypeScript]\n"),
    };
    expect(graphOf(files).collections.tags[0]?.name).toBe("TypeScript");
  });

  it("rejects a tag with nothing to use in a URL", () => {
    expect(graphProblems({ "blog/a.md": post("2026-01-01", "tags: [日本]\n") })).toMatchObject([
      {
        code: CoreCodes.tagWithoutUrl,
        message: 'the tag "日本" has nothing to use in a URL',
        hint: "use a tag with letters or digits from a to z or 0 to 9",
        span: { file: "content/blog/a.md", start: { line: 1, column: 1 } },
      },
    ]);
  });
});

describe("previous and next", () => {
  it("links each post to the one before and after it in time", () => {
    const routes = graphOf(manyPosts(3)).routes.filter((route) => route.kind === "post");
    expect(routes.map((route) => [route.page.url, route.previous?.url, route.next?.url])).toEqual([
      ["/blog/p1/", undefined, "/blog/p2/"],
      ["/blog/p2/", "/blog/p1/", "/blog/p3/"],
      ["/blog/p3/", "/blog/p2/", undefined],
    ]);
  });
});

describe("pagination", () => {
  it("splits the list of posts into pages", () => {
    const routes = graphOf(manyPosts(25)).routes.filter((route) => route.kind === "blog");
    expect(
      routes.map(({ url, pagination }) => [
        url,
        pagination.items.length,
        pagination.current,
        pagination.total,
        pagination.previousUrl,
        pagination.nextUrl,
      ]),
    ).toEqual([
      ["/blog/", 10, 1, 3, undefined, "/blog/page/2/"],
      ["/blog/page/2/", 10, 2, 3, "/blog/", "/blog/page/3/"],
      ["/blog/page/3/", 5, 3, 3, "/blog/page/2/", undefined],
    ]);
  });

  it("puts the newest posts on the first page", () => {
    const [first] = graphOf(manyPosts(12)).routes.filter((route) => route.kind === "blog");
    expect(first?.pagination.items[0]?.url).toBe("/blog/p12/");
  });

  it("uses the number of posts per page that it is given", () => {
    const routes = graphOf(manyPosts(5), { perPage: 2 }).routes.filter(
      (route) => route.kind === "blog",
    );
    expect(routes.map((route) => route.pagination.items.length)).toEqual([2, 2, 1]);
  });

  it("makes one page for an exact number of posts", () => {
    const routes = graphOf(manyPosts(10)).routes.filter((route) => route.kind === "blog");
    expect(routes).toHaveLength(1);
  });

  it("splits tag pages the same way", () => {
    const routes = graphOf(manyPosts(3, "tags: [a]\n"), { perPage: 2 }).routes.filter(
      (route) => route.kind === "tag",
    );
    expect(
      routes.map((route) => [route.url, route.tag.name, route.pagination.items.length]),
    ).toEqual([
      ["/tags/a/", "a", 2],
      ["/tags/a/page/2/", "a", 1],
    ]);
  });
});

describe("routes", () => {
  it("has a page for everything a full site has", () => {
    const files = {
      "index.md": minimal.page,
      "blog/hello.md": post("2026-01-01", "tags: [testing]\n"),
      "projects/gensane.md": minimal.project,
      "talks/jsconf.md": minimal.talk,
      "experience/acme.md": minimal.experience,
      "pages/now.md": minimal.page,
    };
    expect(graphOf(files).routes.map((route) => [route.url, route.kind])).toEqual([
      ["/", "home"],
      ["/404.html", "not-found"],
      ["/about/", "about"],
      ["/blog/", "blog"],
      ["/blog/hello/", "post"],
      ["/now/", "page"],
      ["/projects/", "projects"],
      ["/projects/gensane/", "project"],
      ["/search/", "search"],
      ["/tags/", "tags"],
      ["/tags/testing/", "tag"],
      ["/talks/", "talks"],
    ]);
  });

  it("always has a home page and a page for missing pages", () => {
    expect(graphOf({}).routes.map((route) => route.url)).toEqual(["/", "/404.html"]);
  });

  it("has a home page without content when there is no index.md", () => {
    const [home] = graphOf({ "pages/now.md": minimal.page }).routes;
    expect(home?.kind === "home" && home.page).toBeUndefined();
  });

  it("leaves a draft out of the home page, unless drafts are shown", () => {
    const files = { "index.md": "---\ntitle: Home\ndraft: true\n---\n" };
    expect(homePageFile(graphOf(files))).toBeUndefined();
    expect(homePageFile(graphOf(files, { drafts: true }))).toBe("index.md");
  });

  it("refuses a number of posts per page below 1", () => {
    expect(() => buildSiteGraph([], { perPage: 0 })).toThrow("perPage");
    expect(() => buildSiteGraph([], { perPage: 1.5 })).toThrow("perPage");
  });

  it("gives the home page the content of index.md", () => {
    const [home] = graphOf({ "index.md": minimal.page }).routes;
    expect(home?.kind === "home" && home.page?.file).toBe("index.md");
  });

  it("uses pages/about.md as the introduction of the about page", () => {
    const files = { "pages/about.md": minimal.page, "education/a.md": minimal.education };
    const routes = graphOf(files).routes;
    expect(routes.filter((route) => route.url === "/about/").map((route) => route.kind)).toEqual([
      "about",
    ]);
    const about = routes.find((route) => route.kind === "about");
    expect(about?.kind === "about" && about.page?.file).toBe("pages/about.md");
  });

  it.each([
    ["experience", { "experience/a.md": minimal.experience }],
    ["education", { "education/a.md": minimal.education }],
  ])("makes an about page for %s alone", (_, files) => {
    const routes = graphOf(files).routes;
    expect(routes.find((route) => route.url === "/about/")?.kind).toBe("about");
  });

  it("makes an about page from pages/about.md alone", () => {
    const routes = graphOf({ "pages/about.md": minimal.page }).routes;
    expect(routes.find((route) => route.url === "/about/")?.kind).toBe("about");
  });

  it("doesn't publish drafts", () => {
    const files = {
      "blog/a.md": post("2026-01-01", "draft: true\n"),
      "pages/b.md": "---\ntitle: B\ndraft: true\n---\n",
    };
    expect(graphOf(files).routes.map((route) => route.url)).toEqual(["/", "/404.html"]);
  });

  it.each([
    ["pages/blog.md", { "blog/a.md": post("2026-01-01") }, "/blog/", "the list of posts"],
    [
      "pages/projects.md",
      { "projects/a.md": minimal.project },
      "/projects/",
      "the list of projects",
    ],
    ["pages/talks.md", { "talks/a.md": minimal.talk }, "/talks/", "the list of talks"],
    [
      "pages/tags.md",
      { "blog/a.md": post("2026-01-01", "tags: [a]\n") },
      "/tags/",
      "the list of tags",
    ],
  ])("rejects %s when the site makes that page itself", (path, other, url, what) => {
    expect(graphProblems({ [path]: minimal.page, ...other })).toMatchObject([
      {
        code: CoreCodes.reservedUrl,
        message: `${url} is ${what}, so "content/${path}" can't use it`,
        hint: "give the page another file name, or a `slug:`",
        span: { file: `content/${path}`, start: { line: 1, column: 1 } },
      },
    ]);
  });

  it("lets a page use a URL that the site doesn't need", () => {
    const routes = graphOf({ "pages/blog.md": minimal.page }).routes;
    expect(routes.find((route) => route.url === "/blog/")?.kind).toBe("page");
  });

  it("points at the slug field when it chose the URL", () => {
    const files = { "pages/x.md": "---\ntitle: X\nslug: talks\n---\n", "talks/a.md": minimal.talk };
    expect(graphProblems(files)).toMatchObject([{ span: { start: { line: 3, column: 7 } } }]);
  });

  it("uses the paths of the files that were loaded", () => {
    const files = { "pages/talks.md": minimal.page, "talks/a.md": minimal.talk };
    const result = buildSiteGraph(loaded(files, { contentFolder: "site/content" }));
    expect(result.ok ? undefined : result.error[0]?.span.file).toBe("site/content/pages/talks.md");
  });
});

describe("pages in a section", () => {
  const files = {
    "pages/docs/index.md": "---\ntitle: Docs\n---\n",
    "pages/docs/a.md": "---\ntitle: A\norder: 1\n---\n",
    "pages/docs/b.md": "---\ntitle: B\norder: 2\n---\n",
    "pages/now.md": "---\ntitle: Now\n---\n",
  };
  const routeOf = (url: string) => graphOf(files).routes.find((route) => route.url === url);

  it("know the pages before and after them as a reader goes through the section", () => {
    const route = routeOf("/docs/a/");
    expect(route?.kind === "page" && [route.previous?.url, route.next?.url]).toEqual([
      "/docs/",
      "/docs/b/",
    ]);
    const last = routeOf("/docs/b/");
    expect(last?.kind === "page" && [last.previous?.url, last.next?.url]).toEqual([
      "/docs/a/",
      undefined,
    ]);
  });

  it("leaves a page outside a section with no section and no neighbours", () => {
    expect(routeOf("/now/")).toMatchObject({
      kind: "page",
      section: undefined,
      previous: undefined,
      next: undefined,
    });
  });

  it("refuses a folder of pages at the address of a list the site makes", () => {
    const withPost = {
      "pages/blog/index.md": "---\ntitle: Blog\n---\n",
      "blog/hello.md": post("2026-11-17"),
    };
    expect(graphProblems(withPost)).toMatchObject([
      {
        code: CoreCodes.reservedUrl,
        message: '/blog/ is the list of posts, so "content/pages/blog/index.md" can\'t use it',
      },
    ]);
  });
});
