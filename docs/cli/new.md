# new

`gensane new <type> <title>` writes a new content file with the fields its type needs, named after the title, so a post can be
started without remembering its frontmatter or today's date.

<!-- runs -->
```console
$ gensane new post "Testing compilers"
Created content/blog/2026-11-20-testing-compilers.md
```

```markdown content/blog/2026-11-20-testing-compilers.md
---
title: Testing compilers
date: 2026-11-20
draft: true
---
```

A post is named with today's date first, so posts are sorted by date in the editor; the date is left out of its address,
`/blog/testing-compilers/`. Today is the day on your computer's own calendar, so a post written late in the evening gets that evening's
date. Quotes around the title are optional: `gensane new post Testing compilers` writes the same file.

## Types

| Type         | File                               | Fields                                   | Starts as a draft |
| ------------ | ---------------------------------- | ---------------------------------------- | ----------------- |
| `post`       | `content/blog/<date>-<slug>.md`    | `title`, `date`                          | Yes               |
| `project`    | `content/projects/<slug>.md`       | `title`                                  | Yes               |
| `page`       | `content/pages/<slug>.md`          | `title`                                  | No                |
| `talk`       | `content/talks/<slug>.md`          | `title`, `event` to fill in, `date`      | No draft field    |
| `experience` | `content/experience/<slug>.md`     | `company`, `role` to fill in, `start`    | No draft field    |
| `education`  | `content/education/<slug>.md`      | `school`, `degree` to fill in, `start`   | No draft field    |

Posts and projects start as drafts, so nothing is published by accident; remove `draft: true` when they are ready. For experience the
title is the company, and for education the school; both start this month.

## Fields to fill in

Some fields are needed but can't be known from the title, such as the event of a talk. They are written empty, and gensane says so.
Until they are filled in, a build points at the line:

<!-- runs -->
```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```console
$ gensane new talk Testing compilers
Created content/talks/testing-compilers.md
Fill in "event" before the next build.
```

```markdown content/talks/testing-compilers.md
---
title: Testing compilers
event: ""
date: 2026-11-20
---
```

```console
$ gensane check
error[GS225]: "event" is empty
  ┌─ content/talks/testing-compilers.md:3:8
  │
3 │ event: ""
  │        ^^
  │
  = hint: write some text, or remove this line if the field is optional

Found 1 error and 0 warnings.
$ echo $?
1
```

## Titles and file names

A title is written as it is when the frontmatter reads it back as the same text, and in quotes otherwise, such as a title with `: `.
The file is named with the [slug](../core/content.md) of the title. `--slug` names it yourself, which is needed when the title has
nothing a file name can use:

<!-- runs -->
```console
$ gensane new page "Part 2: the end" --slug part-2
Created content/pages/part-2.md
```

```markdown content/pages/part-2.md
---
title: "Part 2: the end"
---
```

<!-- runs -->
```console
$ gensane new post 日本
error: "日本" has nothing to use in a file name
hint: add --slug, such as --slug my-post
$ echo $?
2
```

## A file that is already there

A file is never replaced. Edit it, or give the new one another slug.

<!-- runs -->
```markdown content/projects/gensane.md
---
title: Gensane
---
My own words.
```

```console
$ gensane new project Gensane
error: content/projects/gensane.md already exists
hint: edit that file, or give the new one another --slug
$ echo $?
1
```

```markdown content/projects/gensane.md
---
title: Gensane
---
My own words.
```

## Arguments

<!-- runs -->
```console
$ gensane new --help
Usage: gensane new <type> <title> [arguments]

Write a new content file, such as a post.

The types are post, project, talk, experience, education and page. For experience the title is the company, and for education the school.

Arguments:
  --slug <slug>  Name the file with this slug instead of one made from the title
  -h, --help     Show this help
```
