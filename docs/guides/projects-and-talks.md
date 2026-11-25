# Projects and talks

Projects are shown as cards, at `/projects/` and, for the ones you choose, on the home page. Each project also has a page of its
own, with its text. Talks are a list at `/talks/`, with buttons for their slides and videos.

[The example site's projects](https://gensane.dev/example/projects/) and [talks](https://gensane.dev/example/talks/) show the
result.

## A project

<!-- runs -->
```ts gensane.config.ts
export default { site: { title: "Ada's notes", url: "https://ada.dev" } };
```

```console
$ gensane new project tiny-calc
Created content/projects/tiny-calc.md
```

```markdown content/projects/tiny-calc.md
---
title: tiny-calc
draft: true
---
```

A new project is a draft, so nothing is published by accident. Give it what its card shows, and remove `draft: true`:

<!-- continues -->
```markdown content/projects/tiny-calc.md
---
title: tiny-calc
description: A calculator language in 400 lines, with a parser and an interpreter
stack: [TypeScript]
status: active
repo: https://github.com/ada/tiny-calc
website: https://tiny-calc.ada.dev
featured: true
---

tiny-calc reads `2 * (3 + 4)` and prints `14`. It started as a way to learn how parsers work.
```

```console
$ gensane check
Checked 5 pages in 9 ms, with no warnings.
```

The card shows the title, the description, the stack and the status, with icons that lead to the code and the website. The
project's own page, at `/projects/tiny-calc/`, shows the same with the text below the fields.

| Field      | What it shows                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `status`   | `active`, `paused` or `archived`, as a label                                                      |
| `repo`     | A link to the code                                                                                |
| `website`  | A link to the project's site                                                                      |
| `links`    | More links on the project's page, each with a `name` and a `url`, such as a paper or a demo       |
| `featured` | `true` shows it on the home page too, up to three                                                 |
| `cover`    | A picture from `public/`, at the top of the card and of the project's page                        |
| `coverAlt` | What the picture shows, for screen readers. Without it, the picture is only decoration            |

## The order of projects

Featured projects come first. Among them, and among the others, a project with `order` comes before one without, `order: 1`
before `order: 2`, and the rest are by title. The home page shows the first three featured ones:

<!-- continues -->
```markdown content/projects/dotfiles.md
---
title: dotfiles
description: My shell, editor and terminal settings
order: 2
---
```

```console
$ gensane check
Checked 6 pages in 9 ms, with no warnings.
```

## A talk

<!-- continues -->
```console
$ gensane new talk "Parsers by hand"
Created content/talks/parsers-by-hand.md
Fill in "event" before the next build.
```

A talk needs its event and its date. The slides and the video become buttons:

<!-- continues -->
```markdown content/talks/parsers-by-hand.md
---
title: Parsers by hand
event: Compiler Night
date: 2026-06-04
location: Berlin
description: Writing a parser without a generator, and why the error messages get better.
slides: https://ada.dev/talks/parsers.pdf
video: https://www.youtube.com/watch?v=example
---
```

```console
$ gensane check
Checked 7 pages in 9 ms, with no warnings.
```

Talks are newest first. A talk after the day of the build is labelled "Upcoming", so a talk you announce early isn't mistaken for
one you gave. The home page shows the next upcoming talk, if there is one, and then the newest past one; with none upcoming, the two
newest. A talk has no page of its own: its slides and its video are what
readers want, so its entry in the list leads to them.

[Content types](../frontmatter/content-types.md#project) lists every field of projects and talks.
