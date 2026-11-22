# The about page

The about page is `content/pages/about.md`, shown at `/about/` and in the menu. Below its text, the theme adds your experience and
education as a timeline, newest first, from one small file for each job and each school.

[The example site's about page](https://gensane.dev/example/about/) shows the result.

## The text

<!-- runs -->
```markdown content/pages/about.md
---
title: About
description: Who Ada is, and what Ada works on.
---

I build compilers and the tests that keep them honest. Before that I wrote tools for testers, and before that I studied mathematics.

You can reach me at ada@example.com.
```

```ts gensane.config.ts
export default { site: { title: "Ada's notes", url: "https://ada.dev" } };
```

```console
$ gensane check
Checked 4 pages in 9 ms, with no warnings.
```

It is ordinary Markdown, so it can have headings, lists, pictures and links.

## Experience

`new experience` starts a file for a job, with the company as its name and this month as its start:

<!-- continues -->
```console
$ gensane new experience "Made-up Labs"
Created content/experience/made-up-labs.md
Fill in "role" before the next build.
```

```markdown content/experience/made-up-labs.md
---
company: Made-up Labs
role: ""
start: 2026-11
---
```

Fill in the role, and the rest of what you want to show:

<!-- continues -->
```markdown content/experience/made-up-labs.md
---
company: Made-up Labs
role: Compiler engineer
start: 2025-03
location: Remote
stack: [TypeScript, Rust]
---
```

```markdown content/experience/imaginary-test-tools.md
---
company: Imaginary Test Tools
role: Software engineer
start: 2023-01
end: 2025-02
location: Berlin
---
```

```console
$ gensane check
Checked 4 pages in 9 ms, with no warnings.
```

A job without `end` is the one you have now, shown as "present". `start` and `end` can be a month, such as `2025-03`, or a whole
date. The timeline is newest first; `order: 1` on a file puts it first anyway.

## Education

<!-- continues -->
```markdown content/education/university.md
---
school: University of Somewhere
degree: BSc
field: Mathematics
start: 2019-10
end: 2022-07
location: Berlin
---
```

```console
$ gensane check
Checked 4 pages in 9 ms, with no warnings.
```

The theme shows it as "BSc in Mathematics, University of Somewhere". Experience and education have no pages of their own, so the
number of pages stays the same.

## Mistakes

A date that isn't one is shown where it is:

<!-- continues -->
```markdown content/education/university.md
---
school: University of Somewhere
degree: BSc
start: 2019-13
---
```

```console
$ gensane check
error[GS210]: 2019-13 is not a real date
  ┌─ content/education/university.md:4:8
  │
4 │ start: 2019-13
  │        ^^^^^^^
  │
  = hint: write dates as YYYY-MM-DD or YYYY-MM, or put the value in quotes if it is text

Found 1 error and 0 warnings.
$ echo $?
1
```

[Content types](../frontmatter/content-types.md#experience) lists every field of experience and education.
