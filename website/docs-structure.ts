// Where each page of the repository's `docs/` goes in gensane.dev's documentation, and in what order.
// A folder with `from` uses that page as its own; otherwise its page lists what is in it.

export interface DocsNode {
  /** The name in the address, such as `init` in `/docs/reference/commands/init/`. */
  readonly slug: string;
  /** For a page, its title instead of the first heading of its file. */
  readonly title?: string;
  /** For a folder whose page is made here, one line about it. */
  readonly description?: string;
  /** The file in `docs/`, such as `cli/init.md`. */
  readonly from?: string;
  /** A folder's pages and folders, in order. */
  readonly children?: readonly DocsNode[];
}

const page = (slug: string, from: string, title?: string): DocsNode => ({
  slug,
  from,
  ...(title === undefined ? {} : { title }),
});

/** The internals of one module: its overview, then its other pages. */
const module = (
  slug: string,
  title: string,
  folder: string,
  pages: readonly string[],
): DocsNode => ({
  slug,
  title,
  from: `${folder}/README.md`,
  children: pages.map((name) => page(name, `${folder}/${name}.md`)),
});

export const DOCS: DocsNode = {
  slug: "docs",
  title: "Documentation",
  description:
    "Everything about gensane: the commands, writing content, themes, and how it works inside.",
  children: [
    {
      slug: "reference",
      title: "Reference",
      description: "Every command, setting, field and problem, to look up.",
      children: [
        {
          slug: "commands",
          title: "Commands",
          from: "cli/README.md",
          children: [
            page("init", "cli/init.md", "init"),
            page("new", "cli/new.md", "new"),
            page("dev", "cli/dev.md", "dev"),
            page("build-and-check", "cli/build-and-check.md", "build and check"),
            page("deploy", "cli/deploy.md", "deploy"),
            page("site-folder", "cli/folders.md"),
            page("config", "cli/config.md"),
            page("problems", "cli/problems.md", "Problems of the config"),
          ],
        },
        {
          slug: "content",
          title: "Writing content",
          description:
            "The kinds of content, the settings at the top of a file, and the Markdown in it.",
          children: [
            page("content-types", "frontmatter/content-types.md"),
            page("frontmatter", "frontmatter/syntax.md", "Frontmatter"),
            page("markdown", "markdown-compiler/syntax.md", "Markdown"),
            page("colors-in-code", "highlight/README.md"),
          ],
        },
        {
          slug: "themes",
          title: "Themes and templates",
          description:
            "The default theme, and the template language for changing it or writing your own.",
          children: [
            page("default-theme", "cli/theme.md"),
            page("template-syntax", "template/syntax.md", "Template syntax"),
            page("filters", "template/filters.md"),
            page("layouts", "template/layouts.md"),
            page("template-variables", "core/templates.md", "Template variables"),
          ],
        },
        {
          slug: "site",
          title: "The site",
          description:
            "How content becomes the pages of a site, its feed, its sitemap, and the checks of its links.",
          children: [
            page("content", "core/content.md"),
            page("pages", "core/site.md", "Pages of the site"),
            page("feeds", "core/feeds.md"),
            page("links", "core/links.md"),
            page("problems", "core/diagnostics.md", "Problems of a build"),
          ],
        },
      ],
    },
    {
      slug: "internals",
      title: "Internals",
      description: "How each part of gensane is built and tested, for contributors.",
      children: [
        module("markdown-compiler", "The Markdown compiler", "markdown-compiler", [
          "architecture",
          "block-parsing",
          "inline-parsing",
          "passes",
          "diagnostics",
          "testing",
          "code-reference",
        ]),
        module("frontmatter", "The frontmatter parser", "frontmatter", [
          "architecture",
          "parsing",
          "validation",
          "diagnostics",
          "testing",
          "code-reference",
        ]),
        module("template", "The template language", "template", [
          "architecture",
          "parsing",
          "rendering",
          "diagnostics",
          "testing",
          "code-reference",
        ]),
        module("core", "The core", "core", ["architecture", "testing", "code-reference"]),
        {
          slug: "command-line",
          title: "The command line",
          description: "The commands, the dev server, and the ports to the outside.",
          children: [
            page("architecture", "cli/architecture.md"),
            page("testing", "cli/testing.md"),
            page("code-reference", "cli/code-reference.md"),
          ],
        },
      ],
    },
  ],
};
