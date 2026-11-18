# Frontmatter

Frontmatter is the block of settings at the top of a content file. Gensane reads it with its own parser, written from scratch in TypeScript
with no runtime dependencies, and then checks it against the rules for that type of content.

<!-- valid post -->
```yaml
---
title: Testing a compiler
date: 2026-11-18
tags: [typescript, testing]
---
```

Reading and checking are two separate steps:

```ts
import { parseFrontmatter, validateContent } from "./src/frontmatter/index.ts";

const parsed = parseFrontmatter(source, "post.md");
if (parsed.ok) {
  const checked = validateContent("post", parsed.value.data);
}
```

| Function           | What it answers                            | On success                                         |
| ------------------ | ------------------------------------------ | -------------------------------------------------- |
| `parseFrontmatter` | Is this written correctly?                 | `data`, the `body` after the block and `bodyStart` |
| `validateContent`  | Does it hold what this type of content needs? | Typed `value`, custom fields in `extra`, `warnings` |

Neither function throws on a mistake in a file. Both return a result that holds every problem they found, each with an exact position and a
hint:

<!-- reports GS221 as post -->
```yaml
---
title: Testing a compiler
date: 18-11-2026
---
```

```text
line 3, column 7: "date" must be a date, but "18-11-2026" is text
hint: write it as 2026-11-18
```

## The documentation

| Page                                | Read it to learn                                                 |
| ----------------------------------- | ---------------------------------------------------------------- |
| [Architecture](architecture.md)     | How the stages fit together, with diagrams                       |
| [Supported syntax](syntax.md)       | What you can write, and what is left out on purpose              |
| [Content types](content-types.md)   | The fields of a post, page, project, talk, job and degree        |
| [Parsing](parsing.md)               | How text becomes data, including the grammar                     |
| [Validation](validation.md)         | How small schemas combine, and how types are inferred from them  |
| [Problems](diagnostics.md)          | Every error and warning, with an example and a fix               |
| [Code reference](code-reference.md) | Each file and its important functions, with links to the code    |
| [Testing](testing.md)               | How frontmatter is tested                                        |

The examples on these pages run in the test suite, so they always match what the code does.
