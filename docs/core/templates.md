# Templates

Each page is rendered with its [template](site.md), written in the [template language](../template/README.md). Every template is given
the same variables, which [`TemplateVariables`](../../src/core/build/page-data.ts) prepares. Every variable is always there, and empty
when there is nothing, so `{% if previous %}` works on every page.

| Variable      | On           | Holds                                                                              |
| ------------- | ------------ | ---------------------------------------------------------------------------------- |
| `site`        | Every page   | The `site` settings of the config, such as `title`, `url` and `description`         |
| `page`        | Every page   | The page itself                                                                    |
| `collections` | Every page   | `posts`, `projects`, `talks`, `experience`, `education`, `pages` and `tags`        |
| `theme`       | Every page   | The [theme settings](../cli/config.md#theme), with every default filled in           |
| `navigation`  | Every page   | The menu: [`nav`](../cli/config.md#nav) from the config, or else the blog, projects, talks and about pages the site has. Each item has `title`, `url`, and `current`: `"page"` on its own page, `"true"` on the pages below it, else `false` |
| `lists`       | Every page   | The addresses of the lists the site has, whatever the menu is: `blog`, `projects` and `talks`           |
| `feed`        | Every page   | The address of the feed, `/feed.xml`, when the site has one                        |
| `search`      | Every page   | The address of the search page, `/search/`, when the site has one                  |
| `favicon`     | Every page   | The address of the site's icon: its own `favicon.svg` or `favicon.ico` in `public/`, or else one made from the first letter of `site.title` |
| `today`       | Every page   | The day of the build, as a date for the `date` filter, such as `{{ today \| date("yyyy") }}` |
| `pagination`  | List pages   | `items`, `current`, `total`, `previousUrl` and `nextUrl`                           |
| `previous`    | Posts, pages in a section | The post before this one in time, or the page before this one in its [section](site.md#sections) |
| `next`        | Posts, pages in a section | The post after this one in time, or the page after this one in its section         |
| `section`     | Pages in a section | The section's tree: `title`, `url`, and `items`, each a page (`title`, `url`, `description`, `current`) or a folder (also `open` and `items`) |
| `breadcrumbs` | Pages in a section | The folders above the page, each with `title` and `url` (none when the folder has no `index.md`) |
| `folder`      | A folder's `index.md` | The folder, as in `section`, so the page can list what is in it                   |
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
| `toc`         | The table of contents: each heading's `id`, `text`, `level` and `children`; empty with `toc: false` |
| `readingTime` | In minutes                                                         |
| `upcoming`    | Talks only: `true` when the talk's date is after the day of the build, `false` otherwise, and when the day isn't known |

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
| `search`    | Search         |
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

## Menus and the feed

A template can't write `<a href="/blog/">` for a site without posts, because [links are checked](links.md) and `/blog/` wouldn't exist.
So `navigation` lists the pages a menu leads to, only those the site has, and `feed` is the feed's address only when there is a feed.

<!-- builds -->
```markdown blog/hello.md
---
title: Hello
date: 2026-11-17
---
```

```markdown talks/compilers.md
---
title: Compilers
event: A meetup
date: 2026-10-01
---
```

```json config
{ "site": { "url": "https://example.com" } }
```

```jinja home.html
<nav>{% for item in navigation %}<a href="{{ item.url }}">{{ item.title }}</a>{% endfor %}</nav>
{% if feed %}<a href="{{ feed }}">Feed</a>{% endif %}
```

```html index.html
<nav><a href="/blog/">Blog</a><a href="/talks/">Talks</a></nav>
<a href="/feed.xml">Feed</a>
```

## Templates that use each other

A theme can have more templates than the ones in the [table of pages](site.md), such as a base layout or a partial, and use them with
`extends` and `include`. Filters from the config are available in every template.
