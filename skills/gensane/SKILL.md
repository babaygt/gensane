---
name: gensane
description: Work on a website built with gensane, a static site generator for blogs and portfolios. Use when a folder has gensane.config.ts or a content/ folder with Markdown posts, projects, talks or pages, and the task is to write or change content, change the config or the theme's templates, fix a problem gensane reports (codes such as GS413), or build and publish the site.
license: MIT
metadata:
  author: Yigit Baba
  homepage: https://gensane.dev
---

# gensane

gensane turns a folder of Markdown files into a static website: a blog, a portfolio, or both. It has no plugins and no JavaScript
framework; content is Markdown with a few fields at the top, and pages are HTML templates. It checks everything it reads, and every
problem it finds has a code, a file, a line and a hint.

## The site folder

```text
gensane.config.ts     the settings: title, address, author, profiles, theme
content/
  index.md            the home page's text
  blog/               posts; a date at the start of a file name is left out of the URL
  projects/           projects
  talks/              talks (listed, no page of their own)
  experience/         jobs, shown on the about page (no page of their own)
  education/          schools, the same
  pages/              any other page; pages/about.md is /about/; folders become URL paths
public/               files copied as they are, such as pictures: public/images/me.jpg is /images/me.jpg
theme/                optional: files that replace the default theme's files with the same path
dist/                 the built site (made by the build; never edit it)
```

A file's URL comes from its name: `content/blog/2026-11-20-hello-world.md` is `/blog/hello-world/`, and
`content/pages/docs/guides/search.md` is `/docs/guides/search/`. A `slug:` field changes the last part.

## Commands

gensane is installed in the site, so run it with `npx gensane` (or the scripts in `package.json`):

| Command                          | What it does                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `npx gensane check`              | Everything a build does except writing; the quickest way to know all is well |
| `npx gensane build`              | Writes the site into `dist/`; writes nothing if there is any error            |
| `npx gensane dev`                | Serves the site at `http://localhost:4000/` and reloads on changes; drafts shown |
| `npx gensane new <type> "Title"` | Starts a content file with the fields it needs: `post`, `project`, `page`, `talk`, `experience`, `education` |
| `npx gensane deploy init <host>` | Adds the file that publishes the site: `github`, `cloudflare` or `netlify`    |
| `npx gensane theme eject`        | Copies the whole default theme into `theme/`                                  |
| `npx gensane skill add`          | Updates this skill to the installed gensane's, after an update                |

