# Changing one part of the theme

Settings change the colors, the fonts and the layout. To change what a part of a page shows, such as the footer or a project's
card, put a file of your own in `theme/`, with the same path as the theme's. Everything else still comes from the default theme, and
still gets its updates.

## Find the file

The theme's files are in the gensane package in the site, at `node_modules/@gensane/cli/themes/default/`. [The default
theme](../cli/theme.md#the-files) lists each file and what it shows. Some examples:

| File                          | What it shows                                     |
| ----------------------------- | ------------------------------------------------- |
| `base.html`                   | The frame of every page: the header and the footer |
| `partials/project-card.html`  | One project's card                                 |
| `partials/post-item.html`     | One post in a list                                 |
| `partials/talk.html`          | One talk                                           |
| `assets/style.css`            | The stylesheet                                     |

## Copy it, then change it

Copy the file into `theme/`, keeping its path:

```sh
mkdir -p theme/partials
cp node_modules/@gensane/cli/themes/default/partials/talk.html theme/partials/talk.html
```

Then change the copy. A talk that shows only its title and its event, for example:

<!-- runs -->
```ts gensane.config.ts
export default { site: { title: "Ada's notes", url: "https://ada.dev" } };
```

```jinja theme/partials/talk.html
<li>{{ talk.title }}, at {{ talk.event }}</li>
```

```markdown content/talks/parsers-by-hand.md
---
title: Parsers by hand
event: Compiler Night
date: 2026-06-04
---
```

```console
$ gensane check
Checked 4 pages in 9 ms, with no warnings.
```

Templates are HTML with `{{ ... }}` for values and `{% ... %}` for conditions, loops and other templates. [Template
syntax](../template/syntax.md) explains the language, and [template variables](../core/templates.md) what each page can show.

## Mistakes in templates

A mistake in a template is shown with its line, as in content:

<!-- runs -->
```ts gensane.config.ts
export default { site: { title: "Ada's notes", url: "https://ada.dev" } };
```

```jinja theme/partials/talk.html
<li>{{ talk.title }, at {{ talk.event }}</li>
```

```jinja theme/talks.html
<ul>{% for talk in collections.talks %}{% include "partials/talk.html" %}{% endfor %}</ul>
```

```markdown content/talks/parsers-by-hand.md
---
title: Parsers by hand
event: Compiler Night
date: 2026-06-04
---
```

```console
$ gensane check
error[GS301]: this `{{` is never closed
  ┌─ theme/partials/talk.html:1:5
  │
1 │ <li>{{ talk.title }, at {{ talk.event }}</li>
  │     ^^
  │
  = hint: add `}}` at the end

Found 1 error and 0 warnings.
$ echo $?
1
```

## Your own styles

`theme/assets/style.css` replaces the whole stylesheet, which is more than most changes need. To add a few rules, copy `base.html`
and link a stylesheet of your own after the theme's, from `public/`:

```html
<link rel="stylesheet" href="/assets/style.css">
<link rel="stylesheet" href="/extra.css">
```

## All of it

`gensane theme eject` copies every file of the theme into `theme/`, for a site that wants to change most of it. After that, updating
gensane no longer changes those files. [The default theme](../cli/theme.md#changing-all-of-it) explains the difference.
