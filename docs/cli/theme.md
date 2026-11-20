# The default theme

Gensane comes with one theme, so a folder with nothing but Markdown becomes a site that is readable, fast and accessible. Its look is
changed with the [`theme` settings](config.md#theme), and any part of it can be replaced by a file in the site's
[`theme/` folder](folders.md#the-theme).

## What it shows

- **Every page:** the site's title, a menu of the blog, projects, talks and about pages the site has, a switch between light and dark
  when the site follows the reader's system, and a footer with the feed.
- **Posts:** the date, the reading time, the tags, a table of contents when the post has at least 3 headings, and the previous and
  next post. Code blocks get their language as a label and a copy button.
- **Lists:** posts as a list or as cards with their cover image, projects as cards, talks and experience as timelines.
- **Drafts:** a "Draft" label, which only [`gensane dev`](dev.md) shows.

It has no web fonts and no frameworks: less than 10 KB of CSS and 3 KB of JavaScript, and every page works without JavaScript except
the switch and the copy buttons. Every page of a test site with every type of content is checked by an HTML validator, and for one main
heading, headings in order, landmarks, text for every link and image, and a skip link.

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
Built 4 pages into dist in 12 ms, with no warnings.
```

The blog page now uses the base layout of the default theme with its own list. Its colors and spacing still come from
`assets/settings.css` and `assets/style.css`, which a site can also replace in `theme/assets/`.

## The files

| File                            | What it is                                                                 |
| ------------------------------- | -------------------------------------------------------------------------- |
| `base.html`                     | The layout every page extends: head, header with the menu, main, footer    |
| `home.html`                     | The home page, in the order of `theme.home.sections`                       |
| `post.html`                     | A post                                                                     |
| `blog.html`                     | The list of posts                                                          |
| `tag.html`                      | The posts of one tag                                                       |
| `tags.html`                     | Every tag                                                                  |
| `project.html`                  | A project                                                                  |
| `projects.html`                 | The projects, as cards                                                     |
| `talks.html`                    | The talks                                                                  |
| `about.html`                    | The about page, with experience and education                              |
| `page.html`                     | Any other page                                                             |
| `404.html`                      | The page for an address that doesn't exist                                 |
| `partials/post-item.html`       | One post in a list                                                         |
| `partials/post-list.html`       | A list of posts with its pages                                             |
| `partials/project-card.html`    | One project as a card                                                      |
| `partials/tags.html`            | The tags of a post                                                         |
| `partials/toc.html`             | The table of contents of a post                                            |
| `partials/period.html`          | When a job or a study started and ended                                    |
| `assets/style.css`              | The styles, which use the custom properties of `assets/settings.css`      |
| `assets/theme.js`               | The switch between light and dark, and the label and copy button of code   |

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

A site's language is `en` unless its config has `site: { language: "de" }`, which goes into `<html lang>`.
