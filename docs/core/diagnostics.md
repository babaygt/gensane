# Problems

Every problem has a stable code, a message, a hint and a position in a file
([`Diagnostic`](../../src/diagnostics/diagnostic.ts)). GS402, GS406, GS409, GS411, GS414 and GS417 are warnings, and the site is still built. All
the others are errors. Problems from the other modules, such as frontmatter and templates, have their own pages:
[Markdown](../markdown-compiler/diagnostics.md), [frontmatter](../frontmatter/diagnostics.md) and [templates](../template/diagnostics.md).

| Code  | Step             | Meaning                                                       |
| ----- | ---------------- | ------------------------------------------------------------- |
| GS401 | Content          | A file is in a folder with no type of content                 |
| GS402 | Content          | A file isn't Markdown, so it is left out (warning)            |
| GS403 | Content          | A `slug:` can't be used in a URL                              |
| GS404 | Content          | A file name has nothing to use in a URL                       |
| GS405 | Content          | Two files have the same URL                                   |
| GS406 | Content          | The date in a file name isn't the post's date (warning)       |
| GS407 | Site             | A page takes a URL the site needs                             |
| GS408 | Site             | A tag has nothing to use in a URL                             |
| GS409 | Site             | Two spellings of a tag are listed together (warning)          |
| GS410 | Rendering        | The theme has no template for a page                          |
| GS411 | Feed and sitemap | There is no `site.url`, so they are left out (warning)        |
| GS412 | Feed and sitemap | `site.url` isn't a full address                               |
| GS413 | Links            | A link or image leads nowhere                                 |
| GS414 | Links            | A link leads to a part of a page that doesn't exist (warning) |
| GS415 | Links            | A public file would replace a file the site writes            |
| GS416 | Links            | A file of the theme would clash with another file of the site |
| GS417 | Content          | A field has a name the build uses for something else (warning) |

## Content

### GS401

A file is in a folder that has no type of content. Each folder of the content folder is one type of content.

<!-- reports GS401 -->

```markdown notes/ideas.md
---
title: Ideas
---
```

```text
content/notes/ideas.md, line 1, column 1: there is no type of content for "notes/ideas.md"
hint: put it in one of the folders: blog, projects, talks, experience, education or pages
```

### GS402

A warning: a file in the content folder isn't Markdown, so it is left out. Images and other files belong in the `public` folder, which is copied as it is.

<!-- reports GS402 -->

```markdown blog/photo.png
not Markdown
```

```text
content/blog/photo.png, line 1, column 1: this file isn't Markdown, so it isn't part of the site
hint: put images and other files in the `public` folder
```

### GS403

A `slug:` field has characters that can't be used in a URL. It is written on purpose, so it isn't changed silently.

<!-- reports GS403 -->

```markdown blog/a.md
---
title: Hello
date: 2026-11-17
slug: "My Post"
---
```

```text
content/blog/a.md, line 4, column 7: "My Post" can't be used in a URL, which only allows lowercase letters, digits and single dashes
hint: write it as "my-post"
```

### GS404

The file name has nothing that a URL can use, after leaving out a date and characters other than a to z and 0 to 9.

<!-- reports GS404 -->

```markdown blog/日本.md
---
title: Hello
date: 2026-11-17
---
```

```text
content/blog/日本.md, line 1, column 1: the file name "日本.md" has nothing to use in a URL
hint: add a `slug:` field, such as `slug: my-post`
```

### GS405

Two files have the same URL. The second one in the order of their paths is reported.

<!-- reports GS405 -->

```markdown blog/2026-11-17-hello.md
---
title: Hello
date: 2026-11-17
---
```

```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
```

```text
content/blog/hello.md, line 1, column 1: /blog/hello/ is already the URL of "content/blog/2026-11-17-hello.md"
hint: rename one of the files, or give one of them a `slug:`
```

### GS406

A warning: the date at the start of the file name isn't the day of `date`.

<!-- reports GS406 -->

```markdown blog/2026-11-16-hello.md
---
title: Hello
date: 2026-11-17
---
```

```text
content/blog/2026-11-16-hello.md, line 3, column 7: the file name says 2026-11-16, but "date" is 2026-11-17
hint: rename the file, or change the date
```

## Site

### GS407

A page has a URL that the site needs for one of its own pages.

<!-- reports GS407 -->

```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
```

