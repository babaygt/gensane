# deploy

`gensane deploy init <host>` adds the file that publishes the site on a host: GitHub Pages, Cloudflare or Netlify. It only writes the
file; the site is published by the host. [`gensane init`](init.md) asks for the host, and adds the same file to a new site.

| Host         | File                           | What publishes the site                                                    |
| ------------ | ------------------------------ | -------------------------------------------------------------------------- |
| `github`     | `.github/workflows/deploy.yml` | GitHub, on every push to `main`, with its own Pages actions                |
| `cloudflare` | `wrangler.jsonc`               | `npx wrangler deploy`, from your computer or from CI                       |
| `netlify`    | `netlify.toml`                 | Netlify, on every push, once the repository is added as a project there    |

Every host builds with `npm run build` and publishes `dist/`, with the site's `404.html` for pages that don't exist. A site under a path,
such as `https://ada.github.io/notes/`, works without anything more, because the address in the config decides the path of every link
([Sites under a path](../core/site.md#sites-under-a-path)).

## GitHub Pages

<!-- runs -->
```console
$ gensane deploy init github
Created .github/workflows/deploy.yml

To publish:
  Push the site to GitHub, with package-lock.json, and in the repository's settings,
  under Pages, set the source to "GitHub Actions".
```

```yaml .github/workflows/deploy.yml
# Builds the site and publishes it on GitHub Pages on every push to main.
# In the repository's settings, under Pages, set the source to "GitHub Actions".
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

`npm ci` installs exactly what `package-lock.json` lists, which `npm install` writes; commit it with the site. `workflow_dispatch` adds a
button to publish again without a new push.

## Cloudflare

<!-- runs -->
```console
$ gensane deploy init cloudflare
Created wrangler.jsonc

To publish:
  npm run build && npx wrangler deploy
```

The file is shown in [init](init.md#a-host-from-the-start). Its `name` is the site's name on Cloudflare, made from the name of the folder.
`not_found_handling` makes Cloudflare answer a page that doesn't exist with the site's `404.html`, and the 404 status.

The compatibility date is a fixed one, not today's: a Wrangler only a little older than today refuses to run a site with a later date,
and a site of plain files doesn't depend on what changed since. Wrangler writes a `.wrangler/` folder while it works, which `init`
already leaves out of git.

## Netlify

<!-- runs -->
```console
$ gensane deploy init netlify
Created netlify.toml

To publish:
  Push the site to a repository, and add it as a new project on Netlify.
```

```toml netlify.toml
# Netlify builds the site with this command, and publishes dist/.
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "24"
```

## A file that is already there

A file of the site is never replaced, because it may have been changed since:

<!-- runs -->
```text netlify.toml
[build]
  publish = "public"
```

```console
$ gensane deploy init netlify
error: netlify.toml is already there, so it was left as it is
hint: remove it first to start again from the template
$ echo $?
1
```

## Arguments

<!-- runs -->
```console
$ gensane deploy --help
Usage: gensane deploy init <github|cloudflare|netlify> [arguments]

Add the files that publish the site on a host.

It only writes the files; the site is published by the host. A file that is already there is left as it is.

Arguments:
  -h, --help  Show this help
```
