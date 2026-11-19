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
index.html
now/index.html
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
has no `next`.
