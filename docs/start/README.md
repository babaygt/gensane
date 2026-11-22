# What gensane is

gensane turns a folder of Markdown files into a website. You write posts, projects and talks as text files, and gensane builds
them into plain HTML pages that any host can serve, with no server, no database and nothing to keep updated.

It is made for developers who want a blog, a portfolio or both online in an afternoon, and then want to spend their time writing
instead of configuring.

## What a site looks like

A site is a folder:

```text
my-site/
├── gensane.config.ts      the title, your name, your profiles, the colors
├── content/
│   ├── index.md           the home page
│   ├── blog/              posts, one file each
│   ├── projects/          projects, shown as cards
│   ├── talks/             talks, with their slides and videos
│   ├── experience/        jobs, shown as a timeline on the about page
│   ├── education/         schools, the same
│   └── pages/             any other page, such as about.md
└── public/                files copied as they are, such as pictures
```

`gensane build` turns it into `dist/`, a folder of HTML, CSS and a few small scripts, ready to publish. `gensane dev` shows the site
in the browser while you write, and reloads it when a file changes.

Each kind of content has a few fields at the top of its file, such as a post's title and date:

```markdown
---
title: Why I write tests first
date: 2026-11-20
tags: [testing]
---

The first test I write is the one that fails.
```

## What you get

- **A finished theme.** A home page with your name, picture and profiles, a blog, projects, talks and an about page, in six color
  palettes, each light and dark. No templates to write; any part can be replaced by a file of your own.
- **Markdown as GitHub writes it**, with tables, task lists, footnotes, callouts and colored code.
- **Search, a feed and a sitemap,** made by the build.
- **Clear problems.** A mistake, such as a missing field or a link to a page that doesn't exist, is shown with its file, line and
  column and a hint how to fix it, and a broken link stops the build.
- **Publishing on GitHub Pages, Cloudflare or Netlify** with one file that gensane writes.

## What it isn't

- **Not a framework.** There are no components and no JavaScript to write; pages are made from HTML templates.
- **Not extended with plugins.** What it does is built in and tested together. A theme can change everything readers see.
- **Not for every kind of site.** It is made for personal sites. Large documentation sites, shops and web apps are better served by
  tools made for them. (This documentation is built by gensane too, with a theme of its own.)

## How it is made

gensane has no dependencies. Its Markdown compiler, its template language and everything else are written for it, and tested with
thousands of tests, so the same files always give exactly the same site. The [internals](../core/README.md) explain how each part
works.

## What you need

[Node.js](https://nodejs.org/) 22.18 or newer, which comes with npm. `node --version` shows which one you have.

## Next

- [Quick start](quick-start.md): a site running on your computer in two minutes.
- [Your first site](tutorial.md): a tutorial, from an empty folder to a site online.
