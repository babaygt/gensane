# The default theme

Gensane comes with one theme, so a folder with nothing but Markdown becomes a site that is readable, fast and accessible. Its look is
changed with the [`theme` settings](config.md#theme), and any part of it can be replaced by a file in the site's
[`theme/` folder](folders.md#the-theme).

## What it shows

- **Every page:** the site's title, a menu of the blog, projects, talks and about pages the site has, a search button, a switch
  between light and dark (a moon or a sun) when the site follows the reader's system, and a footer with the profiles, the year and
  the feed. Its icon in the browser's tab is the first letter of the title in the accent color, unless `public/` has a
  `favicon.svg`, `favicon.png` or `favicon.ico`. The scripts of [`analytics`](config.md#analytics) and the site's own
  [`head.html`](folders.md#headhtml) go at the end of the head.
- **The home page:** the author's name, picture (`site.author.avatar`) and profile links, then the parts of the settings.
- **Posts:** the date, the reading time, the tags, a table of contents when the post has at least 3 headings, and at the end the
  tags again with the older and the newer post. Code blocks get their language as a label and a copy button.
- **Pages:** a table of contents, as on posts. A page in a [section](../core/site.md#sections) shows its folder above the title,
  as a link back, and the previous and next page at the end; a folder's own page lists what is in it.
- **Lists:** posts as a list or as cards with their cover image; projects as cards with their status and links; talks with their
  date beside them and buttons for slides and video; experience as a timeline.
- **Drafts:** a "Draft" label, which only [`gensane dev`](dev.md) shows.
- **Search:** a search page that finds as you type, which the button in the header leads to (in the `wide` width the header also
  has the box itself), in the
  [search index](../core/site.md#search) the build writes. Titles count most, then tags, then descriptions, then the text, and the
  newest comes first among equally good results.

It has no web fonts and no frameworks: the CSS and each of its two scripts are less than 3 KB as readers download them. Every
page works without JavaScript except the switch, the copy buttons and search. Every page of a test site with every type of content is checked by an HTML validator, and for one main
heading, headings in order, landmarks, text for every link and image, and a skip link. In a real browser, the tests also type into search, click the switch and the copy button, check that the header stays on one line
on a computer and that cards keep their own height, and change a file to see the page reload.

## Changing one part

A file in `theme/` replaces the file with the same path, and everything else still comes from the default theme:

<!-- runs -->
```markdown content/blog/hello.md
---
title: Hello
date: 2026-11-17
---
```

```ts gensane.config.ts
export default { site: { title: "Ada's notes", url: "https://example.com" } };
```

```jinja theme/partials/post-item.html
<li><a href="{{ post.url }}">{{ post.title }}</a></li>
```

```jinja theme/blog.html
{% extends "base.html" %}
{% block content %}<ul>{% for post in pagination.items %}{% include "partials/post-item.html" %}{% endfor %}</ul>{% endblock %}
```

```console
$ gensane build
Built 5 pages into dist in 12 ms, with no warnings.
```

The blog page now uses the base layout of the default theme with its own list. Its colors and spacing still come from
`assets/settings.css` and `assets/style.css`, which a site can also replace in `theme/assets/`.

## Changing all of it

`gensane theme eject` copies every file of the default theme into `theme/`, so all of it can be changed. A file already in `theme/` is
kept as it is, and the command lists what it copied and what it kept. The copy builds exactly the same site as the default theme; after
it, updating gensane no longer changes those files, so a site that wants new versions of the theme copies again, or changes only the
parts it needs.

<!-- runs -->
```console
$ gensane theme --help
Usage: gensane theme eject [arguments]

Copy the default theme into theme/, to change all of it.

Files already in theme/ are kept as they are. After this, updating gensane doesn't change the copied files.

Arguments:
  -h, --help  Show this help
```

## The files

| File                            | What it is                                                                 |
| ------------------------------- | -------------------------------------------------------------------------- |
| `base.html`                     | The layout every page extends: head, the header with the menu, search and the light/dark switch, main, the footer |
| `home.html`                     | The home page: the author's name, picture and profiles, then the parts of `theme.home.sections` in order |
| `post.html`                     | A post, ending with its tags and the older and newer posts                 |
| `blog.html`                     | The list of posts                                                          |
| `tag.html`                      | The posts of one tag                                                       |
| `tags.html`                     | Every tag                                                                  |
| `project.html`                  | A project                                                                  |
| `projects.html`                 | The projects, as cards                                                     |
| `talks.html`                    | The talks, each with its date beside it                                    |
| `about.html`                    | The about page, with experience and education                              |
| `page.html`                     | Any other page                                                             |
| `404.html`                      | The page for an address that doesn't exist                                 |
| `search.html`                   | The search page, which finds as you type                                   |
| `partials/post-item.html`       | One post in a list                                                         |
| `partials/post-list.html`       | A list of posts with its pages                                             |
| `partials/project-card.html`    | One project as a card, with its status and links to its code and website   |
| `partials/talk.html`            | One talk, with buttons for its slides and video                            |
| `partials/profiles.html`        | Icon links to the profiles in `site`, on the home page and in the footer   |
| `partials/tags.html`            | The tags of a post                                                         |
| `partials/toc.html`             | The table of contents of a post or a page                                  |
| `partials/period.html`          | When a job or a study started and ended                                    |
| `partials/analytics.html`       | The snippets of the services in `analytics`, in the head of every page     |
| `assets/style.css`              | The styles, which use the custom properties of `assets/settings.css`      |
| `assets/theme.js`               | The switch between light and dark, and the label and copy button of code   |
| `assets/search.js`              | Search: finds the words typed in `search-index.json`                        |
| `assets/callout-note.svg`       | The icon of a note callout, used as a mask so it takes the callout's color |
| `assets/callout-tip.svg`        | The icon of a tip callout                                                  |
| `assets/callout-important.svg`  | The icon of an important callout                                           |
| `assets/callout-warning.svg`    | The icon of a warning callout                                              |
| `assets/callout-caution.svg`    | The icon of a caution callout                                              |
| `assets/icons.svg`              | The icons, which pages use with `<use href>`; the brand icons are from Simple Icons (CC0) |

## Custom properties

`assets/settings.css` is written by every build from the theme settings. A stylesheet of your own can use the same properties:

| Property       | What it is                                                     |
| -------------- | -------------------------------------------------------------- |
| `--font`       | The fonts of the reader's system for the chosen `font`         |
| `--width`      | How wide the text is                                           |
| `--background` | Behind everything                                              |
| `--surface`    | Behind code, cards and the table of contents                   |
| `--text`       | Text                                                           |
| `--muted`      | Dates, reading time and other text that matters less           |
| `--border`     | Lines                                                          |
| `--accent`     | Links and the parts that stand out                             |
| `--note`       | Note callouts                                                  |
| `--tip`        | Tip callouts                                                   |
| `--important`  | Important callouts                                             |
| `--warning`    | Warning callouts                                               |
| `--caution`    | Caution callouts                                               |

The five callout colors are the same in every palette, a little darker or lighter than GitHub's, so each is readable on the
background and the surface of every palette, light and dark.

A site's language is `en` unless its config has `site: { language: "de" }`, which goes into `<html lang>`.
