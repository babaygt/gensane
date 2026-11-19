# gensane

A static site generator for developers who want a blog and portfolio online in minutes,
with nothing to learn but Markdown.

> **Status:** early development. The Markdown compiler, the frontmatter parser, the template language and the core
> that joins them into a site are finished. The command line program comes next, so gensane can't build a site from a
> folder yet, and it isn't published on npm.

## What works today

Every part is written by hand, with no runtime dependencies.

A **Markdown compiler**:

- CommonMark, passing **586 of 652** official spec examples. [Every other example is explained](docs/markdown-compiler/testing.md).
- GitHub features: tables, task lists, strikethrough, footnotes and callouts.
- Heading ids and a table of contents.
- Warnings with an exact file, line and column.

Read the [Markdown compiler documentation](docs/markdown-compiler/README.md) to see how it works.

A **frontmatter parser**:

- A small, predictable part of YAML, with [clear errors for everything else](docs/frontmatter/syntax.md).
- [Rules for each type of content](docs/frontmatter/content-types.md): posts, pages, projects, talks, experience and education.
- Every problem in a file reported at once, with its exact position and a hint for fixing it.

Read the [frontmatter documentation](docs/frontmatter/README.md) to see how it works.

A **template language** for layouts:

```jinja
{% extends "base.html" %}
{% block content %}
  {% for post in posts | where("draft", false) | sort("date") | reverse | take(5) %}
    <a href="{{ post.url }}">{{ post.title }}</a> {{ post.date | date("MMM d, yyyy") }}
  {% endfor %}
{% endblock %}
```

- [Output, conditions and loops](docs/template/syntax.md), escaped by default.
- [Filters](docs/template/filters.md) for text, lists and dates, and your own.
- [Layouts](docs/template/layouts.md) that templates include and extend, checked before anything is rendered.
- A lexer, a parser and a tree-walking interpreter, with every mistake reported at once.

Read the [template language documentation](docs/template/README.md) to see how it works.

A **core** that joins them into a site:

- [Content](docs/core/content.md) becomes posts, projects, talks, experience, education and pages, with clean URLs, excerpts and reading times.
- [Every page the site needs](docs/core/site.md): lists split into pages, tags, previous and next, and an about page.
- [An Atom feed and a sitemap](docs/core/feeds.md).
- [Broken links and missing images](docs/core/links.md) stop the build, with a hint where they were written.
- The same files always give exactly the same site.

Read the [core documentation](docs/core/README.md) to see how it works.

## Planned

- `npx gensane init`: scaffold a site with blog, projects, talks, experience and education
- `gensane build` and `gensane dev`, with live reload
- Client-side search, with no server needed
- A default theme and ready-made deploy configs for GitHub Pages, Cloudflare, Netlify and Vercel

## Development

Requires Node ≥ 22.18 and pnpm.

```sh
pnpm install
pnpm test          # run tests
pnpm test:watch    # watch mode
pnpm coverage      # tests with coverage report
pnpm check         # typecheck + lint + format check + tests
pnpm build         # emit dist/
```

### Code layout

```
src/
  diagnostics/   error reporting: source spans, diagnostics, Result type
  markdown/      the Markdown compiler
    blocks/      lines to block structure
    inlines/     emphasis, links and other syntax inside text
    passes/      steps over the syntax tree
    output/      HTML and table of contents
  frontmatter/   the settings at the top of a content file
    parsing/     text to values
    validation/  the rules for each type of content
  template/      the template language for layouts
    lexing/      text to tokens
    parsing/     tokens to a syntax tree
    analysis/    checks before rendering
    rendering/   the interpreter and filters
  core/          content and templates to the files of a site
    content/     content files to entries
    site/        every page of the site
    build/       rendering each page
    feeds/       the feed and the sitemap
    links/       checking links and images
  index.ts       public API
test/
  architecture/  tests that enforce module boundaries
  conformance/   the official CommonMark spec examples
  docs/          tests that keep the documentation true
docs/            documentation
```

Each folder in `src/` is a module with a single public entry point (`index.ts`).
Only the I/O modules (`ports`, `cli`) may use Node built-ins such as `node:fs`; every
other module is pure and works only on the data passed to it. `test/architecture`
enforces both rules.
