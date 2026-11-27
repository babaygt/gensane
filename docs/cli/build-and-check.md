# build and check

`gensane build` builds the site and writes it into `dist/`. `gensane check` does exactly the same work but writes nothing, so it can
run in CI on every change and stop a broken site from being published.

<!-- runs -->
```markdown content/blog/hello.md
---
title: Hello
date: 2026-11-17
---
Hi
```

```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```text public/images/me.png
not really a picture
```

```console
$ gensane check
Checked 5 pages in 11 ms, with no warnings.
```

```console
$ gensane build
Built 5 pages into dist in 12 ms, with no warnings.
```

```text files dist
404.html
assets/callout-caution.svg
assets/callout-important.svg
assets/callout-note.svg
assets/callout-tip.svg
assets/callout-warning.svg
assets/consent.css
assets/consent.js
assets/icons.svg
assets/search.js
assets/settings.css
assets/style.css
assets/theme.js
blog/hello/index.html
blog/index.html
feed.xml
images/me.png
index.html
search-index.json
search/index.html
sitemap.xml
```

The line at the end counts pages, the `.html` files; the feed, the sitemap and the copied files aren't counted.

## Code gensane doesn't color

`gensane check` also says when code is in a language gensane [doesn't color](../highlight/README.md), once for each language, at
its first block. `gensane build` doesn't: the site is fine, and a site may use such a language on purpose.

<!-- runs -->
```markdown content/blog/phoenix.md
---
title: Phoenix
date: 2026-11-17
---
~~~elixir
IO.puts("hello")
~~~
```

```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```console
$ gensane check
warning[GS419]: gensane doesn't color code in "elixir" (1 block; this is the first)
  ┌─ content/blog/phoenix.md:5:1
  │
5 │ ~~~elixir
  │ ^^^^^^^^^
  │
  = hint: color it with your own markdown.highlight in the config, or write "text" after the backticks

Checked 5 pages in 11 ms, with 1 warning.
```

Code written as `text`, `txt`, `plain`, `plaintext`, `console` or `mermaid` is meant to stay plain, so it isn't mentioned.

## When the site has errors

Every problem in every file is printed, with its line of source and a mark under the mistake, and nothing is written. The exit code is
1, so a script or CI stops there.

<!-- runs -->
```markdown content/blog/hello.md
---
title: Hello
date: 2026-11-17
---
See [about](/abuot/).
```

```markdown content/pages/about.md
---
title: About
---
```

```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```console
$ gensane build
error[GS413]: "/abuot/" doesn't lead to a page or a file of the site
  ┌─ content/blog/hello.md:5:13
  │
5 │ See [about](/abuot/).
  │             ^^^^^^^
  │
  = hint: did you mean "/about/"?

Found 1 error and 0 warnings, so nothing was written.
$ echo $?
1
```

Warnings are printed the same way, but the site is still built and the exit code stays 0. [Problems](problems.md) explains the
format.

## Drafts

A post or a project with `draft: true` is left out of the site, its lists, the feed and the sitemap. `--drafts` builds them too, to
look at them before they are published.

<!-- runs -->
```markdown content/blog/soon.md
---
title: Soon
date: 2026-11-18
draft: true
---
```

```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```console
$ gensane build
Built 2 pages into dist in 8 ms, with no warnings.
```

```console
$ gensane build --drafts
Built 5 pages into dist in 9 ms, with no warnings.
```

```text files dist
404.html
assets/callout-caution.svg
assets/callout-important.svg
assets/callout-note.svg
assets/callout-tip.svg
assets/callout-warning.svg
assets/consent.css
assets/consent.js
assets/icons.svg
assets/search.js
assets/settings.css
assets/style.css
assets/theme.js
blog/index.html
blog/soon/index.html
index.html
search-index.json
search/index.html
sitemap.xml
```

Even with `--drafts`, drafts never appear in the feed, the sitemap or the search index, so the sitemap only has the home page here,
there is no feed, and search finds nothing.

## Another output folder

`--out` writes the site somewhere else in the site folder. The folder is [checked first](folders.md#where-the-site-is-written),
because it is emptied before the site is written.

<!-- runs -->
```markdown content/index.md
---
title: Welcome
---
```

```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```console
$ gensane build --out public_html
Built 2 pages into public_html in 8 ms, with no warnings.
```

```text files public_html
404.html
assets/callout-caution.svg
assets/callout-important.svg
assets/callout-note.svg
assets/callout-tip.svg
assets/callout-warning.svg
assets/consent.css
assets/consent.js
assets/icons.svg
assets/search.js
assets/settings.css
assets/style.css
assets/theme.js
index.html
sitemap.xml
```

## A site under a path

When the site is served under a path, such as a project site on GitHub Pages, `site.url` says so, and the build adds the path to every
link that starts at the root. Content and templates keep writing `/about/`.

<!-- runs -->
```markdown content/pages/about.md
---
title: About
---
```

```jinja theme/home.html
<a href="/about/">About</a>
```

```ts gensane.config.ts
export default { site: { url: "https://ada.github.io/notes/" } };
```

```console
$ gensane build
Built 4 pages into dist in 9 ms, with no warnings.
```

```html dist/index.html
<a href="/notes/about/">About</a>
```

[`gensane dev`](dev.md) serves the site at `/` and leaves links as they are written, so a preview needs no setting.

## Arguments

<!-- runs -->
```console
$ gensane build --help
Usage: gensane build [arguments]

Build the site into dist/.

Arguments:
  --drafts        Include drafts
  --out <folder>  Write the site into this folder instead of dist/
  -h, --help      Show this help
```

<!-- runs -->
```console
$ gensane check --help
Usage: gensane check [arguments]

Check the site for problems, without writing anything.

Arguments:
  --drafts    Include drafts
  -h, --help  Show this help
```

## In CI

A workflow only needs to install the site's packages and run `gensane check`, or `gensane build` before publishing `dist/`. Both exit
with 1 when the site has errors, which fails the job.

```yaml
- run: npm ci
- run: npx gensane build
```
