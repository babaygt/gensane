---
title: gensane
---

# Your blog and portfolio, from Markdown

A static site generator for developers who want a site online in minutes, with nothing to learn but Markdown. No dependencies,
no framework, no config to study.

```sh
npx @gensane/cli init my-site
```

<p class="actions"><a class="button button-main" href="/example/">See the example</a> <a class="button" href="https://github.com/babaygt/gensane#readme">Read the docs</a></p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/images/palette-default-dark.png">
  <img class="screenshot" src="/images/palette-default-light.png" alt="The home page of a site made with gensane: a developer's name and picture, links to their profiles, projects as cards, recent posts and talks" width="1100" height="760">
</picture>

## What you get

- **A theme that needs no templates.** A home page with your name, picture and profiles, a blog, projects, talks, and an about
  page with your experience. Six palettes, light and dark, all readable.
- **Markdown as GitHub writes it.** Tables, task lists, footnotes, callouts, and colors in code at build time.
- **Search with no server.** It finds as you type, from an index the build writes.
- **Problems with their line.** Every mistake is printed with its file, line and column, and a hint how to fix it. Broken links
  stop the build.
- **Publishing in one file.** GitHub Pages, Cloudflare or Netlify, written by `gensane deploy init`.
- **Small pages.** Valid HTML, accessible, and less than 3 KB of CSS as readers download it.

## Made by hand

The Markdown compiler, the template language and everything else are written by hand, with thousands of tests, so the same files
always give the same site. [The source](https://github.com/babaygt/gensane) is open, under the MIT license.
