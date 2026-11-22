# Your first site

This tutorial makes a small site for Ada, a developer, from an empty folder to a site online: a home page, a post, a project and an
about page. It takes about fifteen minutes. You need [Node.js](https://nodejs.org/) 22.18 or newer.

Every command here is run by gensane's tests, exactly as it is written, so what you see is what the page shows. Only the dates and
the times differ: yours are today's.

> [!NOTE]
> The commands are written as `gensane ...`. Before the site has gensane installed, run them as `npx @gensane/cli ...`; after
> `npm install`, as `npx gensane ...`. The scripts in `package.json`, such as `npm run dev`, need neither.

## Make the site

`init` asks a few questions. `--yes` takes every default, which is enough to begin with; everything can be changed later:

<!-- runs -->
```console
$ gensane init my-site --yes
Created a site with 8 files in my-site.

Next:
  cd my-site
  npm install
  npm run dev
```

```text files my-site
.gitignore
content/blog/2026-11-20-hello-world.md
content/index.md
content/pages/about.md
content/projects/first-project.md
content/talks/first-talk.md
gensane.config.ts
package.json
```

Each file in `content/` is a first example of its kind, to change or to delete. Then install gensane in the site:

```sh
cd my-site
npm install
```

## See it

<!-- continues -->
```console
$ cd my-site
$ gensane dev
warning[GS411]: the feed and the sitemap are left out, because they need the address of the site
  ┌─ gensane.config.ts
  │
  = hint: add `site: { url: "https://example.com" }` to the config

Built 11 pages in 30 ms, with 1 warning.
Serving the site at http://localhost:4000/ (press Ctrl+C to stop).
```

With `npm run dev` this is what you see. Open `http://localhost:4000/`: the site is there, with a post, a project and a talk. Keep
it running, and the page reloads each time you save a file.

The warning says what is missing, where, and how to fix it. That is the next step.

## Make it yours

`gensane.config.ts` holds what the whole site needs. Give it a title, your name, the site's address and your profile:

<!-- continues -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: {
    title: "Ada's notes",
    description: "Notes on compilers and testing",
    url: "https://ada.dev",
    author: "Ada Lovelace",
    github: "ada",
  },
  theme: {
    palette: "default",
  },
});
```

```console
$ gensane check
Checked 11 pages in 30 ms, with no warnings.
```

`check` does everything a build does except write the site, so it is the quickest way to know that all is well. With the address,
the feed and the sitemap are made too. Your name and a GitHub icon are now on the home page; [the config](../cli/config.md#site)
lists every profile it can show, and [the palettes](../cli/config.md#theme) the colors.

The home page's own text is in `content/index.md`:

<!-- continues -->
```markdown content/index.md
---
title: Home
---
I build compilers and the tests that keep them honest. This is where I write about both.
```

```console
$ gensane check
Checked 11 pages in 30 ms, with no warnings.
```

## Write a post

`new` starts a file with the fields it needs:

<!-- continues -->
```console
$ gensane new post "Why I write tests first"
Created content/blog/2026-11-20-why-i-write-tests-first.md
```

```text files content/blog
2026-11-20-hello-world.md
2026-11-20-why-i-write-tests-first.md
```

```markdown content/blog/2026-11-20-why-i-write-tests-first.md
---
title: Why I write tests first
date: 2026-11-20
draft: true
---
```

It is a draft, so `gensane dev` shows it with a "Draft" label, but a build leaves it out. Write the post below the fields, give it
tags, and remove `draft: true` when it is ready:

<!-- continues -->
````markdown content/blog/2026-11-20-why-i-write-tests-first.md
---
title: Why I write tests first
date: 2026-11-20
description: A failing test is the shortest description of what I want.
tags: [testing]
---

A failing test is the shortest description of what I want. Here is one for a function that adds:

```ts
expect(add(2, 2)).toBe(4);
```

Then I write the function, and the test says when I am done.
````

```console
$ gensane check
Checked 13 pages in 30 ms, with no warnings.
```

Two pages more: the post, and the page of its tag at `/tags/testing/`. The Markdown can have tables, task lists, footnotes and
callouts; [Markdown](../markdown-compiler/syntax.md) shows them all.

## Add a project

<!-- continues -->
```console
$ gensane new project tiny-calc
Created content/projects/tiny-calc.md
```

A project has a few more fields, which the theme shows on its card:

<!-- continues -->
```markdown content/projects/tiny-calc.md
---
title: tiny-calc
description: A calculator language in 400 lines, with a parser and an interpreter
stack: [TypeScript]
status: active
repo: https://github.com/ada/tiny-calc
featured: true
---

tiny-calc reads `2 * (3 + 4)` and prints `14`. It started as a way to learn how parsers work.
```

```console
$ gensane check
Checked 14 pages in 30 ms, with no warnings.
```

`featured: true` puts it on the home page too. [Content types](../frontmatter/content-types.md) lists the fields of every kind of
content. The example project, `content/projects/first-project.md`, can go now; so can the example talk and post, once you have your
own.

## Mistakes

gensane says what is wrong, and where. A link to a page that doesn't exist, for example:

<!-- continues -->
```markdown content/pages/about.md
---
title: About
---
I work on compilers. My latest project is [tiny-calc](/projects/tinycalc/).
```

```console
$ gensane check
error[GS413]: "/projects/tinycalc/" doesn't lead to a page or a file of the site
  ┌─ content/pages/about.md:4:55
  │
4 │ I work on compilers. My latest project is [tiny-calc](/projects/tinycalc/).
  │                                                       ^^^^^^^^^^^^^^^^^^^
  │
  = hint: did you mean "/projects/tiny-calc/"?

Found 1 error and 0 warnings.
$ echo $?
1
```

With an error, a build writes nothing, so a broken site is never published. The fix is the one in the hint:

<!-- continues -->
```markdown content/pages/about.md
---
title: About
---
I work on compilers. My latest project is [tiny-calc](/projects/tiny-calc/).
```

```console
$ gensane check
Checked 14 pages in 30 ms, with no warnings.
```

[Problems of a build](../core/diagnostics.md) explains each problem gensane can find.

## Build

<!-- continues -->
```console
$ gensane build
Built 14 pages into dist in 30 ms, with no warnings.
```

`dist/` is the whole site: a folder per page, with its `index.html`, and the feed, the sitemap and the search index. Any host that
serves files can publish it.

## Publish

`deploy init` adds the file a host needs. For GitHub Pages:

<!-- continues -->
```console
$ gensane deploy init github
Created .github/workflows/deploy.yml

To publish:
  Push the site to GitHub, with package-lock.json, and in the repository's settings,
  under Pages, set the source to "GitHub Actions".
```

Make a repository on GitHub, then push the site to it:

```sh
git init
git add .
git commit -m "My site"
git remote add origin https://github.com/ada/ada.github.io.git
git push -u origin main
```

In the repository's settings, under Pages, set the source to "GitHub Actions". From then on, every push to `main` builds the site
and publishes it, in about a minute. Cloudflare and Netlify work the same way; [deploy](../cli/deploy.md) shows each of them.

## Next

- [Writing content](../frontmatter/content-types.md): every kind of content and its fields, such as talks, experience and education
  for the about page.
- [The default theme](../cli/theme.md): what it shows, and how to change one part of it.
- [The config](../cli/config.md): every setting.
