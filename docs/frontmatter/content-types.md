# Content types

Each type of content has its own fields, defined in [`content-types.ts`](../../src/frontmatter/validation/content-types.ts).

| Kind of value       | What to write                                              |
| ------------------- | ---------------------------------------------------------- |
| Text                | Any text that isn't empty. A number needs quotes: `"1984"` |
| Date                | `2026-11-18`                                               |
| Year, month or date | `2018`, `2024-06` or `2024-06-15`                          |
| Date or `present`   | A year, a month, a date, or the word `present`             |
| Web address         | `https://example.com`, or `/about` for a page on this site |
| True or false       | `true` or `false`                                          |
| Whole number        | `3`                                                        |
| List of text        | `[TypeScript, Node]`                                       |

## `post`

<!-- valid post -->
```yaml
---
title: Testing a compiler
date: 2026-11-18
updated: 2026-11-20
description: What the tests changed
tags: [typescript, testing]
draft: false
cover: /images/compiler.png
---
```

| Field         | Required | Kind of value | When left out |
| ------------- | -------- | ------------- | ------------- |
| `title`       | Yes      | Text          |               |
| `slug`        | No       | Text          | File name     |
| `date`        | Yes      | Date          |               |
| `updated`     | No       | Date          | Empty         |
| `description` | No       | Text          | Empty         |
| `tags`        | No       | List of text  | No tags       |
| `draft`       | No       | True or false | `false`       |
| `cover`       | No       | Text          | Empty         |
| `coverAlt`    | No       | Text          | Empty         |
| `toc`         | No       | True or false | `true`        |

`toc: false` leaves the post without a table of contents, even when [`theme.toc`](../cli/config.md#theme) shows one on the others.

## `page`

<!-- valid page -->
```yaml
---
title: About me
description: Who I am and what I build
---
```

| Field         | Required | Kind of value | When left out |
| ------------- | -------- | ------------- | ------------- |
| `title`       | Yes      | Text          |               |
| `slug`        | No       | Text          | File name     |
| `description` | No       | Text          | Empty         |
| `draft`       | No       | True or false | `false`       |
| `toc`         | No       | True or false | `true`        |
| `order`       | No       | Whole number  | After the pages that have one, by title |

`order` places a page in its [section](../core/site.md#sections), such as a page of documentation; lower comes first. `toc: false`
leaves the page without a table of contents, as for a post.

## `project`

<!-- valid project -->
```yaml
---
title: Gensane
description: A static site generator
stack: [TypeScript, Node]
repo: https://github.com/example/gensane
website: https://example.com
links:
  - name: Documentation
    url: /docs
status: active
featured: true
cover: /images/gensane.png
order: 1
---
```

| Field         | Required | Kind of value                            | When left out |
| ------------- | -------- | ---------------------------------------- | ------------- |
| `title`       | Yes      | Text                                     |               |
| `slug`        | No       | Text                                     | File name     |
| `description` | No       | Text                                     | Empty         |
| `stack`       | No       | List of text                             | Empty list    |
| `repo`        | No       | Web address                              | Empty         |
| `website`     | No       | Web address                              | Empty         |
| `links`       | No       | List of `name` (text) and `url` (web address) | Empty list |
| `status`      | No       | `active`, `paused` or `archived`         | Empty         |
| `featured`    | No       | True or false                            | `false`       |
| `draft`       | No       | True or false                            | `false`       |
| `cover`       | No       | Text                                     | Empty         |
| `coverAlt`    | No       | Text                                     | Empty         |
| `order`       | No       | Whole number                             | Empty         |

## `talk`

<!-- valid talk -->
```yaml
---
title: Writing a Markdown compiler
event: JSConf
date: 2026-06-12
description: Lessons from the CommonMark specification
location: Berlin
slides: https://example.com/slides
video: https://example.com/video
---
```

| Field         | Required | Kind of value | When left out |
| ------------- | -------- | ------------- | ------------- |
| `title`       | Yes      | Text          |               |
| `event`       | Yes      | Text          |               |
| `date`        | Yes      | Date          |               |
| `description` | No       | Text          | Empty         |
| `location`    | No       | Text          | Empty         |
| `slides`      | No       | Web address   | Empty         |
| `video`       | No       | Web address   | Empty         |

## `experience`

<!-- valid experience -->
```yaml
---
company: Acme
role: Software Engineer
start: 2024-06
end: present
location: Berlin
note: Part-time
stack: [Go, PostgreSQL]
order: 1
---
```

| Field      | Required | Kind of value       | When left out |
| ---------- | -------- | ------------------- | ------------- |
| `company`  | Yes      | Text                |               |
| `role`     | Yes      | Text                |               |
| `start`    | Yes      | Year, month or date |               |
| `end`      | No       | Date or `present`   | `present`     |
| `location` | No       | Text                | Empty         |
| `note`     | No       | Text                | Empty         |
| `stack`    | No       | List of text        | Empty list    |
| `order`    | No       | Whole number        | Empty         |

## `education`

<!-- valid education -->
```yaml
---
school: CODE University
degree: BSc
field: Software Engineering
start: 2023-09
end: 2026-07
location: Berlin
order: 1
---
```

| Field      | Required | Kind of value       | When left out |
| ---------- | -------- | ------------------- | ------------- |
| `school`   | Yes      | Text                |               |
| `degree`   | Yes      | Text                |               |
| `field`    | No       | Text                | Empty         |
| `start`    | Yes      | Year, month or date |               |
| `end`      | No       | Date or `present`   | `present`     |
| `location` | No       | Text                | Empty         |
| `note`     | No       | Text                | Empty         |
| `order`    | No       | Whole number        | Empty         |

## Rules that apply to every type

**A field with no value counts as left out.** `description:` on its own behaves as if the line weren't there.

**Text must be text.** `title: 1984` is an error rather than a quiet conversion, and the hint shows the quotes to add.

**An end can't come before the start.** Months and days are only compared when both dates have them, so a job from `2024-06-15` to
`2024-06`, or from `2018-09` to `2018`, is allowed.

**`slug` sets the URL.** Posts, pages and projects get their URL from the file name, and `slug: my-post` replaces it. A slug can only
use lowercase letters, digits and single dashes.

**Custom fields are allowed.** Fields that the type doesn't define are kept for templates.

<!-- valid post -->
```yaml
---
title: A quiet week
date: 2026-11-18
mood: happy
---
```

**A likely typo gets a warning.** A custom field that looks like a misspelling of a field you haven't used is reported as
[GS224](diagnostics.md), with a suggestion. The file is still valid.
