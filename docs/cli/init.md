# init

`gensane init` starts a new site from a few questions, with everything a site needs to build: a `package.json`, a config, a
`.gitignore`, and a first file of each kind of content. The quickest way, without installing anything first:

```text
npx gensane init my-site
```

Each question has a default, shown in brackets, which an empty answer takes:

```text
The title of the site (My site): Ada's notes
Your name: Ada
The address of the site, if you know it: https://ada.dev
The parts you want: blog, projects, talks, about (blog, projects, talks, about): blog, about
The colors: default, paper, nord, solarized, gruvbox, midnight (default): nord
Where you will publish it: github, cloudflare, netlify, none (none): github
```

An answer that doesn't fit is asked again, with the reason: an address must be a full one, such as `https://example.com`, and a
misspelled palette or host gets the closest name. The host adds the file that publishes the site there, as
[`gensane deploy init`](deploy.md) does later. Ctrl+C stops at any question, and nothing is written.

## Every default at once

`--yes` takes every default without asking. The title comes from the name of the folder:

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

```ts my-site/gensane.config.ts
import { defineConfig } from "gensane";

export default defineConfig({
  site: {
    title: "My site",
    // url: "https://example.com", the address of the site, which the feed and the sitemap need
  },
  theme: {
    palette: "default",
  },
});
```

```json my-site/package.json
{
  "name": "my-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "gensane dev",
    "build": "gensane build",
    "check": "gensane check"
  },
  "devDependencies": {
    "gensane": "^0.1.0"
  }
}
```

The site builds as it is. Until the config has the site's address, the build warns that the feed and the sitemap are left out
([GS411](../core/diagnostics.md#gs411)); the comment in the config shows where the address goes.

The test suite builds and checks the sites `init` makes, with every default and with many kinds of answers, so a new site always
works.

## A host from the start

`--deploy` chooses the host without asking, also with `--yes`:

<!-- runs -->
```console
$ gensane init my-site --yes --deploy cloudflare
Created a site with 9 files in my-site.

Next:
  cd my-site
  npm install
  npm run dev

To publish:
  npm run build && npx wrangler deploy
```

```jsonc my-site/wrangler.jsonc
// Cloudflare serves dist/ as static files. Publish with: npm run build && npx wrangler deploy
{
  "name": "my-site",
  "compatibility_date": "2026-11-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

```text my-site/.gitignore
dist/
node_modules/
.cloudflare/
.wrangler/
```

## Where it writes

The site goes into the folder given, which is made if it isn't there. Without a folder, the site starts in the folder gensane runs
in. Either way the folder must be empty, apart from `.git`, so nothing of yours is ever written over:

<!-- runs -->
```console
$ gensane init --yes
error: this folder already has files, so gensane init won't write into it
hint: choose a new folder, such as: gensane init my-site
$ echo $?
1
```

## Without a terminal

Where nobody can answer, as in CI or a script, `init` doesn't wait for answers that won't come:

<!-- runs -->
```console
$ gensane init my-site
error: gensane init asks questions, but nobody can answer them here
hint: use --yes to take every default
$ echo $?
2
```

## Arguments

<!-- runs -->
```console
$ gensane init --help
Usage: gensane init [folder] [arguments]

Start a new site, from a few questions.

The folder is made if it doesn't exist; it must be empty, apart from .git. Without a folder, the site starts in the folder gensane runs in.

Arguments:
  --yes            Take every default without asking
  --deploy <host>  Add the files to publish on this host: github, cloudflare, netlify
  -h, --help       Show this help
```
