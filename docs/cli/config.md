# The config

The settings of a site are in `gensane.config.ts` in the site folder. Every setting has a default, so a site doesn't need a config at
all. `defineConfig` only gives the editor the types of the settings, so it can complete them and show mistakes while you type.

```ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: { title: "Ada's notes", url: "https://example.com", author: "Ada" },
  perPage: 5,
});
```

The config can also be `gensane.config.js` or `gensane.config.mjs`, written in plain JavaScript. Only one of them may be there. Only
the default export is used.

## How it is checked

Node runs a TypeScript config by removing its types, without checking them, and a JavaScript config has no types. So gensane checks
every setting before it builds, and reports every problem at once, with "did you mean" for a misspelled setting:

<!-- runs -->
```js gensane.config.mjs
export default { perpage: 5, site: { title: 42 } };
```

```console
$ gensane check
error[GS504]: "perpage" is not a setting
  ┌─ gensane.config.mjs
  │
  = hint: did you mean "perPage"?

error[GS505]: "site.title" must be text, but 42 is a number
  ┌─ gensane.config.mjs
  │
  = hint: write the text in quotes

Found 2 errors and 0 warnings in the config.
$ echo $?
1
```

A config that has been run has no line numbers, so its problems name only the file. [Problems](problems.md) shows each of them.

Because Node only removes types, a TypeScript config can't use TypeScript that needs compiling, such as `enum`. Use a union of strings
or an object instead.

## Settings

### `site`

What every template sees as `site`. Four settings are known, with the profiles below, and any other is passed on to the templates.

| Setting       | What it is                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `title`       | The name of the site, also the title of the feed                                                   |
| `url`         | The full address, such as `https://example.com`. The [feed and the sitemap](../core/feeds.md) need it |
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

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: { title: "Ada's notes", url: "https://example.com", github: "ada" },
});
```

```jinja theme/home.html
<h1>{{ site.title }}</h1>
<a href="https://github.com/{{ site.github }}">GitHub</a>
```

```console
$ gensane build
Built 2 pages into dist in 8 ms, with no warnings.
```

```html dist/index.html
<h1>Ada&#39;s notes</h1>
<a href="https://github.com/ada">GitHub</a>
```

A setting that looks like a misspelled known one gets a warning, because the templates would never see it under the name they use:

<!-- runs -->
```ts gensane.config.ts
export default { site: { titel: "Ada's notes" } };
```

```console
$ gensane check
warning[GS506]: "site.titel" is not a known setting
  ┌─ gensane.config.ts
  │
  = hint: did you mean "title"? Other settings of the site are fine, for the templates

warning[GS411]: the feed and the sitemap are left out, because they need the address of the site
  ┌─ gensane.config.ts
  │
  = hint: add `site: { url: "https://example.com" }` to the config

Checked 2 pages in 7 ms, with 2 warnings.
```

### `perPage`

How many posts a list shows on one page; the default is 10. The others are on `/blog/page/2/` and so on.

<!-- runs -->
```ts gensane.config.ts
export default { perPage: 1 };
```

```markdown content/blog/first.md
---
title: First
date: 2026-11-16
---
```

```markdown content/blog/second.md
---
title: Second
date: 2026-11-17
---
```

```console
$ gensane build
warning[GS411]: the feed and the sitemap are left out, because they need the address of the site
  ┌─ gensane.config.ts
  │
  = hint: add `site: { url: "https://example.com" }` to the config

