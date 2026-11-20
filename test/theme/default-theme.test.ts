// The default theme, checked on a site with every type of content and every Markdown feature: every
// page must be valid HTML, accessible, and free of problems, and the theme must stay small.
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { HtmlValidate } from "html-validate";
import { afterAll, describe, expect, it } from "vitest";
import { readSiteFolder } from "../../src/cli/index.ts";
import { type BuiltSite, type ThemeSettings, buildSite } from "../../src/core/index.ts";
import { NodeFileSystem } from "../../src/ports/index.ts";
import { languageOf, nextScheme, shownScheme } from "../../themes/default/assets/theme.js";

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
  "content/blog/2026-11-18-again.md": post("Again", "2026-11-18", "Again.\n"),
  "content/blog/2026-11-19-third.md": post("Third", "2026-11-19", "Third.\n"),
  "content/projects/gensane.md":
    "---\ntitle: Gensane\ndescription: A site generator\nstack: [TypeScript]\nrepo: https://github.com/babaygt/gensane\nstatus: active\nfeatured: true\nlinks:\n  - name: Docs\n    url: https://example.com/docs\n---\nBuilt by hand.\n",
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

async function build(theme: ThemeSettings = {}, drafts = false): Promise<BuiltSite> {
  const read = await readSiteFolder(new NodeFileSystem(), site, defaultTheme);
  const built = buildSite({
    config: {
      site: { title: "Ada's notes", url: "https://example.com", description: "Notes" },
      perPage: 2,
      theme,
      drafts,
    },
    content: read.content,
    templates: read.templates,
    publicFiles: read.publicFiles,
    themeAssets: read.themeAssets.map(({ path }) => path),
  });
  if (!built.ok) throw new Error(built.error.map(({ message }) => message).join("\n"));
  return built.value;
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
    const validator = new HtmlValidate({
      extends: ["html-validate:recommended"],
      rules: {
        // The Markdown compiler writes void elements as `<br />`, as CommonMark does.
        "void-style": "off",
        // A theme can't know how long a site's own text is.
        "long-title": "off",
        // Task lists are written as `checked="" disabled=""`, as GitHub's Markdown writes them.
        "attribute-boolean-style": "off",
      },
    });

    it.each(pagesOf(built).map(({ path, content }) => [path, content]))(
      "%s is valid HTML",
      async (_, html) => {
        const report = await validator.validateString(html);
        const messages = report.results.flatMap((result) =>
          result.messages.map((message) => `${message.ruleId}: ${message.message}`),
        );
        expect(messages).toEqual([]);
      },
    );

    it.each(pagesOf(built).map(({ path, content }) => [path, content]))(
      "%s is accessible",
      (_, html) => {
        expect(accessibilityProblems(html)).toEqual([]);
      },
    );
  });

  it("stays small: less than 10 KB of CSS and 3 KB of JavaScript", async () => {
    const assets = join(defaultTheme, "assets");
    expect((await stat(join(assets, "style.css"))).size).toBeLessThan(10 * 1024);
    expect((await stat(join(assets, "theme.js"))).size).toBeLessThan(3 * 1024);
  });

  it("uses only the custom properties that the settings file writes", async () => {
    const css = await readFile(join(defaultTheme, "assets", "style.css"), "utf8");
    const used = new Set([...css.matchAll(/var\(--([a-z-]+)\)/g)].map(([, name]) => name));
    const settings = pageOf(await build(), "assets/settings.css");
    const written = new Set([...settings.matchAll(/--([a-z-]+):/g)].map(([, name]) => name));
    expect([...used].filter((name) => !written.has(name))).toEqual([]);
  });
});

describe("the theme settings", () => {
  it("lays the blog out as a list or a grid, with covers only in the grid", async () => {
    expect(pageOf(await build(), "blog/index.html")).toContain('<ul class="posts posts-list">');
    const grid = pageOf(await build({ blog: { layout: "grid" } }), "blog/page/2/index.html");
    expect(grid).toContain('<ul class="posts posts-grid">');
    expect(grid).toContain('<img class="cover" src="/images/diagram.png"');
  });

  it("puts the parts of the home page in the order of the settings, and leaves out the others", async () => {
    const home = pageOf(
      await build({ home: { sections: ["talks", "recent-posts"] } }),
      "index.html",
    );
    expect(home.indexOf("<h2>Talks</h2>")).toBeLessThan(home.indexOf("<h2>Recent posts</h2>"));
    expect(home).not.toContain("<h2>Projects</h2>");
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
    expect(pageOf(await build(), "index.html")).toContain('class="scheme-switch"');
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

  it("marks the page the menu is on", async () => {
    expect(pageOf(await build(), "talks/index.html")).toContain(
      '<a href="/talks/" aria-current="page">Talks</a>',
    );
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

/**
 * A small check of what an HTML validator can't judge: one main heading, headings in order, the
 * landmarks a screen reader jumps between, text for every link and image, and a working skip link.
 */
function accessibilityProblems(html: string): string[] {
  const problems: string[] = [];
  const withoutCode = html.replaceAll(/<pre[\s\S]*?<\/pre>/g, "");
  const levels = [...withoutCode.matchAll(/<h([1-6])\b/g)].map(([, level]) => Number(level));
  if (levels.filter((level) => level === 1).length !== 1)
    problems.push(`${levels.filter((level) => level === 1).length} main headings`);
  levels.forEach((level, index) => {
    const before = levels[index - 1];
    if (before !== undefined && level > before + 1) problems.push(`h${level} after h${before}`);
  });
  for (const landmark of ["<header", "<main", "<footer"]) {
    if (!html.includes(landmark)) problems.push(`no ${landmark}>`);
  }
  if (!/<html lang="[a-z-]+">/.test(html)) problems.push("no language");
  for (const [image] of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(image)) problems.push(`no alt: ${image}`);
  }
  for (const [, text] of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
    if (
      (text ?? "").replaceAll(/<[^>]+>/g, "").trim() === "" &&
      !/<img\b[^>]*alt="[^"]+"/.test(text ?? "")
    ) {
      problems.push("a link without text");
    }
  }
  if (!html.includes('href="#content"') || !html.includes('id="content"'))
    problems.push("no skip link to the content");
  return problems;
}
