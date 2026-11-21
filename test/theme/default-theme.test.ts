// The default theme, checked on a site with every type of content and every Markdown feature: every
// page must be valid HTML, accessible, and free of problems, and the theme must stay small.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { readSiteFolder, runCli } from "../../src/cli/index.ts";
import { type BuiltSite, type ThemeSettings, buildSite } from "../../src/core/index.ts";
import {
  ManualWatcher,
  MemoryTerminal,
  NodeFileSystem,
  ScriptedPrompter,
} from "../../src/ports/index.ts";
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
  "content/pages/now.md": "---\ntitle: Now\n---\nWriting.\n",
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
): Promise<BuiltSite> {
  const read = await readSiteFolder(new NodeFileSystem(), site, defaultTheme);
  const built = buildSite({
    config: {
      site: siteSettings,
      perPage: 2,
      theme,
      drafts,
      ...(today === undefined ? {} : { today }),
    },
    content: read.content,
    templates: read.templates,
    publicFiles: read.publicFiles,
    themeAssets: read.themeAssets.map(({ path }) => path),
  });
  if (!built.ok) throw new Error(built.error.map(({ message }) => message).join("\n"));
  return built.value;
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
    ] as const) {
      const source = await readFile(join(assets, file));
      expect(gzipSync(source).length).toBeLessThan(3 * 1024);
      expect(source.length).toBeLessThan(limit * 1024);
    }
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

  it("shows a table of contents on a post with at least 3 headings, unless it is turned off", async () => {
    expect(pageOf(await build(), "blog/hello/index.html")).toContain(
      '<nav class="toc" aria-label="Contents">',
    );
    expect(pageOf(await build(), "blog/again/index.html")).not.toContain('class="toc"');
    expect(pageOf(await build({ toc: false }), "blog/hello/index.html")).not.toContain(
      'class="toc"',
    );
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

  it("marks the page the menu is on", async () => {
    expect(pageOf(await build(), "talks/index.html")).toContain(
      '<a href="/talks/" aria-current="page">Talks</a>',
    );
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

  it("shows each talk with its date beside it, and buttons for its slides and video", async () => {
    const talks = pageOf(await build(), "talks/index.html");
    expect(talks).toContain('<time class="talk-date" datetime="2026-10-01">Oct 2026</time>');
    expect(talks).toContain('<a class="button" href="https://example.com/slides">Slides</a>');
    expect(talks).toContain('<a class="button" href="https://example.com/video">Video</a>');
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
