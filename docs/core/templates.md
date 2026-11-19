# Templates

Each page is rendered with its [template](site.md), written in the [template language](../template/README.md). Every template is given
the same variables, which [`TemplateVariables`](../../src/core/build/page-data.ts) prepares. Every variable is always there, and empty
when there is nothing, so `{% if previous %}` works on every page.

| Variable      | On           | Holds                                                                              |
| ------------- | ------------ | ---------------------------------------------------------------------------------- |
| `site`        | Every page   | The `site` settings of the config, such as `title`, `url` and `description`         |
| `page`        | Every page   | The page itself                                                                    |
| `collections` | Every page   | `posts`, `projects`, `talks`, `experience`, `education`, `pages` and `tags`        |
| `pagination`  | List pages   | `items`, `current`, `total`, `previousUrl` and `nextUrl`                           |
| `previous`    | Posts        | The post before this one in time                                                   |
| `next`        | Posts        | The post after this one in time                                                    |
| `tag`         | Tag pages    | `name`, `slug`, `url`, `count` and `posts`                                          |

## The page

For a page with a content file, `page` has every field of its [type of content](../frontmatter/content-types.md), every custom field,
and what was worked out from its body:

| Field         | What it is                                                         |
| ------------- | ------------------------------------------------------------------ |
| `url`, `slug` | Where the page is                                                  |
| `type`        | The type of content, such as `post`                                |
| `html`        | The body as HTML, printed without escaping                         |
| `excerpt`     | The [excerpt](content.md) as HTML, printed without escaping        |
| `toc`         | The table of contents: each heading's `id`, `text`, `level` and `children` |
| `readingTime` | In minutes                                                         |

`html` and `excerpt` come from the Markdown compiler, not from text someone typed, so `{{ page.html }}` prints them as HTML without
`| raw`. Every other value is escaped as usual.

<!-- builds -->
```markdown blog/hello.md
---
title: Tom & Jerry
date: 2026-11-17
mood: happy
---
Hello *world*
```

```jinja post.html
<h1>{{ page.title }}</h1>
<p>{{ page.date | date("MMM d, yyyy") }}, {{ page.mood }}</p>
{{ page.html }}
```

```html blog/hello/index.html
<h1>Tom &amp; Jerry</h1>
<p>Nov 17, 2026, happy</p>
<p>Hello <em>world</em></p>
```

## Titles

A page without a content file still has a `title` and a `url`, so a base layout can always print `<title>{{ page.title }}</title>`. A tag
page uses the name of its tag.

| Kind        | Title          |
| ----------- | -------------- |
| `home`      | Home           |
| `blog`      | Blog           |
| `tags`      | Tags           |
| `projects`  | Projects       |
| `talks`     | Talks          |
| `about`     | About          |
| `not-found` | Page not found |

The home page uses `index.md` when it exists, and the about page uses `pages/about.md`.

## Lists and the current page

The same post is the same value everywhere: in `collections.posts`, in `pagination.items` and as `page`. So a list can mark the page it is on:

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

```jinja post.html
{% for post in collections.posts %}{% if post == page %}[{{ post.title }}]{% else %}{{ post.title }}{% endif %} {% endfor %}
```

```html blog/a/index.html
B [A]
```

## Previous and next

<!-- builds -->
```markdown blog/a.md
---
title: First
date: 2026-01-01
---
```

```markdown blog/b.md
---
title: Second
date: 2026-01-02
---
```

```jinja post.html
{% if previous %}← {{ previous.title }} {% endif %}|{% if next %} {{ next.title }} →{% endif %}
```

```html blog/a/index.html
| Second →
```

```html blog/b/index.html
← First |
```

## Templates that use each other

A theme can have more templates than the ones in the [table of pages](site.md), such as a base layout or a partial, and use them with
`extends` and `include`. Filters from the config are available in every template.
