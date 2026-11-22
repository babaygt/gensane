# Contributing

Thank you for wanting to help. This page shows how to run gensane from this repository, how it is tested, and how a change is made.

## Running it

Gensane needs Node 22.18 or newer, and pnpm.

```sh
pnpm install
pnpm check         # everything CI checks: types, lint, formatting and tests
pnpm example       # builds gensane, then serves the example site at http://localhost:4000/
```

To try a change on a site of your own, build it and run its program:

```sh
pnpm build
node /path/to/gensane/dist/cli/main.js init my-site --yes
```

Other scripts:

```sh
pnpm test          # the tests
pnpm test:watch    # the tests, again after every change
pnpm coverage      # the tests, with a coverage report
pnpm build         # writes dist/
pnpm screenshots   # takes the screenshots of the README again, after the theme changes
pnpm skill         # writes the agent skill's references again, after the docs they come from change
```

The first run of the browser tests needs Chromium: `pnpm exec playwright install chromium`.

## How it is tested

Gensane is tested at every level, from pure functions to the real program in a real browser; [testing](docs/cli/testing.md) lists the
levels. A few habits keep the tests honest:

- **Tests first.** A change starts with tests that fail, because the code doesn't do it yet. Then the code makes them pass.
- **Breaking the code on purpose.** After a change, break it in small ways, one at a time (turn `<` into `<=`, remove a line), and
  run the tests. A break no test notices shows a test that is missing; write it.
- **Properties, not only examples.** Where a rule holds for every input, such as "coloring code never changes it", a property test
  with [fast-check](https://fast-check.dev) checks thousands of inputs.
- **Documentation that is run.** Every marked example in `docs/` is run by the tests, so a page can't say something gensane doesn't do.
  A change to what gensane prints changes its documentation in the same commit.

## How a change is made

- **A pull request does one thing**, with its commits in this order: the tests (failing), the change, then the tests found by
  breaking the code on purpose. Each commit is checked on its own.
- **Commit messages are plain sentences** that say what the commit does, such as "Write table alignment as a class the theme styles",
  with no prefix.
- **No runtime dependencies.** Gensane is written by hand; a tool for development or tests is fine.
- **Names and comments for a reader who is new to the code:** descriptive names, and a comment only where the code can't say why.

## Code layout

```
src/
  diagnostics/   error reporting: source spans, diagnostics, the Result type
  markdown/      the Markdown compiler
    blocks/      lines to block structure
    inlines/     emphasis, links and other syntax inside text
    passes/      steps over the syntax tree
    output/      HTML and the table of contents
  highlight/     colors in code
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
    search/      the search index
    theme/       palettes, the theme settings and the site's icon
  config/        the settings of a site, and checking them
  cli/           the command line: reading the site folder, commands, the dev server
    commands/    build, check, dev, deploy, init, new and theme
    init/        the files of a new site, and the files that publish it
    dev/         answering requests, live reload, the problems page
  ports/         the disk, the config loader, the clock, the terminal, the watcher and questions
  index.ts       the public API
themes/default/  the default theme
test/
  architecture/  the rules between modules
  conformance/   the official CommonMark examples
  docs/          the documentation, run as tests
  e2e/           the real gensane program in a temporary folder
  theme/         every page of the default theme: valid, accessible and small
  browser/       the default theme in a real browser
  example/       the example site: built with no warnings, every page checked
  package/       the package as npm publishes it, installed and used from the packed file
  support/       helpers the tests share
example/         the example site
scripts/         the screenshots of the README
docs/            the documentation
```

Each folder in `src/` is a module with one public entry point, its `index.ts`. Only `ports` and `cli` may use Node's built-in modules
such as `node:fs`; every other module is pure and works only on what it is given. `test/architecture` enforces both rules.

## Releasing

1. Raise the version in `package.json`, and the versions the documentation shows (`pnpm check` points at each one).
2. Build first, so npm finds the program when it starts: `pnpm build`.
3. `npm publish`. Before anything is uploaded, it runs `pnpm check` and builds again, so a release always passes every test.

## gensane.dev

`website/` is gensane.dev, built with gensane, with the example site under `/example/`. `pnpm website` builds it into `website/dist`.
CI publishes it on Cloudflare after every merge to `main`, once every check has passed.

## The agent skill

`skills/gensane/` is the skill that coding agents read to work on a gensane site, in the
[Agent Skills](https://agentskills.io/specification) format, and it ships in the package. `SKILL.md` is written by hand. The files in
`references/` are made from the documentation by `pnpm skill`, and a test fails while they are out of date. Tests also check that the
skill names only commands, fields, settings and problem codes that exist, and that its examples have no problems.

## Reporting a problem

Open an [issue](https://github.com/babaygt/gensane/issues) with what you ran, what gensane printed, and what you expected. A small site
folder that shows it helps most.
