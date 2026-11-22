# Site

[`buildSiteGraph`](../../src/core/site/site-graph.ts) works out every page of the site from its entries, and what each page shows.
Rendering then only has to follow these _routes_.

## Pages

| Kind        | URL                                   | Template        | Exists when                                      |
| ----------- | ------------------------------------- | --------------- | ------------------------------------------------ |
| `home`      | `/`                                   | `home.html`     | Always, with `index.md` if it exists             |
| `post`      | `/blog/<slug>/`                       | `post.html`     | For each post                                    |
| `blog`      | `/blog/`, `/blog/page/2/`, …          | `blog.html`     | There are posts                                  |
| `tag`       | `/tags/<tag>/`, `/tags/<tag>/page/2/` | `tag.html`      | For each tag                                     |
| `tags`      | `/tags/`                              | `tags.html`     | There are tags                                   |
| `project`   | `/projects/<slug>/`                   | `project.html`  | For each project                                 |
| `projects`  | `/projects/`                          | `projects.html` | There are projects                               |
| `talks`     | `/talks/`                             | `talks.html`    | There are talks                                  |
| `search`    | `/search/`                            | `search.html`   | There are posts, projects, talks or pages        |
| `about`     | `/about/`                             | `about.html`    | There is experience, education or `pages/about.md` |
| `page`      | `/<slug>/`                            | `page.html`     | For each page                                    |
| `not-found` | `/404.html`                           | `404.html`      | Always                                           |

A list only has a page when it has something to list, so a site without talks has no `/talks/`. `pages/about.md` becomes the introduction
of the about page instead of a page of its own. A theme only needs the templates for the pages its site has; a missing one is a
[problem](diagnostics.md) that names the first page needing it.

<!-- builds -->
```markdown index.md
---
title: Welcome
---
```

```markdown pages/about.md
---
title: About me
---
```

```markdown experience/acme.md
---
company: Acme
role: Engineer
start: 2024-06
---
```

```markdown pages/now.md
---
title: Now
---
```

```text files
404.html
about/index.html
assets/settings.css
index.html
now/index.html
search-index.json
search/index.html
```

A page can't take a URL that the site needs, such as `pages/blog.md` on a site with posts. Without posts, `/blog/` is free for it.

## Lists

Each list has a fixed order, and every order ends with something unique, so a site always builds the same way.

| List         | Order                                                              |
| ------------ | ------------------------------------------------------------------ |
| Posts        | Newest first, then by time of day, then by URL                     |
| Projects     | `featured` first, then by `order`, then by title without caring about capital letters |
| Talks        | Newest first                                                       |
| Experience   | By `order`, then the newest start first                            |
| Education    | By `order`, then the newest start first                            |
| Pages        | By URL                                                             |
| Tags         | By name, without caring about capital letters                      |

An entry with an `order` comes before entries without one. A month, such as a `start` of `2024-06`, comes before the days in it.

## Pagination

A list of posts shows `perPage` posts on each page, 10 unless the config says otherwise. The first page is the list itself, and the others
follow it:

<!-- builds -->
```markdown blog/a.md
---
title: A
date: 2026-01-01
---
```

```markdown blog/b.md
---
title: B
date: 2026-01-02
---
```

```markdown blog/c.md
---
title: C
date: 2026-01-03
---
```

```jinja blog.html
{% for post in pagination.items %}{{ post.title }} {% endfor %}| {{ pagination.current }} of {{ pagination.total }}
```

```json config
{ "perPage": 2 }
```

```html blog/index.html
C B | 1 of 2
```

```html blog/page/2/index.html
A | 2 of 2
```

## Tags

Each tag gets a page at `/tags/<tag>/`, with its posts newest first, split into pages the same way. The URL part is made like a slug, so
`Type Script` is at `/tags/type-script/`.

Two spellings that give the same URL, such as `TypeScript` and `typescript`, are one tag. It is listed under the spelling most posts use,
and a warning names the other spelling. A tag with nothing to use in a URL, such as `日本`, is an error.

