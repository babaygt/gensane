// The default theme, checked on a site with every type of content and every Markdown feature: every
// page must be valid HTML, accessible, and free of problems, and the theme must stay small.
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { readSiteFolder, runCli } from "../../src/cli/index.ts";
import { checkConfig } from "../../src/config/index.ts";
import {
  type BuiltSite,
  type SiteConfig,
  type ThemeSettings,
  buildSite,
} from "../../src/core/index.ts";
import {
  ManualWatcher,
  MemoryTerminal,
  NodeFileSystem,
  ScriptedPrompter,
} from "../../src/ports/index.ts";
import {
  domainsOf,
  googleCookies,
  googleScript,
  startOf,
} from "../../themes/default/assets/consent.js";
import { languageOf, nextScheme, shownScheme } from "../../themes/default/assets/theme.js";
import { accessibilityProblems, htmlProblems } from "../support/page-checks.ts";

const defaultTheme = join(import.meta.dirname, "..", "..", "themes", "default");

const post = (title: string, date: string, body: string, extra = "") =>
  `---\ntitle: ${title}\ndate: ${date}\ndescription: About ${title}\ntags: [testing, compilers]\n${extra}---\n${body}`;

const LONG_POST = `Intro paragraph.

<!-- more -->

## Why

Text with a footnote[^1] and \`code\`.

## How

\`\`\`ts
const answer = 42;
\`\`\`

> [!NOTE]
> A callout.

### Details

| A | B |
| - | - |
| 1 | 2 |

## Done

- [x] Task
- [ ] Next

![A diagram](/images/diagram.png)

[^1]: The footnote.
`;

const files: Record<string, string> = {
  "gensane.config.mjs":
    'export default { site: { title: "Ada\'s notes", url: "https://example.com", description: "Notes" }, perPage: 2 };\n',
  "content/index.md": "---\ntitle: Welcome\n---\nI write about **testing**.\n",
  "content/blog/2026-11-17-hello.md": post(
    "Hello",
    "2026-11-17",
    LONG_POST,
    "cover: /images/diagram.png\n",
  ),
  // Two headings, one fewer than a table of contents needs.
  "content/blog/2026-11-18-again.md": post(
    "Again",
    "2026-11-18",
    "## One\n\nText.\n\n## Two\n\nText.\n",
  ),
  "content/blog/2026-11-19-third.md": post("Third", "2026-11-19", "Third.\n"),
  "content/projects/gensane.md":
    "---\ntitle: Gensane\ndescription: A site generator\nstack: [TypeScript]\nrepo: https://github.com/babaygt/gensane\nwebsite: https://gensane.dev\nstatus: active\nfeatured: true\nlinks:\n  - name: Docs\n    url: https://example.com/docs\n---\nBuilt by hand.\n",
  "content/projects/other.md": "---\ntitle: Other\n---\n",
  "content/talks/compilers.md":
    "---\ntitle: Compilers\nevent: A meetup\ndate: 2026-10-01\nlocation: Berlin\nslides: https://example.com/slides\nvideo: https://example.com/video\n---\n",
  "content/experience/acme.md":
    "---\ncompany: Acme\nrole: Engineer\nstart: 2024-01\nlocation: Berlin\nstack: [TypeScript]\n---\n",
  "content/education/school.md":
    "---\nschool: A school\ndegree: BSc\nfield: Computer science\nstart: 2020-10\nend: 2023-09\n---\n",
  "content/pages/about.md": "---\ntitle: About\n---\nHello, I am Ada.\n",
  // A heading "Content" gets the id "content", which must not clash with an id of the theme.
  "content/pages/now.md": "---\ntitle: Now\n---\nWriting.\n\n## Content\n\nWhat I write.\n",
  "content/pages/docs/index.md": "---\ntitle: Docs\n---\nAbout the docs.\n",
  "content/pages/docs/start.md":
    "---\ntitle: Start\norder: 1\n---\n## One\n\nText.\n\n## Two\n\nText.\n\n## Three\n\nText.\n",
  "content/pages/docs/guides/index.md": "---\ntitle: Guides\norder: 2\n---\nHow to.\n",
  "content/pages/docs/guides/search.md": "---\ntitle: Search guide\n---\nFind things.\n",
  "content/pages/docs/reference/cli/init.md": "---\ntitle: init\n---\nThe init command.\n",
  "public/images/diagram.png": "not really a picture",
};

// Written when the file loads, because the tests for each page are listed from the built site.
const site = await mkdtemp(join(tmpdir(), "gensane-theme-"));
for (const [path, content] of Object.entries(files)) {
  await mkdir(dirname(join(site, path)), { recursive: true });
  await writeFile(join(site, path), content);
}
afterAll(async () => {
  await rm(site, { recursive: true, force: true });
});

const SITE = { title: "Ada's notes", url: "https://example.com", description: "Notes" };

