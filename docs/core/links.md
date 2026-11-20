# Links

Once every page is rendered without errors, [`checkLinks`](../../src/core/links/check-links.ts) checks that every link and image leads
somewhere. A link that leads nowhere is an error, because a reader would find it before the author.

## What a link can lead to

- A page the site writes. `/blog/hello` also leads to `/blog/hello/`, as on most web servers.
- `feed.xml` and `sitemap.xml`.
- A file in the `public` folder, which is copied as it is.
- A file of the theme's `assets/` folder, such as `/assets/style.css`.

Links to other sites, such as `https://…`, `mailto:` and `//…`, aren't checked.

<!-- builds -->
```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
See [about](/about/), [the feed](/feed.xml), my [photo](/images/me.png) and [another site](https://example.org/).
```

```markdown pages/about.md
---
title: About
---
```

```json config
{ "site": { "url": "https://example.com" } }
```

```text public
images/me.png
```

```text files
404.html
about/index.html
assets/settings.css
blog/hello/index.html
blog/index.html
feed.xml
index.html
sitemap.xml
```

## Where links come from

**Content.** Every link and image in the body, and the `cover` field. A relative link starts from the page it is on, so `../other/` on
`/blog/hello/` leads to `/blog/other/`. Talks, experience and education have no page of their own, so only their links that start with
`/` are checked. A problem points at the first place the link is written in the file.

**Templates.** Links that are written out in full, such as `<a href="/about/">`, are checked at their exact place in the template, even in
templates that no page uses. So are the stylesheets, scripts and media a template loads, in `<link>`, `<script>` and `<source>`. Links built with `{{ }}`, such as `{{ post.url }}`, come from the pages themselves.

**Drafts.** A link to a draft that isn't published is broken, and the hint says it is a draft. The links inside such a draft aren't checked.

## Parts of a page

A link with a `#`, such as `#details` or `/blog/hello/#details`, must lead to an element with that `id` in the final HTML of the page.
Headings get their ids from the Markdown compiler, and templates can add their own. A missing part is a warning, because the page itself
exists:

<!-- reports GS414 -->
```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
Read the [details](#detials).

## Details
```

```jinja post.html
{{ page.html }}
```

```text
content/blog/hello.md, line 5, column 20: "#detials" leads to /blog/hello/, which has no element with the id "detials"
hint: did you mean "#details"?
```

Files from the `public` folder are copied as they are, so the parts of them aren't checked.

## The public folder

A file in the `public` folder can't have the same path as a file the site writes, such as `public/feed.xml`, because one would replace the
other.
