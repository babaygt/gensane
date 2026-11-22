# Content

Each Markdown file in the content folder becomes an entry. Its folder decides its type of content, its frontmatter is checked against the
[rules for that type](../frontmatter/content-types.md), its body becomes HTML, and its file name decides its URL. This is done by
[`loadContent`](../../src/core/content/load-content.ts).

## Folders

| Folder         | Type         | URL                       |
| -------------- | ------------ | ------------------------- |
| `index.md`     | `page`       | `/`                       |
| `blog/`        | `post`       | `/blog/<slug>/`           |
| `projects/`    | `project`    | `/projects/<slug>/`       |
| `pages/`       | `page`       | `/<slug>/`, or `/<folders>/<slug>/` in folders |
| `talks/`       | `talk`       | None, they are listed     |
| `experience/`  | `experience` | None, they are listed     |
| `education/`   | `education`  | None, they are listed     |

Folders inside these folders are allowed, so `blog/2026/hello.md` is a post. Only for pages do the folders become part of the URL:
`pages/docs/guides/search.md` is at `/docs/guides/search/`, and a folder's `index.md` is the folder's own page, so
`pages/docs/index.md` is at `/docs/`. Such folders make a [section](site.md#sections), such as documentation. A folder's name must be
fit for a URL, like a slug, or it is a [problem](diagnostics.md#gs418). Any other folder is a [problem](diagnostics.md), and a file
that isn't Markdown, such as an image, is left out with a warning, because images belong in the `public` folder.

## URLs

A URL is a folder with an `index.html`, so `/blog/hello/` is written to `blog/hello/index.html`. The last part of the URL, the _slug_,
comes from the file name. A date at the start of the file name is left out, so files can be named to sort by date in an editor:

<!-- builds -->
```markdown blog/2026-11-17-Hello_World!.md
---
title: Hello
date: 2026-11-17
---
```

```text files
404.html
assets/settings.css
blog/hello-world/index.html
blog/index.html
index.html
search-index.json
search/index.html
```

A slug only has lowercase letters, digits and single dashes, so it works in any address. Accents are removed, so `Über uns` becomes
`uber-uns`, and other characters become dashes.

A `slug:` field sets the slug instead. It must already be a valid slug, because it was written on purpose, and the hint shows the valid
form:

<!-- builds -->
```markdown blog/2026-11-17-a.md
---
title: Hello
date: 2026-11-17
slug: my-first-post
---
```

```text files
404.html
assets/settings.css
blog/index.html
blog/my-first-post/index.html
index.html
search-index.json
search/index.html
```

Two files that end up at the same URL are an error, reported at the second one in the order of their paths.

## The body

The body is compiled by the [Markdown compiler](../markdown-compiler/README.md), with the Markdown settings of the config. Warnings
about it point at the right line of the file, below the frontmatter.

**Excerpt.** Everything before a `<!-- more -->` line, or else the first paragraph. List pages often show it.

**Reading time.** The words of the text divided by 200, rounded up, and at least 1 minute. Tags and attributes aren't counted.

**Table of contents.** The headings of the body, nested by level, with the ids that links can point at.

<!-- builds -->
```markdown blog/a.md
---
title: Notes
date: 2026-11-17
---
This is the excerpt.

<!-- more -->

## Details

The rest.
```

```jinja post.html
{{ page.excerpt }}{{ page.readingTime }} min{% for item in page.toc %} #{{ item.id }}{% endfor %}
```

```html blog/a/index.html
<p>This is the excerpt.</p>
1 min #details
```

## Drafts

`draft: true` on a post, a page or a project leaves it out of the site: out of every list, every page, the feed and the sitemap. With
`drafts: true` in the config, for a preview, drafts are built like other content, but they still never appear in the feed, the sitemap or the search index.

<!-- builds -->
```markdown blog/a.md
---
title: Soon
date: 2026-11-17
draft: true
---
```

```text files
404.html
assets/settings.css
index.html
```

A date in the future doesn't hide a post; there is no scheduling.