async function build(
  theme: ThemeSettings = {},
  drafts = false,
  siteSettings: Record<string, unknown> = SITE,
  today?: string,
  moreContent: Record<string, string> = {},
  nav?: SiteConfig["nav"],
): Promise<BuiltSite> {
  const read = await readSiteFolder(new NodeFileSystem(), site, defaultTheme);
  const built = buildSite({
    config: {
      site: siteSettings,
      perPage: 2,
      theme,
      drafts,
      ...(today === undefined ? {} : { today }),
      ...(nav === undefined ? {} : { nav }),
    },
    content: { ...read.content, ...moreContent },
    templates: read.templates,
    publicFiles: read.publicFiles,
    themeAssets: read.themeAssets.map(({ path }) => path),
  });
  if (!built.ok) throw new Error(built.error.map(({ message }) => message).join("\n"));
  return built.value;
}

/** A site with analytics or a head of its own; the rest as in `build`. */
async function buildWith(analytics: SiteConfig["analytics"], head?: string): Promise<BuiltSite> {
  const read = await readSiteFolder(new NodeFileSystem(), site, defaultTheme);
  const built = buildSite({
    config: { site: SITE, ...(analytics === undefined ? {} : { analytics }) },
    content: read.content,
    templates: read.templates,
    publicFiles: read.publicFiles,
    themeAssets: read.themeAssets.map(({ path }) => path),
    ...(head === undefined ? {} : { head }),
  });
  if (!built.ok) throw new Error(built.error.map(({ message }) => message).join("\n"));
  return built.value;
}

/** What is between `<head>` and `</head>`. */
function headOf(page: string): string {
  return page.slice(page.indexOf("<head>"), page.indexOf("</head>") + "</head>".length);
}

/** The footer of the home page. */
function footerOf(built: BuiltSite): string {
  const home = pageOf(built, "index.html");
  return home.slice(home.indexOf('<footer class="site-footer">'));
}

const pagesOf = (built: BuiltSite) => built.files.filter(({ path }) => path.endsWith(".html"));
const pageOf = (built: BuiltSite, path: string) =>
  built.files.find((file) => file.path === path)?.content ?? "";

describe("the default theme", () => {
  it("builds every page without a single problem", async () => {
    const built = await build();
    expect(built.warnings).toEqual([]);
    expect(pagesOf(built).map(({ path }) => path)).toEqual([
      "404.html",
      "about/index.html",
      "blog/again/index.html",
      "blog/hello/index.html",
      "blog/index.html",
      "blog/page/2/index.html",
      "blog/third/index.html",
      "docs/guides/index.html",
      "docs/guides/search/index.html",
      "docs/index.html",
      "docs/reference/cli/init/index.html",
      "docs/start/index.html",
      "index.html",
      "now/index.html",
      "projects/gensane/index.html",
      "projects/index.html",
      "projects/other/index.html",
      "search/index.html",
      "tags/compilers/index.html",
      "tags/compilers/page/2/index.html",
      "tags/index.html",
      "tags/testing/index.html",
      "tags/testing/page/2/index.html",
      "talks/index.html",
    ]);
  });

  describe("every page", async () => {
    const built = await build();

    it.each(pagesOf(built).map(({ path, content }) => [path, content]))(
      "%s is valid HTML",
      async (_, html) => {
        expect(await htmlProblems(html)).toEqual([]);
      },
    );

    it.each(pagesOf(built).map(({ path, content }) => [path, content]))(
      "%s is accessible",
      (_, html) => {
        expect(accessibilityProblems(html)).toEqual([]);
      },
    );

    const grid = await build({ blog: { layout: "grid" } });
    it.each(pagesOf(grid).map(({ path, content }) => [path, content]))(
      "%s is valid and accessible with the blog as cards, which show cover images",
      async (_, html) => {
        expect(await htmlProblems(html)).toEqual([]);
        expect(accessibilityProblems(html)).toEqual([]);
      },
    );
  });

  it("stays small: less than 3 KB for the CSS and for each script as readers download them", async () => {
    const assets = join(defaultTheme, "assets");
    // Hosts send them compressed; the uncompressed file also has a limit, so it can't grow unseen.
    for (const [file, limit] of [
      ["style.css", 12],
      ["theme.js", 4],
      ["search.js", 4],
      ["consent.css", 2],
      ["consent.js", 5],
    ] as const) {
      const source = await readFile(join(assets, file));
      expect(gzipSync(source).length).toBeLessThan(3 * 1024);
      expect(source.length).toBeLessThan(limit * 1024);
    }
  });

  it("points only at files the theme has, from its stylesheet", async () => {
    const css = await readFile(join(defaultTheme, "assets", "style.css"), "utf8");
    const pointedAt = [...css.matchAll(/url\(([^)]+)\)/g)].map(([, file]) => file ?? "");
    expect(pointedAt.length).toBeGreaterThan(4);
    for (const file of pointedAt)
      await expect(stat(join(defaultTheme, "assets", file))).resolves.toBeTruthy();
  });

  it("uses only the custom properties that the settings file or the stylesheet itself write", async () => {
    const css = await readFile(join(defaultTheme, "assets", "style.css"), "utf8");
    const used = new Set([...css.matchAll(/var\(--([a-z-]+)/g)].map(([, name]) => name));
    const settings = pageOf(await build(), "assets/settings.css");
    const written = new Set(
      [...`${settings}\n${css}`.matchAll(/--([a-z-]+):/g)].map(([, name]) => name),
    );
    expect([...used].filter((name) => !written.has(name))).toEqual([]);
  });
});

