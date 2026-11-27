# The site folder

Gensane works on the folder it runs in. The folders have fixed names, so every site looks the same:

| Path                | What it holds                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `content/`          | The [content](../core/content.md): one Markdown file for each post, project, talk and page      |
| `theme/`            | Your own changes to the theme: templates in the [template language](../template/README.md), and `assets/` |
| `public/`           | Files copied into the site as they are, such as images, a favicon or `CNAME`                   |
| `gensane.config.ts` | The [config](config.md), which is optional; `gensane.config.js` and `.mjs` work too            |
| `head.html`         | HTML of your own for the `<head>` of every page, which is optional                             |
| `dist/`             | The website, written by [`gensane build`](build-and-check.md)                                  |

## What is read

- **Content:** every file in `content/` and its folders. A file that isn't Markdown gets a [warning](../core/diagnostics.md#gs402).
- **Templates:** the `.html` files in `theme/`, named by their path inside it, so `theme/partials/nav.html` is `partials/nav.html` in
  `include`. Other files in `theme/` aren't read.
- **Public files:** every file in `public/`, copied to the same path in the site.
- **`head.html`:** read as it is, if the site has one.

Files and folders whose names start with a dot are left out of `content/` and `theme/`, because editors and the system put files such
as `.DS_Store` and `.post.md.swp` next to the real ones. In `public/` they are kept, because hosts read some of them, such as
`.nojekyll` and `.well-known/`; only `.DS_Store` is left out.

<!-- runs -->
```markdown content/blog/hello.md
---
title: Hello
date: 2026-11-17
---
```

```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```text content/blog/.hello.md.swp
an editor's backup
```

```text public/.nojekyll
```

```text public/.DS_Store
```

```console
$ gensane build
Built 5 pages into dist in 9 ms, with no warnings.
```

```text files dist
.nojekyll
404.html
assets/callout-caution.svg
assets/callout-important.svg
assets/callout-note.svg
assets/callout-tip.svg
assets/callout-warning.svg
assets/icons.svg
assets/search.js
assets/settings.css
assets/style.css
assets/theme.js
blog/hello/index.html
blog/index.html
feed.xml
index.html
search-index.json
search/index.html
sitemap.xml
```

The editor's backup isn't read, so it gives no warning that it isn't Markdown. `.nojekyll` is copied, and `.DS_Store` isn't.

## `head.html`

HTML of your own, which the default theme adds at the end of the `<head>` of every page, as it is: a service that counts visits and
that [`analytics`](config.md#analytics) doesn't know, a font, or a `<meta>` that proves to a search engine that the site is yours.

```html
<meta name="google-site-verification" content="abc123">
<link rel="stylesheet" href="/fonts/inter.css">
```

It isn't a template, so `{{` in it stays as it is, and it isn't checked. An address on the site, such as `/fonts/inter.css`, gets
the path of the site like the rest of the page. A `base.html` of the site's own prints it with `{{ head }}`.

## The theme

Gensane comes with a default theme, so a site needs no `theme/` folder at all. A file in `theme/` replaces the file with the same path
in the default theme, and everything else still comes from the default theme. So changing only the style or one template means writing
only that file.

- **Templates** are the `.html` files of the theme, named by their path inside it.
- **Assets** are the files in the theme's `assets/` folder, such as CSS, scripts and fonts. They are copied to `/assets/` in the site.

<!-- runs -->
```markdown content/index.md
---
title: Welcome
---
```

```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```css theme/assets/style.css
body { color: teal; }
```

```console
$ gensane build
Built 2 pages into dist in 8 ms, with no warnings.
```

```css dist/assets/style.css
body { color: teal; }
```

A problem in a file of the default theme names that file inside the gensane package, so it can be opened from there.

## Where the site is written

`gensane build` writes into `dist/`, and `--out` names another folder. Before it writes, it empties that folder, so a post you deleted
doesn't stay online. It writes nothing at all when the site has errors, so a broken build never leaves half a site.

Because the folder is emptied, it must be inside the site folder, and it can't be the site folder itself or hold the site's own files.
This is checked before anything is read:

<!-- runs -->
```markdown content/index.md
---
title: Welcome
---
```

```console
$ gensane build --out content
error: the output folder "content" would replace content/
hint: see gensane build --help
$ echo $?
2
```

```text files content
index.md
```
