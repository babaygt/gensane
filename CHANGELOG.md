# Changelog

What changed in each version of `@gensane/cli`, newest first.

## 0.2.0

### Changes to check when updating

- **Pages in folders have their folders' address.** `content/pages/docs/guides/search.md` is now at `/docs/guides/search/`, not
  `/search/`, and a folder's `index.md` is the folder's own page. A page outside folders keeps its address. A folder whose name
  can't be part of an address is a problem (GS418). See [Content](docs/core/content.md#folders).
- **`gensane init` adds the agent skill** to a new site, unless the answer to its new question is no; `--yes` adds it too. It is
  two small folders, `.agents/skills/` and `.claude/skills/`, which can be deleted.
- **A misspelled profile is a warning**, such as `githb` for `github` (GS506), and every profile of `site` must be text.
- **The default theme's skip link leads to `#Main`**, not `#content`, so a heading called "Content" can't have the same id.

### New

- **Sections:** pages in folders, ordered by an `order` field, with the `section`, `breadcrumbs`, `previous` and `next` template
  variables, for a sidebar and breadcrumbs in a theme of your own ([Sections](docs/core/site.md#sections)).
- **`llms: true`** writes `llms.txt` and a Markdown copy of each page, for AI tools ([the config](docs/cli/config.md#llms)).
- **An agent skill** that teaches coding agents such as Claude Code and Codex how a gensane site works, with
  [`gensane skill add`](docs/cli/skill.md) to add it and update it ([Working with coding agents](docs/guides/coding-agents.md)).
- **`gensane dev`** serves `.md` files as Markdown.
- **Documentation** on [gensane.dev](https://gensane.dev/docs/): a start, a tutorial, and guides.

## 0.1.0

The first release: the Markdown compiler, the frontmatter parser, the template language, the default theme with six palettes,
search, the feed and the sitemap, and the commands `init`, `new`, `dev`, `build`, `check`, `deploy init` and `theme eject`.