## Previous and next

Each post knows the post before it in time, `previous`, and the one after it, `next`. The oldest post has no `previous` and the newest
has no `next`. A page in a [section](site.md#sections) knows the pages before and after it in the section.

## Sections

Pages in a folder of `pages/` make a section, such as documentation: `pages/docs/` is the section `docs`, its subfolders are its parts,
and each folder's `index.md` is the folder's own page. Its pages are in the order of their [`order`](../frontmatter/content-types.md#page)
field, lower first, and then by title; a folder takes its place and its title from its `index.md`, or else its name.
[`sectionsOf`](../../src/core/site/sections.ts) works out each section's tree.

A page in a section gets three more [template variables](templates.md): `section`, the tree a sidebar shows, with the current page and
the folders it is in marked; `breadcrumbs`, the folders above it; and `previous` and `next`, the pages before and after it as a reader
goes through the section, each folder's own page first.

<!-- builds -->
```markdown pages/docs/index.md
---
title: Docs
---
```

```markdown pages/docs/start.md
---
title: Start
order: 1
---
```

```markdown pages/docs/guides/index.md
---
title: Guides
order: 2
---
```

```markdown pages/docs/guides/search.md
---
title: Search
---
```

```jinja page.html
{% for crumb in breadcrumbs %}{{ crumb.title }} / {% endfor %}{{ page.title }}
{% for item in section.items %}{% if item.current %}[{{ item.title }}]{% else %}{{ item.title }}{% endif %}{% if item.open %} (open){% endif %}{% if not loop.last %}, {% endif %}{% endfor %}
{% if previous %}← {{ previous.title }}{% endif %}{% if next %} | {{ next.title }} →{% endif %}
```

```html docs/guides/search/index.html
Docs / Guides / Search
Start, Guides (open)
← Guides
```

```html docs/start/index.html
Docs / Start
[Start], Guides
← Docs | Guides →
```

The default theme is made for blogs and portfolios, so it shows the pages of a section as plain pages. A layout for documentation is a
few templates of a site's own: gensane.dev's documentation, in the repository's `website/theme/`, is one, with a sidebar, breadcrumbs
and the previous and next page.

## Sites under a path

A site can be served under a path, such as a project site on GitHub Pages at `https://ada.github.io/notes/`. Then every link that
starts at the root needs `/notes` in front of it. Authors and themes still write `/about/`: once every page is built and its links are
checked, [`withBasePath`](../../src/core/build/base-path.ts) adds the path of `site.url` to every `href`, `src` and `srcset` address
that starts with one `/`. Nothing else in the page changes, and the links in the content of the feed get the path too.

<!-- builds -->
```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
Read [about me](/about/).
```

```markdown pages/about.md
---
title: About
---
```

```jinja post.html
<a href="/">Home</a>
{{ page.html }}
```

```json config
{ "site": { "url": "https://ada.github.io/notes" } }
```

```html blog/hello/index.html
<a href="/notes/">Home</a>
<p>Read <a href="/notes/about/">about me</a>.</p>
```

Addresses to other sites, relative addresses and links to a part of the same page are left as they are. `servedAtRoot: true` leaves
every link as it is written, which `gensane dev` uses because it serves the site at `/`. Files copied as they are, such as CSS, are not
changed, so a theme's CSS should use addresses relative to itself.

## Search

A site with posts, projects, talks or pages also gets `search-index.json`, which the search page of a theme looks words up in, so search
needs no server. Each post, project, talk and page that isn't a draft has its title, address, description, tags (a project's stack),
date, and the words of its text. A talk leads to the list of talks. Drafts are never in it, not even when drafts are shown.

The words are cut by [`wordsOf`](../../src/core/search/words.ts): lowercase, without accents, at least 2 letters or digits, each once,
so `Über` is found as `uber`. The default theme's script cuts the words typed in the same way, and a test checks that both always
agree.

