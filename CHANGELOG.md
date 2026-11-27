# Changelog

What changed in each version of `@gensane/cli`, newest first.

## 0.3.1

Two fixes to the bar that asks before Google Analytics counts a visit:

- **It floats a little above the bottom of the window,** as a card with rounded corners, instead of lying on its edge.
- **Allow and No thanks keep the page where it was.** They moved to the footer's **Cookie settings**, which scrolled the page to
  its end.

## 0.3.0

What moving a real personal website to gensane showed was missing.

### Changes to check when updating

- **Lists and cards show a post's `description`** when it has one, instead of its first paragraph, and the cards of a grid line
  up, each as tall as the tallest in its row.
- **A project's or a post's `cover` is also shown on its own page,** after the header, and `coverAlt` describes it.
- **A talk after the day of the build is labeled "Upcoming",** and the home page shows the soonest one next to the latest talk
  given.
- **A page in a section shows its folder above its title, and the pages before and after it** at the end; a page with 3 headings or
  more gets a table of contents, as posts do (`toc: false` turns it off).
- **`public/favicon.png` is the site's icon,** like `favicon.svg` and `favicon.ico`, instead of the first letter of the title.
- **The LinkedIn profile has LinkedIn's icon,** not a briefcase.
- **`gensane check` says which code stays plain**, once for each language (GS419).

### New

- **Analytics:** `analytics.google`, `analytics.plausible` and `analytics.cloudflare`, added to every page. With Google, each
  page asks the visitor first and loads Google only after "Allow"; **Cookie settings** in the footer takes it back
  ([the config](docs/cli/config.md#analytics)).
- **`head.html`** in the site folder is added to the end of every page's `<head>`, for anything else
  ([The site folder](docs/cli/folders.md#headhtml)).
- **A menu of your own:** `nav` in the config, with any page of the site or an address on another site; the current section is
  marked ([the config](docs/cli/config.md#nav)).
- **Colors for SQL, YAML and Dockerfile** code ([Colors in code](docs/highlight/README.md)).
- **A year alone** as the start or end of a job or a study, such as `start: 2018`, and a `note` shown next to it
  ([The about page](docs/guides/about-page.md)).
- **Task lists** (`- [ ] item`) show a checkbox without a bullet.

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
