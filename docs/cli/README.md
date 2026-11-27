# Command line

`gensane` is the program around the [core](../core/README.md): it reads a site folder from the disk, builds it, prints every problem
with the line it is on, and writes the website into `dist/`. It can also start a new content file and serve the site while you write.

<!-- runs -->
```markdown content/index.md
---
title: Welcome
---
Notes on testing and compilers.
```

```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: { title: "Ada's notes", url: "https://example.com" },
});
```

```console
$ gensane new post "Hello World"
Created content/blog/2026-11-20-hello-world.md
```

```markdown content/blog/2026-11-20-hello-world.md
---
title: Hello World
date: 2026-11-20
draft: true
---
```

```console
$ gensane build --drafts
Built 5 pages into dist in 14 ms, with no warnings.
```

```text files dist
404.html
assets/callout-caution.svg
assets/callout-important.svg
assets/callout-note.svg
assets/callout-tip.svg
assets/callout-warning.svg
assets/consent.css
assets/consent.js
assets/favicon.svg
assets/icons.svg
assets/search.js
assets/settings.css
assets/style.css
assets/theme.js
blog/hello-world/index.html
blog/index.html
index.html
search-index.json
search/index.html
sitemap.xml
```

A new post starts as a draft, so `--drafts` is needed to see it in a build. There is a sitemap because the config has the address of
the site, but no feed yet: drafts never appear in the feed, so it waits for the first published post.

## Commands

| Command                                              | What it does                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| [`gensane build`](build-and-check.md)                | Builds the site into `dist/`                                             |
| [`gensane check`](build-and-check.md)                | Does the same work without writing anything, for CI                      |
| [`gensane dev`](dev.md)                              | Serves the site while you write, and reloads the browser on every change |
| [`gensane init`](init.md)                            | Starts a new site, from a few questions                                  |
| [`gensane deploy init`](deploy.md)                   | Adds the files that publish the site on GitHub Pages, Cloudflare or Netlify |
| [`gensane new`](new.md)                              | Writes a new content file with the fields its type needs                 |
| [`gensane skill add`](skill.md)                      | Adds the agent skill, which teaches coding agents how a gensane site works |
| [`gensane theme eject`](theme.md#changing-all-of-it) | Copies the default theme into `theme/`, to change all of it              |

<!-- runs -->
```console
$ gensane --help
gensane 0.3.0: a static site generator for developer blogs and portfolios

Usage: gensane <command> [arguments]

Commands:
  build   Build the site into dist/
  check   Check the site for problems, without writing anything
  dev     Serve the site while you write, and reload the browser on every change
  deploy  Add the files that publish the site on a host
  init    Start a new site, from a few questions
  new     Write a new content file, such as a post
  skill   Add the gensane skill for AI coding agents to the site
  theme   Copy the default theme into theme/, to change all of it

Run gensane <command> --help to see the arguments of a command.
```

`gensane --version` prints the version. Gensane always works on the folder it runs in.

## Exit codes

Scripts and CI can tell from the exit code what happened.

| Code | Meaning                                                                         |
| ---- | ------------------------------------------------------------------------------- |
| 0    | It worked. Warnings don't change this.                                          |
| 1    | The site has errors, a file couldn't be read or written, or `init` wrote nothing |
| 2    | The command was written wrong, such as a command or an argument that isn't there |

## Pages

| Page                                     | For                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| [The site folder](folders.md)            | What gensane reads, what it leaves out, and where it writes            |
| [The config](config.md)                  | `gensane.config.ts` and every setting                                  |
| [The default theme](theme.md)            | What the theme shows, changing one part of it, and its files            |
| [build and check](build-and-check.md)    | Building, checking in CI, drafts and the output folder                 |
| [init](init.md)                          | Starting a new site                                                    |
| [deploy](deploy.md)                      | Publishing the site on GitHub Pages, Cloudflare or Netlify             |
| [new](new.md)                            | Starting a post, a project, a talk or a page                           |
| [dev](dev.md)                            | Serving the site while you write                                       |
| [Problems](problems.md)                  | How problems are printed, mistakes in a command, and GS501 to GS506    |
| [Architecture](architecture.md)          | The program around the core: ports and commands                        |
| [Code reference](code-reference.md)      | Every source file and its important names                              |
| [Testing](testing.md)                    | How the command line is tested                                         |

## About the examples

Every example on these pages is run by the test suite with the real `gensane` program, in a new folder with the files the example
shows. The output, the exit code and the files written must be exactly as shown. Three things differ from run to run, so the test
reads them as they are written here: the time a build takes, the day (the examples are written on 2026-11-20), and the port of
`gensane dev`. Templates that an example doesn't show print the page's title, such as `<h1>Hello</h1>`.
