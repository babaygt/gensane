# gensane

A static site generator for developers who want a blog and portfolio online in minutes,
with nothing to learn but Markdown.

> **Status:** early development. Not published to npm yet.

## Planned

- `npx gensane init`: scaffold a site with blog, projects, talks, experience and education
- Hand-written Markdown + frontmatter compiler with compiler-style error messages
- A small template language for layouts
- Table of contents, tags, pagination, RSS, sitemap and client-side search, with no server needed
- Ready-made deploy configs for GitHub Pages, Cloudflare, Netlify and Vercel
- Zero runtime dependencies

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
  index.ts       public API
test/
  architecture/  tests that enforce module boundaries
```

Each folder in `src/` is a module with a single public entry point (`index.ts`).
Only the I/O modules (`ports`, `cli`) may use Node built-ins such as `node:fs`; every
other module is pure and works only on the data passed to it. `test/architecture`
enforces both rules.