```markdown pages/blog.md
---
title: My blog
---
```

```text
content/pages/blog.md, line 1, column 1: /blog/ is the list of posts, so "content/pages/blog.md" can't use it
hint: give the page another file name, or a `slug:`
```

### GS408

A tag has nothing that a URL can use.

<!-- reports GS408 -->

```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
tags: [日本]
---
```

```text
content/blog/hello.md, line 1, column 1: the tag "日本" has nothing to use in a URL
hint: use a tag with letters or digits from a to z or 0 to 9
```

### GS409

A warning: two spellings of a tag have the same URL, so their posts are listed together under the spelling most posts use.

<!-- reports GS409 -->

```markdown blog/a.md
---
title: Hello
date: 2026-11-17
tags: [TypeScript]
---
```

```markdown blog/b.md
---
title: Again
date: 2026-11-17
tags: [TypeScript]
---
```

```markdown blog/c.md
---
title: More
date: 2026-11-17
tags: [typescript]
---
```

```text
content/blog/c.md, line 1, column 1: the tag "typescript" is listed as "TypeScript", because both have the URL /tags/typescript/
hint: write the tag the same way in every post
```

## Rendering

### GS410

The site has a page that needs a template the theme doesn't have. It is reported once, with the first page that needs it.

<!-- reports GS410 -->

```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
```

```text without
post.html
```

```text
post.html, line 1, column 1: there is no template "post.html", which /blog/hello/ needs
hint: add post.html to the theme
```

## Feed and sitemap

### GS411

A warning: without the address of the site, the feed and the sitemap can't use full URLs, so they are left out. The config has no line numbers, so the problem points at the start of the config file.

<!-- reports GS411 -->

```markdown index.md
---
title: Welcome
---
```

```json config
{ "site": { "title": "Ada's notes" } }
```

```text
gensane.config.ts, line 1, column 1: the feed and the sitemap are left out, because they need the address of the site
hint: add `site: { url: "https://example.com" }` to the config
```

### GS412

`site.url` isn't a full address.

<!-- reports GS412 -->

```markdown index.md
---
title: Welcome
---
```

```json config
{ "site": { "url": "example.com" } }
```

```text
gensane.config.ts, line 1, column 1: "site.url" must be the full address of the site, such as "https://example.com", but it is "example.com"
hint: use an address that starts with https:// or http://, without ? or #
```

## Links

### GS413

A link or an image leads to no page and no file of the site.

<!-- reports GS413 -->

```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
See [about](/abuot/).
```

```markdown pages/about.md
---
title: About
---
```

```text
content/blog/hello.md, line 5, column 13: "/abuot/" doesn't lead to a page or a file of the site
hint: did you mean "/about/"?
```

### GS414

A warning: a link leads to a page, but the page has no element with the id after `#`.

<!-- reports GS414 -->

```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
Jump to the [end](#endd).

## End
```

```jinja post.html
{{ page.html }}
```

```text
content/blog/hello.md, line 5, column 19: "#endd" leads to /blog/hello/, which has no element with the id "endd"
hint: did you mean "#end"?
```

### GS415

A file in the `public` folder has the same path as a file the site writes, so one would replace the other.

<!-- reports GS415 -->

```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
```

```json config
{ "site": { "url": "https://example.com" } }
```

```text public
feed.xml
```

```text
public/feed.xml, line 1, column 1: "public/feed.xml" would replace the feed, which the site writes
hint: rename the file, or move it into a folder
```

### GS416

A file of the theme's `assets/` folder has the same path as a public file, or as a file the site writes, so one would replace the
other.

<!-- reports GS416 -->

```markdown index.md
---
title: Welcome
---
```

```text assets
assets/style.css
```

```text public
assets/style.css
```

```text
public/assets/style.css, line 1, column 1: "public/assets/style.css" would replace "assets/style.css" of the theme
hint: rename the file, or move it out of the theme's assets folder
```

### GS417

A warning: a field of your own has a name that templates already use for something the build works out, such as `url` for the
address of the page, so templates would never see the field. Rename it. A project's website is the field `website` for this reason.

<!-- reports GS417 -->

```markdown talks/compilers.md
---
title: Compilers
event: A meetup
date: 2026-10-01
url: https://example.com/compilers
---
```

```text
content/talks/compilers.md, line 5, column 1: templates see "url" as the address of the page, not as this field
hint: give the field another name
```

