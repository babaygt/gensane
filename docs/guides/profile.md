# Your name, picture and profiles

The top of the home page shows who the site is about: a picture, a name, one line about you, and icons that lead to your profiles.
The same icons are in the footer of every page. All of it comes from `site` in `gensane.config.ts`.

[The example site](https://gensane.dev/example/) shows the result.

## Your name and one line about you

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: {
    title: "Ada's notes",
    url: "https://ada.dev",
    author: "Ada Lovelace",
    description: "Notes on compilers and testing",
  },
});
```

```console
$ gensane check
Checked 2 pages in 9 ms, with no warnings.
```

The home page's heading is the author's name, or the site's title when there is no author. `description` is the line below it,
and also the subtitle of the feed.

## A picture

Put the picture in `public/`, which is copied into the site as it is, and name it in `author`:

```text
public/
└── images/
    └── ada.jpg
```

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: {
    title: "Ada's notes",
    url: "https://ada.dev",
    author: { name: "Ada Lovelace", avatar: "/images/ada.jpg" },
  },
});
```

```console
$ gensane check
Checked 2 pages in 9 ms, with no warnings.
```

The theme shows it as a circle, 96 pixels wide, so a square picture of about 200 by 200 pixels looks sharp on every screen without
making the page slow. JPEG, PNG, WebP and SVG all work.

## Profiles

Each profile is one setting, and its icon appears once the setting is there:

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: {
    title: "Ada's notes",
    url: "https://ada.dev",
    author: "Ada Lovelace",
    github: "ada",
    mastodon: "https://mastodon.social/@ada",
    linkedin: "ada-lovelace",
    email: "ada@example.com",
  },
});
```

```console
$ gensane check
Checked 2 pages in 9 ms, with no warnings.
```

Most profiles are a user name, and the theme makes the address. Mastodon is the whole address, since every server has its own; its
link has `rel="me"`, so Mastodon can show your profile as verified once your site links back. [The config](../cli/config.md#site)
lists every profile: GitHub, GitLab, Codeberg, Mastodon, Bluesky, LinkedIn and email.

A misspelled profile gets a warning, because the theme would never see it:

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: { title: "Ada's notes", url: "https://ada.dev", githb: "ada" },
});
```

```console
$ gensane check
warning[GS506]: "site.githb" is not a known setting
  ┌─ gensane.config.ts
  │
  = hint: did you mean "github"? Other settings of the site are fine, for the templates

Checked 2 pages in 9 ms, with 1 warning.
```

A setting of your own, such as `twitter`, is passed on to the templates as it is, for a theme that shows it.

## What comes below

Below your name, the home page shows the text of `content/index.md`, then your featured projects, your recent posts and your talks.
`theme.home.sections` chooses which of them, and in what order:

<!-- runs -->
```ts gensane.config.ts
import { defineConfig } from "@gensane/cli";

export default defineConfig({
  site: { title: "Ada's notes", url: "https://ada.dev", author: "Ada Lovelace" },
  theme: {
    home: { sections: ["intro", "featured-projects", "recent-posts"] },
  },
});
```

```console
$ gensane check
Checked 2 pages in 9 ms, with no warnings.
```

This home page has no talks, and shows projects before posts. A part with nothing in it, such as talks on a site without any, is
left out by itself.