describe("the theme settings", () => {
  it("lays the blog out as a list or a grid, with covers only in the grid", async () => {
    const list = pageOf(await build(), "blog/page/2/index.html");
    expect(list).toContain('<ul class="posts posts-list">');
    expect(list).not.toContain('class="cover"');
    const grid = pageOf(await build({ blog: { layout: "grid" } }), "blog/page/2/index.html");
    expect(grid).toContain('<ul class="posts posts-grid">');
    expect(grid).toContain('<img class="cover" src="/images/diagram.png"');
  });

  it("puts the parts of the home page in the order of the settings, and leaves out the others", async () => {
    const home = pageOf(
      await build({ home: { sections: ["talks", "recent-posts"] } }),
      "index.html",
    );
    const heading = (title: string) => home.indexOf(`<h2 class="section-title">${title}</h2>`);
    expect(heading("Talks")).toBeGreaterThan(-1);
    expect(heading("Talks")).toBeLessThan(heading("Recent posts"));
    expect(heading("Projects")).toBe(-1);
    expect(home).not.toContain("I write about");
  });

  it("shows a table of contents on a post or a page with at least 3 headings, unless it is turned off", async () => {
    const built = await build();
    for (const path of ["blog/hello/index.html", "docs/start/index.html"])
      expect(pageOf(built, path)).toContain('<nav class="toc" aria-label="Contents">');
    for (const path of ["blog/again/index.html", "now/index.html"])
      expect(pageOf(built, path)).not.toContain('class="toc"');
    const off = await build({ toc: false });
    for (const path of ["blog/hello/index.html", "docs/start/index.html"])
      expect(pageOf(off, path)).not.toContain('class="toc"');
  });

  it("leaves out the table of contents of a post or a page whose frontmatter says toc: false", async () => {
    const headings = "## One\n\n## Two\n\n## Three\n";
    const built = await build({}, false, SITE, undefined, {
      "blog/2026-11-20-short.md": post("Short", "2026-11-20", headings, "toc: false\n"),
      "pages/uses.md": `---\ntitle: Uses\ntoc: false\n---\n${headings}`,
    });
    expect(pageOf(built, "blog/short/index.html")).not.toContain('class="toc"');
    expect(pageOf(built, "uses/index.html")).not.toContain('class="toc"');
  });

  it("uses the font of the settings", async () => {
    expect(pageOf(await build({ font: "serif" }), "index.html")).toContain(
      '<body class="font-serif">',
    );
  });

  it("has the switch between light and dark only when the site follows the reader's system", async () => {
    expect(pageOf(await build(), "index.html")).toContain('class="icon-button scheme-switch"');
    expect(pageOf(await build({ colorScheme: "dark" }), "index.html")).not.toContain(
      "scheme-switch",
    );
    expect(pageOf(await build({ colorScheme: "dark" }), "index.html")).not.toContain(
      "localStorage",
    );
  });

  it("labels drafts, which only gensane dev shows", async () => {
    await writeFile(
      join(site, "content/blog/2026-11-20-soon.md"),
      post("Soon", "2026-11-20", "Soon.\n", "draft: true\n"),
    );
    try {
      expect(pageOf(await build({}, true), "blog/soon/index.html")).toContain(
        '<span class="draft">Draft</span>',
      );
    } finally {
      await rm(join(site, "content/blog/2026-11-20-soon.md"));
    }
  });

  it("links a project to its website, its code and its other links", async () => {
    const project = pageOf(await build(), "projects/gensane/index.html");
    expect(project).toContain('<li><a href="https://gensane.dev">Website</a></li>');
    expect(project).toContain('<li><a href="https://github.com/babaygt/gensane">Code</a></li>');
    expect(project).toContain('<li><a href="https://example.com/docs">Docs</a></li>');
  });

  it("has a search box in the header that leads to the search page, but not on the search page itself", async () => {
    const built = await build();
    expect(pageOf(built, "blog/index.html")).toContain(
      '<form class="site-search" action="/search/" role="search">',
    );
    const searchPage = pageOf(built, "search/index.html");
    expect(searchPage).not.toContain('class="site-search"');
    expect(searchPage).toContain('<form class="search-form" action="/search/" role="search">');
    expect(searchPage).toContain('<script type="module" src="/assets/search.js"></script>');
  });

  it.each(["list", "grid"] as const)(
    "shows a post's description in the %s of posts, or its first paragraph when it has none",
    async (layout) => {
      const built = await build({ blog: { layout } }, false, SITE, undefined, {
        "blog/2026-11-20-plain.md": "---\ntitle: Plain\ndate: 2026-11-20\n---\nFirst.\n\nSecond.\n",
      });
      const list = pageOf(built, "blog/index.html");
      expect(list).toContain('<div class="excerpt"><p>First.</p>');
      expect(list).not.toContain("Second.");
      expect(list).toContain('<div class="excerpt"><p>About Third</p></div>');
      expect(list).not.toContain("<p>Third.</p>");
    },
  );

  it("marks the page the menu is on", async () => {
    expect(pageOf(await build(), "talks/index.html")).toContain(
      '<a href="/talks/" aria-current="page">Talks</a>',
    );
  });

  it("marks the blog in the menu on a post too", async () => {
    expect(pageOf(await build(), "blog/hello/index.html")).toContain(
      '<a href="/blog/" aria-current="true">Blog</a>',
    );
  });

  it("shows the menu of the config, and still leads from the home page to every list", async () => {
    const nav = [
      { title: "Writing", url: "/blog/" },
      { title: "Now", url: "/now/" },
      { title: "GitHub", url: "https://github.com/babaygt" },
    ];
    const home = pageOf(await build({}, false, SITE, undefined, {}, nav), "index.html");
    const menu = home.slice(home.indexOf('<nav class="site-menu"'), home.indexOf("</nav>"));
    expect(
      [...menu.matchAll(/<a href="([^"]+)">([^<]+)</g)].map(([, url, title]) => `${title} ${url}`),
    ).toEqual(["Writing /blog/", "Now /now/", "GitHub https://github.com/babaygt"]);
    expect(home).toContain('<p class="more"><a href="/blog/">All posts →</a></p>');
    expect(home).toContain('<p class="more"><a href="/projects/">All projects →</a></p>');
    expect(home).toContain('<p class="more"><a href="/talks/">All talks →</a></p>');
    expect(await htmlProblems(home)).toEqual([]);
  });
});

