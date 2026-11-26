<!-- Made by scripts/skill.ts from docs/cli/config.md; change those and run pnpm skill. -->

# The config

Every setting of `gensane.config.ts`.

The settings of a site are in `gensane.config.ts` in the site folder. Every setting has a default, so a site doesn't need a config at
all. `defineConfig` only gives the editor the types of the settings, so it can complete them and show mistakes while you type.

The config can also be `gensane.config.js` or `gensane.config.mjs`, written in plain JavaScript. Only one of them may be there. Only
the default export is used.

## How it is checked

Node runs a TypeScript config by removing its types, without checking them, and a JavaScript config has no types. So gensane checks
every setting before it builds, and reports every problem at once, with "did you mean" for a misspelled setting.

A config that has been run has no line numbers, so its problems name only the file. [Problems](https://gensane.dev/docs/reference/commands/problems/) shows each of them.

Because Node only removes types, a TypeScript config can't use TypeScript that needs compiling, such as `enum`. Use a union of strings
or an object instead.

## Settings

### `site`

What every template sees as `site`. Four settings are known, with the profiles below, and any other is passed on to the templates.

| Setting       | What it is                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `title`       | The name of the site, also the title of the feed                                                   |
| `url`         | The full address, such as `https://example.com`. The [feed and the sitemap](https://gensane.dev/docs/reference/site/feeds/) need it |
| `description` | The subtitle of the feed                                                                           |
| `author`      | A name, or `{ name: "...", avatar: "/images/me.jpg" }`; the default theme shows the picture on the home page |

The default theme also shows these profiles, as icon links on the home page and in the footer. Each is text:

| Setting    | Written as                                   | Leads to                                    |
| ---------- | -------------------------------------------- | ------------------------------------------- |
| `github`   | A user name, `"ada"`                         | `https://github.com/ada`                    |
| `gitlab`   | A user name                                  | `https://gitlab.com/` and the name          |
| `codeberg` | A user name                                  | `https://codeberg.org/` and the name        |
| `mastodon` | The whole address, `"https://mastodon.social/@ada"`, since every server has its own | That address, with `rel="me"` so Mastodon can verify the site |
| `bluesky`  | A handle, `"ada.example.com"`                | `https://bsky.app/profile/` and the handle  |
| `linkedin` | The name in the address of the profile       | `https://www.linkedin.com/in/` and the name |
| `email`    | An address                                   | A `mailto:` link                            |

A setting that looks like a misspelled known one gets a warning, because the templates would never see it under the name they use.

### `perPage`

How many posts a list shows on one page; the default is 10. The others are on `/blog/page/2/` and so on.

### `markdown`

Settings of the [Markdown compiler](https://gensane.dev/docs/internals/markdown-compiler/): `rawHtml` is `"allow"` (the default) to pass HTML in Markdown
through, or `"escape"` to show it as text; `headingIds` is `false` to leave out the ids of headings; `highlight` colors code blocks at
build time.

Gensane [colors code by itself](https://gensane.dev/docs/reference/content/colors-in-code/) in the languages a blog uses most; `highlight: false` turns that off. A
`highlight` function of your own replaces it: it gets the code and the language of each code block and gives back the HTML for inside `<code>`, or `undefined`
to leave the block as it is. A highlighter such as [Shiki](https://shiki.style) fits in a few lines; this one only marks comments.

A real highlighter must escape `<`, `&` and `"` in the code itself, as Shiki does.

### `filters`

Your own [filters](https://gensane.dev/docs/reference/themes/filters/), by the name templates use. A filter gets the value before the `|` and gives back a new one.
This is why the config is code, not a data file.

### `theme`

The settings of the default theme. Every one has a default, and changes something you can see.

| Setting         | Choices                                                        | Default   |
| --------------- | -------------------------------------------------------------- | --------- |
| `palette`       | `default`, `paper`, `nord`, `solarized`, `gruvbox`, `midnight` | `default` |
| `accent`        | A color such as `"#6d5dfc"`, for links, instead of the palette's | the palette's |
| `colorScheme`   | `auto` (follow the reader's system, with a switch), `light`, `dark` | `auto` |
| `font`          | `sans`, `serif`, `mono`, all from the reader's system           | `sans`    |
| `width`         | `narrow`, `normal`, `wide`                                     | `normal`  |
| `blog.layout`   | `list`, `grid`                                                 | `list`    |
| `blog.cover`    | `true` shows a post's cover at the top of its page too; `false` only on its card | `true` |
| `home.sections` | `intro`, `recent-posts`, `featured-projects`, `talks`, in the order you list them | all four |
| `toc`           | `true` for a table of contents on posts with at least 3 headings, or `false` | `true` |

Every palette has a light and a dark side, and all its text colors are readable on its backgrounds. An `accent` of your own that isn't
gets a [warning](https://gensane.dev/docs/reference/commands/problems/#gs507). Colors, the font and the width are written into `assets/settings.css` as CSS custom properties,
which the theme's stylesheet uses; templates see every setting, with its default, as `theme`.

With `colorScheme: "auto"`, the file also has the dark colors, for readers whose system is dark and for the switch on the page.

### `llms`

`true` writes [`llms.txt`](https://llmstxt.org/), a list of the site's pages for AI tools such as chat assistants and coding
agents, and a Markdown copy of each page beside its HTML, at its address with `index.md` added. A tool that reads the list can then
read each page as the text it was written in, without the HTML around it. It is `false` unless a site asks for it.

The list has the site's title and description, then its pages, each [section](https://gensane.dev/docs/reference/site/pages/#sections) in reading order, its
posts and its projects, each with its description. Drafts are never in it. With `site.url`, the links are full addresses.

### `nav`

The menu at the top of every page, in this order, instead of the one gensane makes. Without `nav`, the menu has the blog, the
projects, the talks and the about page, for the ones the site has; `nav` is for a menu with pages of your own, or in another order.

Each item has a `title` and a `url`:

- **A page of the site** starts with `/` and is the page's address, as in the browser: `/uses/` for `content/pages/uses.md`. `/uses`
  is read as `/uses/`. Any page works, such as `/tags/` or a page in a [section](https://gensane.dev/docs/reference/site/pages/#sections).
- **Another site** starts with `https://`, `http://` or `mailto:`. It isn't checked, as links to other sites never are.

An item is marked on its own page and on the pages below it, so "Writing" is marked on every post too. A page of the site that
doesn't exist is an error, with the closest address as a hint.

## While serving

[`gensane dev`](https://gensane.dev/docs/reference/commands/dev/) runs the config again when it changes. Files the config imports aren't run again until `gensane dev` is
restarted, because Node remembers a file once it has run it.
