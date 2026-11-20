# Core

The core turns a site's content and templates into the files of the website. It joins the three parts written before it: the
[Markdown compiler](../markdown-compiler/README.md), [frontmatter](../frontmatter/README.md) and the
[template language](../template/README.md). The core only works on data: everything goes in as text, and the files to write come out.
Reading and writing files is left to the command line program.

<!-- builds -->
```markdown blog/2026-11-17-hello.md
---
title: Hello
date: 2026-11-17
tags: [testing]
---
My first post.
```

```jinja post.html
<h1>{{ page.title }}</h1>
{{ page.html }}
```

```text files
404.html
assets/settings.css
blog/hello/index.html
blog/index.html
index.html
tags/index.html
tags/testing/index.html
```

```html blog/hello/index.html
<h1>Hello</h1>
<p>My first post.</p>
```

One post gives a page for itself, the list of posts, a page for its tag and the list of tags, the home page and a page for missing pages.

## Using it

```ts
import { buildSite } from "./src/core/index.ts";

const built = buildSite({
  config: { site: { title: "Ada's notes", url: "https://example.com" } },
  content: { "blog/2026-11-17-hello.md": "---\ntitle: Hello\ndate: 2026-11-17\n---\nHi\n" },
  templates: { "post.html": "<h1>{{ page.title }}</h1>{{ page.html }}" },
  publicFiles: ["images/me.png"],
});
if (built.ok) {
  for (const file of built.value.files) console.log(file.path);
}
```

| Input         | What it is                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| `config`      | Settings: `site`, `perPage`, `drafts`, `servedAtRoot`, `markdown`, `filters`, and the folder names used in problems |
| `content`     | Each content file by its path inside the content folder                    |
| `templates`   | Each template by its name                                                  |
| `publicFiles` | The paths of the files in the `public` folder, which are copied as they are |
| `themeAssets` | The paths of the theme's assets in the site, such as `assets/style.css`, which are copied as they are |

`buildSite` never throws on a mistake in the content or the templates. It returns every problem it found, from every file, each with an
exact position and a hint. Warnings never stop a build.

## The documentation

| Page                                | Read it to learn                                                       |
| ----------------------------------- | ---------------------------------------------------------------------- |
| [Content](content.md)               | How files become entries: types, URLs, excerpts, reading time, drafts  |
| [Site](site.md)                     | Every page the site has, the order of lists, tags and pagination       |
| [Templates](templates.md)           | What each template is given                                            |
| [Feed and sitemap](feeds.md)        | The Atom feed and the sitemap                                          |
| [Links](links.md)                   | How links and images are checked                                       |
| [Architecture](architecture.md)     | How the steps fit together, with diagrams                              |
| [Problems](diagnostics.md)          | Every error and warning, with an example and a fix                     |
| [Code reference](code-reference.md) | Each file and its important functions, with links to the code          |
| [Testing](testing.md)               | How the core is tested                                                 |

The examples on these pages run in the test suite, so they always match what the code does.