Exit codes: 0 when it worked (warnings don't change this), 1 when the site has errors, 2 when the command was written wrong.
`gensane dev` keeps running until stopped, so don't use it to check your work; use `check`.

## How to work

1. Make the change.
2. Run `npx gensane check`.
3. Fix every error and warning it prints, then run it again, until it says `with no warnings`.

Don't tell the user a change is done before `check` passes. Don't silence a problem by deleting the content it points at, unless
that is what was asked.

## Reading a problem

```text
error[GS413]: "/projects/tinycalc/" doesn't lead to a page or a file of the site
  ┌─ content/pages/about.md:4:55
  │
4 │ I work on compilers. My latest project is [tiny-calc](/projects/tinycalc/).
  │                                                       ^^^^^^^^^^^^^^^^^^^
  │
  = hint: did you mean "/projects/tiny-calc/"?
```

- The code says what kind of problem it is: GS1xx Markdown, GS2xx frontmatter, GS3xx templates, GS4xx the site, GS5xx the config.
- The path, line and column say where; the marks under the line show the exact part.
- The hint is usually the fix. "did you mean" names the closest thing that exists.
- [references/problems.md](references/problems.md) explains every code and what fixes it.

Errors stop a build; warnings don't, but fix them too: each one is something a reader would miss, such as the feed of a site
without an address (GS411), or a field of your own that templates can't see because its name, such as `url`, is taken (GS417).

## Content

Each file starts with frontmatter between `---` lines: a small, strict part of YAML. Text needs quotes when it has a colon and a
space, or a space and `#` (which starts a comment), or when it looks like a number but is text, such as `"1984"`. Dates are
`YYYY-MM-DD`; lists are `[a, b]` or one `- item` per line. A field of your own is kept for templates, but one that looks like a
misspelled field of its type gets a warning.

| Type         | Folder        | Required fields             | Often used                                                   |
| ------------ | ------------- | --------------------------- | ------------------------------------------------------------ |
| `post`       | `blog/`       | `title`, `date`             | `description`, `tags`, `draft`, `updated`, `cover`           |
| `page`       | `pages/`      | `title`                     | `description`, `draft`, `order` (in a folder)                |
| `project`    | `projects/`   | `title`                     | `description`, `stack`, `repo`, `website`, `status`, `featured`, `order` |
| `talk`       | `talks/`      | `title`, `event`, `date`    | `location`, `description`, `slides`, `video`                 |
| `experience` | `experience/` | `company`, `role`, `start`  | `end` (or none for now), `location`, `stack`                 |
| `education`  | `education/`  | `school`, `degree`, `start` | `field`, `end`, `location`                                   |

[references/content-types.md](references/content-types.md) has every field, its kind of value and its default.

A post:

```markdown
---
title: Why I write tests first
date: 2026-11-20
description: A failing test is the shortest description of what I want.
tags: [testing]
---

The body is Markdown, as GitHub writes it: tables, task lists, footnotes and callouts such as `> [!NOTE]`.
```

- `draft: true` keeps a post, page or project out of the site; `gensane dev` still shows it. `gensane new` starts posts and
  projects as drafts, so remove `draft: true` when they are ready.
- Pictures go in `public/`, and are linked from the root: `![A diagram](/images/diagram.png)`. A link or picture that leads
  nowhere is an error (GS413), so links between pages use their URLs, such as `/blog/hello-world/`.
- Headings get ids from their text, so `/blog/hello-world/#the-setup` leads to `## The setup`.

## The config

`gensane.config.ts` exports its settings with `defineConfig`: `site` for what every page shows about the site, and `theme` for
its look.

```ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: {
    title: "Ada's notes",
    url: "https://ada.dev",
    description: "Notes on compilers and testing",
    author: { name: "Ada Lovelace", avatar: "/images/ada.jpg" },
    github: "ada",
  },
  theme: { palette: "nord" },
});
```

- `site.url` is the full address; the feed and the sitemap need it (otherwise warning GS411).
- Profiles shown as icons: `github`, `gitlab`, `codeberg`, `mastodon` (the whole address), `bluesky`, `linkedin`, `email`.
- `theme`: `palette` (`default`, `paper`, `nord`, `solarized`, `gruvbox`, `midnight`), `colorScheme`, `accent`, `font`, `width`,
  `blog.layout` (`list` or `grid`), `home.sections`, `toc`.
- Other settings: `perPage`, `markdown`, `filters`, and `llms` (writes `llms.txt`).

[references/config.md](references/config.md) has every setting and its values.

## The theme

The default theme needs no templates. To change one part, copy that file from
`node_modules/@gensane/cli/themes/default/` into `theme/` with the same path, and change the copy; everything else still comes
from the default theme. `npx gensane theme eject` copies all of it, after which updates to gensane no longer change it.

Templates are HTML with `{{ value }}`, `{{ value | filter }}`, `{% if %}`, `{% for %}`, `{% include "partials/x.html" %}`,
`{% extends "base.html" %}` and `{% block %}`. A variable or filter that doesn't exist is an error with its line.
[references/templates.md](references/templates.md) lists what each page can show.

## Publishing

`npx gensane deploy init github` (or `cloudflare`, `netlify`) adds the file the host needs, and prints the steps to take there.
Every host builds with `npm run build` and publishes `dist/`.

## More

The whole documentation is at https://gensane.dev/docs/, and as plain Markdown for agents through https://gensane.dev/llms.txt:
every page is listed there, each with a Markdown version.
