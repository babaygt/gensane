# gensane

A static site generator for developers who want a blog and portfolio online in minutes,
with nothing to learn but Markdown.

> **Status:** early development. The Markdown compiler is finished, but gensane can't build a site yet and
> isn't published on npm.

## What works today

A hand-written **Markdown compiler** with no runtime dependencies:

- CommonMark, passing **586 of 652** official spec examples. [Every other example is explained](docs/markdown-compiler/testing.md).
- GitHub features: tables, task lists, strikethrough, footnotes and callouts.
- Heading ids and a table of contents.
- Warnings with an exact file, line and column.

Read the [Markdown compiler documentation](docs/markdown-compiler/README.md) to see how it works.

## Planned

- Frontmatter parser with validation for each type of content
- A small template language for layouts
- `npx gensane init`: scaffold a site with blog, projects, talks, experience and education
- Tags, pagination, RSS, sitemap and client-side search, with no server needed
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
