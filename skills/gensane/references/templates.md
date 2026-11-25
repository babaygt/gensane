<!-- Made by scripts/skill.ts from docs/core/templates.md; change those and run pnpm skill. -->

# Template variables

What each template of a theme can show.

Each page is rendered with its [template](https://gensane.dev/docs/reference/site/pages/), written in the [template language](https://gensane.dev/docs/internals/template/). Every template is given
the same variables, which [`TemplateVariables`](https://github.com/babaygt/gensane/blob/main/src/core/build/page-data.ts) prepares. Every variable is always there, and empty
when there is nothing, so `{% if previous %}` works on every page.

| Variable      | On           | Holds                                                                              |
| ------------- | ------------ | ---------------------------------------------------------------------------------- |
| `site`        | Every page   | The `site` settings of the config, such as `title`, `url` and `description`         |
| `page`        | Every page   | The page itself                                                                    |
| `collections` | Every page   | `posts`, `projects`, `talks`, `experience`, `education`, `pages` and `tags`        |
| `theme`       | Every page   | The [theme settings](https://gensane.dev/docs/reference/commands/config/#theme), with every default filled in           |
| `navigation`  | Every page   | The blog, projects, talks and about pages the site has, each with `title` and `url` |
| `feed`        | Every page   | The address of the feed, `/feed.xml`, when the site has one                        |
| `search`      | Every page   | The address of the search page, `/search/`, when the site has one                  |
| `favicon`     | Every page   | The address of the site's icon: its own `favicon.svg` or `favicon.ico` in `public/`, or else one made from the first letter of `site.title` |
| `today`       | Every page   | The day of the build, as a date for the `date` filter, such as `{{ today \| date("yyyy") }}` |
| `pagination`  | List pages   | `items`, `current`, `total`, `previousUrl` and `nextUrl`                           |
| `previous`    | Posts, pages in a section | The post before this one in time, or the page before this one in its [section](https://gensane.dev/docs/reference/site/pages/#sections) |
| `next`        | Posts, pages in a section | The post after this one in time, or the page after this one in its section         |
| `section`     | Pages in a section | The section's tree: `title`, `url`, and `items`, each a page (`title`, `url`, `current`) or a folder (also `open` and `items`) |
| `breadcrumbs` | Pages in a section | The folders above the page, each with `title` and `url` (none when the folder has no `index.md`) |
| `tag`         | Tag pages    | `name`, `slug`, `url`, `count` and `posts`                                          |

## The page

For a page with a content file, `page` has every field of its [type of content](https://gensane.dev/docs/reference/content/content-types/), every custom field,
and what was worked out from its body:

| Field         | What it is                                                         |
| ------------- | ------------------------------------------------------------------ |
| `url`, `slug` | Where the page is                                                  |
| `type`        | The type of content, such as `post`                                |
| `html`        | The body as HTML, printed without escaping                         |
| `excerpt`     | The [excerpt](https://gensane.dev/docs/reference/site/content/) as HTML, printed without escaping        |
| `toc`         | The table of contents: each heading's `id`, `text`, `level` and `children` |
| `readingTime` | In minutes                                                         |
| `upcoming`    | Talks only: `true` when the talk's date is after the day of the build, `false` otherwise, and when the day isn't known |

`html` and `excerpt` come from the Markdown compiler, not from text someone typed, so `{{ page.html }}` prints them as HTML without
`| raw`. Every other value is escaped as usual.

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

The same post is the same value everywhere: in `collections.posts`, in `pagination.items` and as `page`. So a list can mark the page it is on.

## Previous and next

## Menus and the feed

A template can't write `<a href="/blog/">` for a site without posts, because [links are checked](https://gensane.dev/docs/reference/site/links/) and `/blog/` wouldn't exist.
So `navigation` lists the pages a menu leads to, only those the site has, and `feed` is the feed's address only when there is a feed.

## Templates that use each other

A theme can have more templates than the ones in the [table of pages](https://gensane.dev/docs/reference/site/pages/), such as a base layout or a partial, and use them with
`extends` and `include`. Filters from the config are available in every template.
