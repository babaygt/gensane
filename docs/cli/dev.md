# dev

`gensane dev` serves the site at `http://localhost:4000/` while you write. It builds in memory, without writing `dist/`, builds again
when a file changes, and reloads every open page in the browser. Ctrl+C stops it.

<!-- runs -->
```markdown content/blog/hello.md
---
title: Hello
date: 2026-11-17
---
```

```markdown content/blog/soon.md
---
title: Soon
date: 2026-11-18
draft: true
---
```

```ts gensane.config.ts
export default { site: { url: "https://example.com" } };
```

```console
$ gensane dev
Built 5 pages in 15 ms, with no warnings.
Serving the site at http://localhost:4000/ (press Ctrl+C to stop).
```

Drafts are always shown, so `/blog/soon/` is there to look at; they are never in the feed or the sitemap.

## After a change

A change in `content/`, `theme/`, `public/` or the config builds the site again. Other folders, such as `dist/`, `node_modules/` and
`.git/`, don't. Editors often save a file in several steps, so changes close together become one build, and a change that comes while
a build is running causes one more build after it.

```text
content/blog/hello.md changed. Rebuilt 5 pages in 6 ms, with no warnings.
```

Every open page then reloads by itself: each page gets a small script that listens for the next build, which only `gensane dev` adds.

## While the site has errors

The problems are printed in the terminal, and every page in the browser shows them instead of the site, in the same format. Once they
are fixed, the page reloads and shows the site again.

```text
content/blog/hello.md changed. Found 1 error and 0 warnings; the browser shows them until they are fixed.
```

## What is served

Only the files of the last build and the files of `public/`, each found by its exact path, so no address can reach any other file on
your computer. `/blog/hello` leads to `/blog/hello/`, as on most web servers, and an address that isn't there gets the site's own
`404.html`.

## A site under a path

When `site.url` has a path, such as `https://ada.github.io/notes/`, `gensane build` adds it to the links. `gensane dev` doesn't: it
serves the site at `http://localhost:4000/` with the links as they are written, so the preview works without any setting.

## Another port

`--port` serves on another port. When the port is already used by another program, `gensane dev` says so and stops, instead of
quietly taking another port that the browser doesn't know:

```text
error: port 4000 is already in use
hint: stop the other program that uses it, or choose another port, such as --port 4001
```

<!-- runs -->
```console
$ gensane dev --help
Usage: gensane dev [arguments]

Serve the site while you write, and reload the browser on every change.

Arguments:
  --port <number>  Serve on this port instead of 4000
  -h, --help       Show this help
```