describe("the parts of a page", () => {
  const profiles = {
    github: "ada",
    gitlab: "ada-gl",
    codeberg: "ada-cb",
    mastodon: "https://mastodon.social/@ada",
    bluesky: "ada.example.com",
    linkedin: "ada-l",
    email: "ada@example.com",
  };

  it("links to every profile in the config, on the home page and in the footer", async () => {
    const home = pageOf(await build({}, false, { ...SITE, ...profiles }), "index.html");
    for (const link of [
      '<a href="https://github.com/ada" aria-label="GitHub">',
      '<a href="https://gitlab.com/ada-gl" aria-label="GitLab">',
      '<a href="https://codeberg.org/ada-cb" aria-label="Codeberg">',
      '<a href="https://mastodon.social/@ada" rel="me" aria-label="Mastodon">',
      '<a href="https://bsky.app/profile/ada.example.com" aria-label="Bluesky">',
      '<a href="https://www.linkedin.com/in/ada-l" aria-label="LinkedIn">',
      '<a href="mailto:ada@example.com" aria-label="Email">',
    ]) {
      expect(home.split(link)).toHaveLength(3);
    }
  });

  it("has no list of profiles when the config has none", async () => {
    expect(pageOf(await build(), "index.html")).not.toContain('class="profiles"');
  });

  it("starts the home page with the author's name and picture, and the site's description", async () => {
    const author = { name: "Ada", avatar: "/images/diagram.png" };
    const home = pageOf(await build({}, false, { ...SITE, author }), "index.html");
    expect(home).toContain(
      '<section class="hero">\n<img class="avatar" src="/images/diagram.png" alt="" width="96" height="96">\n<h1>Ada</h1>\n<p class="lead">Notes</p>',
    );
  });

  it.each([
    [{ ...SITE, author: "Ada Lovelace" }, "<h1>Ada Lovelace</h1>"],
    [SITE, "<h1>Ada&#39;s notes</h1>"],
  ])("names the home page after the author, or else the site", async (settings, heading) => {
    const home = pageOf(await build({}, false, settings), "index.html");
    expect(home).toContain(heading);
    expect(home).not.toContain('class="avatar"');
  });

  it("shows a project's status, and links to its code and website", async () => {
    const card = pageOf(await build(), "projects/index.html");
    expect(card).toContain('<span class="status status-active">Active</span>');
    expect(card).toContain(
      '<a href="https://github.com/babaygt/gensane" aria-label="Code of Gensane">',
    );
    expect(card).toContain('<a href="https://gensane.dev" aria-label="Website of Gensane">');
  });

  it("shows a year alone as the year, and a note after the dates and the place", async () => {
    const built = await build({}, false, SITE, undefined, {
      "education/old.md":
        "---\nschool: Old school\ndegree: BSc\nstart: 2018\nend: 2020\nlocation: Istanbul\nnote: Incomplete\n---\n",
      "experience/shop.md":
        "---\ncompany: Shop\nrole: Helper\nstart: 2016-06\nend: 2017\nnote: Part-time\n---\n",
    });
    const about = pageOf(built, "about/index.html");
    expect(about).toContain(
      '<p class="meta"><time datetime="2018">2018</time> – <time datetime="2020">2020</time>\n · Istanbul · Incomplete</p>',
    );
    expect(about).toContain(
      '<p class="meta"><time datetime="2016-06">Jun 2016</time> – <time datetime="2017">2017</time>\n · Part-time</p>',
    );
    expect(await htmlProblems(about)).toEqual([]);
  });

  it("shows each talk with its date beside it, and buttons for its slides and video", async () => {
    const talks = pageOf(await build(), "talks/index.html");
    expect(talks).toContain('<time class="talk-date" datetime="2026-10-01">Oct 2026</time>');
    expect(talks).toContain('<a class="button" href="https://example.com/slides">Slides</a>');
    expect(talks).toContain('<a class="button" href="https://example.com/video">Video</a>');
  });

  const talks = {
    "talks/far.md": "---\ntitle: Far ahead\nevent: A conference\ndate: 2027-06-01\n---\n",
    "talks/soon.md": "---\ntitle: Soon\nevent: A meetup\ndate: 2027-01-15\n---\n",
    "talks/old.md": "---\ntitle: Long ago\nevent: A meetup\ndate: 2025-05-01\n---\n",
  };

  it("labels the talks after the day of the build as upcoming", async () => {
    const page = pageOf(await build({}, false, SITE, "2026-11-25", talks), "talks/index.html");
    expect(page.split('<span class="status status-upcoming">Upcoming</span>')).toHaveLength(3);
    expect(page).toContain(
      '<h2 class="talk-title">Soon <span class="status status-upcoming">Upcoming</span></h2>',
    );
    expect(page).toContain('<h2 class="talk-title">Compilers</h2>');
    expect(await htmlProblems(page)).toEqual([]);
  });

  it("shows the next upcoming talk on the home page, then the newest past one", async () => {
    const home = pageOf(await build({}, false, SITE, "2026-11-25", talks), "index.html");
    const section = home.slice(home.indexOf('<h2 class="section-title">Talks</h2>'));
    const shown = [...section.matchAll(/<h2 class="talk-title">([^<]+)/g)].map(([, title]) =>
      title?.trim(),
    );
    expect(shown).toEqual(["Soon", "Compilers"]);
  });

  it("shows the two newest talks on the home page when none is upcoming", async () => {
    const home = pageOf(await build({}, false, SITE, "2027-12-01", talks), "index.html");
    const section = home.slice(home.indexOf('<h2 class="section-title">Talks</h2>'));
    const shown = [...section.matchAll(/<h2 class="talk-title">([^<]+)/g)].map(([, title]) =>
      title?.trim(),
    );
    expect(shown).toEqual(["Far ahead", "Soon"]);
  });

  it("shows a project's cover on its page, described by coverAlt", async () => {
    const built = await build({}, false, SITE, undefined, {
      "projects/lamp.md":
        "---\ntitle: Lamp\ncover: /images/diagram.png\ncoverAlt: A lamp on a desk\n---\nText.\n",
    });
    expect(pageOf(built, "projects/lamp/index.html")).toContain(
      '<img class="cover cover-page" src="/images/diagram.png" alt="A lamp on a desk">',
    );
  });

  it("describes a cover on the cards with coverAlt too", async () => {
    const built = await build({ blog: { layout: "grid" } }, false, SITE, undefined, {
      "projects/lamp.md":
        "---\ntitle: Lamp\ncover: /images/diagram.png\ncoverAlt: A lamp on a desk\n---\n",
      "blog/2026-11-20-cat.md":
        "---\ntitle: Cat\ndate: 2026-11-20\ncover: /images/diagram.png\ncoverAlt: A sleeping cat\n---\n",
    });
    expect(pageOf(built, "projects/index.html")).toContain(
      '<img class="cover" src="/images/diagram.png" alt="A lamp on a desk" loading="lazy">',
    );
    expect(pageOf(built, "blog/index.html")).toContain(
      '<img class="cover" src="/images/diagram.png" alt="A sleeping cat" loading="lazy">',
    );
  });

  it("shows a post's cover on its page, unless the settings keep covers on the cards", async () => {
    const shown = pageOf(await build(), "blog/hello/index.html");
    expect(shown).toContain('<img class="cover cover-page" src="/images/diagram.png" alt="">');
    expect(await htmlProblems(shown)).toEqual([]);
    expect(accessibilityProblems(shown)).toEqual([]);
    const hidden = pageOf(await build({ blog: { cover: false } }), "blog/hello/index.html");
    expect(hidden).not.toContain("cover-page");
  });

  it("ends a post with its tags, and the older and newer posts", async () => {
    const again = pageOf(await build(), "blog/again/index.html");
    const end = again.slice(again.indexOf('<footer class="post-footer">'));
    expect(end).toContain('<ul class="tags" aria-label="Tags">');
    expect(end).toContain(
      '<a class="neighbour" href="/blog/hello/" rel="prev"><span class="meta">← Older</span>Hello</a>',
    );
    expect(end).toContain(
      '<a class="neighbour neighbour-next" href="/blog/third/" rel="next"><span class="meta">Newer →</span>Third</a>',
    );
  });

  it("writes the year of the build in the footer, when it is known", async () => {
    expect(footerOf(await build({}, false, SITE, "2026-11-21"))).toContain(
      "<p>© 2026 Ada&#39;s notes · ",
    );
    expect(footerOf(await build())).toContain("<p>Ada&#39;s notes · ");
  });

  it("builds a site with no title, author or description without a warning", async () => {
    const built = await build({}, false, { url: "https://example.com" });
    expect(built.warnings).toEqual([]);
    expect(footerOf(built)).toContain('<p> · <a href="/feed.xml">Feed</a> · Made with');
  });

  it("has a search button and a switch with a sun and a moon in the header", async () => {
    const home = pageOf(await build(), "index.html");
    const header = home.slice(
      home.indexOf('<header class="site-header">'),
      home.indexOf("</header>"),
    );
    expect(header).toContain('<button class="icon-button" type="submit" aria-label="Search">');
    expect(header).toContain('<use href="/assets/icons.svg#moon"></use>');
    expect(header).toContain('<use href="/assets/icons.svg#sun"></use>');
  });

  it("has every icon the templates use in its icon file", async () => {
    const used = new Set<string>();
    for (const file of ["base.html", "partials/profiles.html", "partials/project-card.html"]) {
      const text = await readFile(join(defaultTheme, file), "utf8");
      for (const [, name] of text.matchAll(/icons\.svg#([a-z]+)/g)) used.add(name ?? "");
    }
    const icons = await readFile(join(defaultTheme, "assets", "icons.svg"), "utf8");
    const symbols = [...icons.matchAll(/<symbol id="([a-z]+)"/g)].map(([, name]) => name);
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter((name) => !symbols.includes(name))).toEqual([]);
  });
});

/** What a page shows before its title. */
function aboveTitle(page: string): string {
  return page.slice(page.indexOf("<article"), page.indexOf("<h1"));
}

/** What a page shows after its text. */
function afterText(page: string): string {
  return page.slice(page.lastIndexOf("</div>\n", page.indexOf("</article>")));
}

describe("analytics and the site's own head", () => {
  const ANALYTICS = {
    google: "G-ABC123DEF4",
    plausible: "pa-AbC123",
    cloudflare: "0123456789abcdef0123456789abcdef",
    consent: false,
  };

  it("adds the snippet of each service to the head of every page", async () => {
    const built = await buildWith(ANALYTICS);
    for (const { content } of pagesOf(built)) {
      const head = headOf(content);
      expect(head).toContain(
        '<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4"></script>\n<script data-id="G-ABC123DEF4">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",document.currentScript.dataset.id);</script>',
      );
      expect(head).toContain('<script async src="https://plausible.io/js/pa-AbC123.js"></script>');
      expect(head).toContain("plausible.init()</script>");
      expect(head).toContain(
        `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "0123456789abcdef0123456789abcdef"}'></script>`,
      );
    }
  });

  it("adds only the services the config names, and none without analytics", async () => {
    const home = headOf(pageOf(await buildWith({ plausible: "pa-AbC123" }), "index.html"));
    expect(home).toContain("plausible.io");
    expect(home).not.toContain("googletagmanager");
    expect(home).not.toContain("cloudflareinsights");
    const plain = headOf(pageOf(await buildWith(undefined), "index.html"));
    expect(plain).not.toMatch(/googletagmanager|plausible|cloudflareinsights/);
    expect(plain).toMatch(/<script type="module" src="\/assets\/theme.js"><\/script>\n<\/head>/);
  });

  it("keeps a page valid with every service", async () => {
    expect(await htmlProblems(pageOf(await buildWith(ANALYTICS), "index.html"))).toEqual([]);
  });

  it("escapes an ID that isn't one, so it can't end its attribute", async () => {
    const id = `G-1"><script>alert(1)</script>`;
    const head = headOf(
      pageOf(await buildWith({ google: id, cloudflare: id, consent: false }), "index.html"),
    );
    expect(head).not.toContain("<script>alert(1)");
    expect(head).toContain('data-id="G-1&quot;&gt;&lt;script&gt;');
    const asking = pageOf(await buildWith({ google: id }), "index.html");
    expect(asking).not.toContain("<script>alert(1)");
    expect(asking).toContain('data-google="G-1&quot;&gt;&lt;script&gt;');
  });

  it("adds the site's own head.html at the end of the head of every page, as it is", async () => {
    const own = '<meta name="google-site-verification" content="abc">\n';
    const built = await buildWith(ANALYTICS, own);
    for (const { content } of pagesOf(built))
      expect(headOf(content)).toMatch(
        /cloudflareinsights[^\n]*\n<meta name="google-site-verification" content="abc">\n<\/head>$/,
      );
  });
});

describe("asking before Google Analytics counts a visit", () => {
  it("loads only the bar's script and styles by default, not Google's, on every page", async () => {
    const built = await buildWith({ google: "G-ABC123DEF4" });
    for (const { content } of pagesOf(built)) {
      expect(content).not.toContain("googletagmanager");
      expect(headOf(content)).toContain(
        '<link rel="stylesheet" href="/assets/consent.css">\n<script type="module" src="/assets/consent.js"></script>\n</head>',
      );
      expect(content).toMatch(
        /<\/footer>\n<section class="consent" aria-label="Cookies" data-google="G-ABC123DEF4" hidden>\n[^]*<\/section>\n<\/body>/,
      );
    }
  });

  it("asks with two buttons that look the same, and adds Cookie settings to the footer, hidden until the script runs", async () => {
    const home = pageOf(await buildWith({ google: "G-ABC123DEF4" }), "index.html");
    expect(home).toContain(
      '<p class="consent-choices"><button type="button" data-consent="yes">Allow</button> <button type="button" data-consent="no">No thanks</button></p>',
    );
    expect(footerOf(await buildWith({ google: "G-ABC123DEF4" }))).toContain(
      '<span hidden> · <button class="consent-settings" type="button">Cookie settings</button></span></p>',
    );
  });

  it("keeps a page valid and accessible with the bar", async () => {
    const home = pageOf(await buildWith({ google: "G-ABC123DEF4" }), "index.html");
    expect(await htmlProblems(home)).toEqual([]);
    expect(accessibilityProblems(home)).toEqual([]);
  });

  it("doesn't ask with consent: false, or for Plausible and Cloudflare, which set no cookies", async () => {
    for (const analytics of [
      { google: "G-ABC123DEF4", consent: false },
      { plausible: "pa-AbC123", cloudflare: "0123456789abcdef0123456789abcdef" },
    ]) {
      const home = pageOf(await buildWith(analytics), "index.html");
      expect(home).not.toMatch(/consent|Cookie settings/);
    }
  });

  it("keeps the snippets of Plausible and Cloudflare as they are next to the bar", async () => {
    const head = headOf(
      pageOf(await buildWith({ google: "G-ABC123DEF4", plausible: "pa-AbC123" }), "index.html"),
    );
    expect(head).toContain('<script async src="https://plausible.io/js/pa-AbC123.js"></script>');
    expect(head).toContain('src="/assets/consent.js"');
  });

  it.each([
    ["yes", "load"],
    ["no", "leave"],
    [null, "ask"],
    ["maybe", "ask"],
  ] as const)("does this with a choice kept as %j: %s", (kept, does) => {
    expect(startOf(kept)).toBe(does);
  });

  it("keeps an ID that isn't one from adding anything to the address of Google's script", () => {
    expect(googleScript("G-ABC123DEF4")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4",
    );
    expect(googleScript("G-1&l=evil#x")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-1%26l%3Devil%23x",
    );
  });

  it("finds Google's cookies among the others", () => {
    expect(
      googleCookies("theme=dark; _ga=GA1.1.2; _ga_ABC123=GS1; _gid=GA1; _gat=1; x_ga=1"),
    ).toEqual(["_ga", "_ga_ABC123", "_gid"]);
    expect(googleCookies("")).toEqual([]);
  });

  it("knows each domain a cookie of the host may be set for", () => {
    expect(domainsOf("www.example.co")).toEqual(["www.example.co", "example.co"]);
    expect(domainsOf("example.com")).toEqual(["example.com"]);
    expect(domainsOf("localhost")).toEqual([]);
  });
});

describe("pages in folders", () => {
  it("show the folder they are in above their title, as a link back", async () => {
    const built = await build();
    expect(aboveTitle(pageOf(built, "docs/start/index.html"))).toContain(
      '<p class="meta"><a href="/docs/">Docs</a></p>',
    );
    expect(aboveTitle(pageOf(built, "docs/guides/search/index.html"))).toContain(
      '<a href="/docs/guides/">Guides</a>',
    );
    expect(aboveTitle(pageOf(built, "docs/guides/index.html"))).toContain(
      '<a href="/docs/">Docs</a>',
    );
  });

  it("show the folder without a link when it has no page of its own", async () => {
    const above = aboveTitle(pageOf(await build(), "docs/reference/cli/init/index.html"));
    expect(above).toContain('<p class="meta">Cli</p>');
    expect(above).not.toContain("<a ");
  });

  it("show nothing above the title of a section's own page, or of a page in no folder", async () => {
    const built = await build();
    for (const path of ["docs/index.html", "now/index.html"])
      expect(aboveTitle(pageOf(built, path))).toBe("<article>\n");
  });

  it("end with the pages before and after them in the section", async () => {
    const built = await build();
    const start = afterText(pageOf(built, "docs/start/index.html"));
    expect(start).toContain('<nav class="neighbours" aria-label="More pages">');
    expect(start).toContain(
      '<a class="neighbour" href="/docs/" rel="prev"><span class="meta">← Previous</span>Docs</a>',
    );
    expect(start).toContain(
      '<a class="neighbour neighbour-next" href="/docs/guides/" rel="next"><span class="meta">Next →</span>Guides</a>',
    );
    const first = afterText(pageOf(built, "docs/index.html"));
    expect(first).not.toContain('rel="prev"');
    expect(first).toContain('rel="next"');
    expect(pageOf(built, "now/index.html")).not.toContain('class="neighbours"');
  });

  it("list what is in a folder on the folder's own page, after its text", async () => {
    const built = await build();
    const docs = afterText(pageOf(built, "docs/index.html"));
    expect(docs).toContain('<h2><a href="/docs/start/">Start</a></h2>');
    expect(docs).toContain('<h2><a href="/docs/guides/">Guides</a></h2>');
    // A folder with no page of its own can't be opened, so what is in it is listed under it.
    expect(docs).toContain("<h2>Reference</h2>\n<ul>\n<li>Cli</li>");
    // A folder with a page of its own lists what is in it there, not here.
    expect(docs).toContain('<h2><a href="/docs/guides/">Guides</a></h2>\n</li>');
    expect(docs.indexOf("Start</a>")).toBeLessThan(docs.indexOf("Guides</a>"));
    // Start is only in the links to the pages before and after.
    const guides = afterText(pageOf(built, "docs/guides/index.html")).split(
      '<nav class="neighbours"',
    )[0];
    expect(guides).toContain('<h2><a href="/docs/guides/search/">Search guide</a></h2>');
    expect(guides).not.toContain("Start</a>");
    for (const path of ["docs/start/index.html", "now/index.html"])
      expect(afterText(pageOf(built, path))).not.toContain('<ul class="posts">');
  });

  it("link to the pages in a folder that has no page of its own, and list nothing for a folder with nothing in it", async () => {
    const built = await build({}, false, SITE, undefined, {
      "pages/notes/index.md": "---\ntitle: Notes\n---\n",
      "pages/notes/old/first.md": "---\ntitle: First\n---\n",
      "pages/empty/index.md": "---\ntitle: Empty\n---\nNothing yet.\n",
    });
    expect(afterText(pageOf(built, "notes/index.html"))).toContain(
      '<h2>Old</h2>\n<ul>\n<li><a href="/notes/old/first/">First</a></li>',
    );
    expect(afterText(pageOf(built, "empty/index.html"))).not.toContain("<ul");
  });

  it("show the description of what a folder lists", async () => {
    const built = await build({}, false, SITE, undefined, {
      "pages/notes/index.md": "---\ntitle: Notes\n---\n",
      "pages/notes/reading.md": "---\ntitle: Reading list\ndescription: Books I liked\n---\n",
    });
    expect(afterText(pageOf(built, "notes/index.html"))).toContain(
      '<h2><a href="/notes/reading/">Reading list</a></h2>\n<p class="meta">Books I liked</p>',
    );
  });

  it("builds with a base.html of the site's own, which has only the blocks title and content", async () => {
    const read = await readSiteFolder(new NodeFileSystem(), site, defaultTheme);
    const ownBase =
      '<!DOCTYPE html>\n<html lang="en"><head><title>{% block title %}{% endblock %}</title></head><body><main>{% block content %}{% endblock %}</main></body></html>';
    const built = buildSite({
      config: { site: { title: "Ada's notes", url: "https://example.com" } },
      content: read.content,
      templates: { ...read.templates, "base.html": ownBase },
      publicFiles: read.publicFiles,
      themeAssets: read.themeAssets.map(({ path }) => path),
    });
    expect(built.ok ? [] : built.error.map(({ message }) => message)).toEqual([]);
  });
});

describe("an ejected theme", () => {
  it("builds exactly the same site as the default theme it was copied from", async () => {
    const before = await build();
    const code = await runCli(["theme", "eject"], {
      fileSystem: new NodeFileSystem(),
      moduleLoader: { load: async () => ({}) },
      clock: { now: () => new Date(0) },
      terminal: new MemoryTerminal(),
      watcher: new ManualWatcher(),
      prompter: new ScriptedPrompter(),
      stopped: new AbortController().signal,
      defaultTheme,
      skill: join(import.meta.dirname, "..", "..", "skills", "gensane"),
      siteFolder: site,
      version: "1.2.3",
    });
    try {
      expect(code).toBe(0);
      // Read with an empty default theme, so everything comes from the site's own theme/.
      const read = await readSiteFolder(new NodeFileSystem(), site, join(site, "no-default-theme"));
      const after = buildSite({
        config: {
          site: { title: "Ada's notes", url: "https://example.com", description: "Notes" },
          perPage: 2,
        },
        content: read.content,
        templates: read.templates,
        publicFiles: read.publicFiles,
        themeAssets: read.themeAssets.map(({ path }) => path),
      });
      expect(after.ok && after.value).toEqual(before);
      expect(read.themeAssets.map(({ path }) => path)).toEqual([
        "assets/callout-caution.svg",
        "assets/callout-important.svg",
        "assets/callout-note.svg",
        "assets/callout-tip.svg",
        "assets/callout-warning.svg",
        "assets/consent.css",
        "assets/consent.js",
        "assets/icons.svg",
        "assets/search.js",
        "assets/style.css",
        "assets/theme.js",
      ]);
    } finally {
      await rm(join(site, "theme"), { recursive: true, force: true });
    }
  });
});

describe("the profiles", () => {
  const partial = readFileSync(join(defaultTheme, "partials", "profiles.html"), "utf8");
  const names = [
    ...new Set([...partial.matchAll(/site\.([a-z]+)/g)].map(([, name]) => name ?? "")),
  ];

  it("are read from the partial", () => {
    expect(names.length).toBeGreaterThan(5);
  });

  // The config checks the profiles the theme shows, so a misspelled one gets a warning instead of a missing icon.
  it.each(names)("site.%s is a profile the config knows", (name) => {
    const result = checkConfig({ site: { [name]: 5 } }, "gensane.config.ts");
    expect(result.ok ? [] : result.error.map(({ message }) => message)).toEqual([
      `"site.${name}" must be text, but 5 is a number`,
    ]);
  });
});

describe("the theme's script", () => {
  it.each([
    ["light", "dark"],
    ["dark", "light"],
  ] as const)("switches from %s to %s", (shown, next) => {
    expect(nextScheme(shown)).toBe(next);
  });

  it.each([
    [undefined, false, "light"],
    [undefined, true, "dark"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["purple", true, "dark"],
  ] as const)("shows %s when the system is dark: %s, as %s", (chosen, systemIsDark, shown) => {
    expect(shownScheme(chosen, systemIsDark)).toBe(shown);
  });

  it.each([
    ["language-ts", "ts"],
    ["hljs language-shell", "shell"],
    ["language-c++ other", "c++"],
    ["", undefined],
    ["notlanguage-ts", undefined],
  ])("finds the language of %j: %s", (className, language) => {
    expect(languageOf(className)).toBe(language);
  });
});