Built 7 pages into dist in 9 ms, with 1 warning.
```

```text files dist
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
blog/first/index.html
blog/index.html
blog/page/2/index.html
blog/second/index.html
index.html
search-index.json
search/index.html
```

### `markdown`

Settings of the [Markdown compiler](../markdown-compiler/README.md): `rawHtml` is `"allow"` (the default) to pass HTML in Markdown
through, or `"escape"` to show it as text; `headingIds` is `false` to leave out the ids of headings; `highlight` colors code blocks at
build time.

<!-- runs -->
```ts gensane.config.ts
export default { site: { url: "https://example.com" }, markdown: { rawHtml: "escape" } };
```

```markdown content/pages/about.md
---
title: About
---
I like <b>bold</b> ideas.
```

```jinja theme/about.html
{{ page.html }}
```

```console
$ gensane build
Built 4 pages into dist in 8 ms, with no warnings.
```

```html dist/about/index.html
<p>I like &lt;b&gt;bold&lt;/b&gt; ideas.</p>
```

Gensane [colors code by itself](../highlight/README.md) in the languages a blog uses most; `highlight: false` turns that off. A
`highlight` function of your own replaces it: it gets the code and the language of each code block and gives back the HTML for inside `<code>`, or `undefined`
to leave the block as it is. A highlighter such as [Shiki](https://shiki.style) fits in a few lines; this one only marks comments:

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: { url: "https://example.com" },
  markdown: {
    highlight: (code, language) =>
      language === "sh" ? code.replace(/^(#.*)$/m, '<span class="comment">$1</span>') : undefined,
  },
});
```

````markdown content/pages/about.md
---
title: About
---
```sh
# install
npm install --save-dev @gensane/cli
```
````

```jinja theme/about.html
{{ page.html }}
```

```console
$ gensane build
Built 4 pages into dist in 8 ms, with no warnings.
```

```html dist/about/index.html
<pre><code class="language-sh"><span class="comment"># install</span>
npm install --save-dev @gensane/cli
</code></pre>
```

A real highlighter must escape `<`, `&` and `"` in the code itself, as Shiki does.

### `filters`

Your own [filters](../template/filters.md), by the name templates use. A filter gets the value before the `|` and gives back a new one.
This is why the config is code, not a data file.

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: { url: "https://example.com" },
  filters: { shout: (value) => `${String(value).toUpperCase()}!` },
});
```

```jinja theme/home.html
<h1>{{ "hello" | shout }}</h1>
```

```console
$ gensane build
Built 2 pages into dist in 8 ms, with no warnings.
```

```html dist/index.html
<h1>HELLO!</h1>
```

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
| `home.sections` | `intro`, `recent-posts`, `featured-projects`, `talks`, in the order you list them | all four |
| `toc`           | `true` for a table of contents on posts with at least 3 headings, or `false` | `true` |

Every palette has a light and a dark side, and all its text colors are readable on its backgrounds. An `accent` of your own that isn't
gets a [warning](problems.md#gs507). Colors, the font and the width are written into `assets/settings.css` as CSS custom properties,
which the theme's stylesheet uses; templates see every setting, with its default, as `theme`.

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: { url: "https://example.com" },
  theme: { palette: "nord", colorScheme: "light", font: "serif", width: "wide" },
});
```

```jinja theme/home.html
<p>{{ theme.palette }}, {{ theme.blog.layout }}, {{ theme.home.sections | join(", ") }}</p>
```

```console
$ gensane build
Built 2 pages into dist in 8 ms, with no warnings.
```

```html dist/index.html
<p>nord, list, intro, recent-posts, featured-projects, talks</p>
```

```css dist/assets/settings.css
/* Made by gensane from the theme settings in the config. */
:root {
  color-scheme: light;
  --font: "Iowan Old Style", Charter, Georgia, serif;
  --width: 52rem;
  --background: #eceff4;
  --surface: #e5e9f0;
  --text: #2e3440;
  --muted: #4c566a;
  --border: #d8dee9;
  --accent: #3b5f8f;
  --note: #0861c9;
  --tip: #187533;
  --important: #7548c9;
  --warning: #885b00;
  --caution: #c4222c;
}
```

With `colorScheme: "auto"`, the file also has the dark colors, for readers whose system is dark and for the switch on the page.

## While serving

[`gensane dev`](dev.md) runs the config again when it changes. Files the config imports aren't run again until `gensane dev` is
restarted, because Node remembers a file once it has run it.
