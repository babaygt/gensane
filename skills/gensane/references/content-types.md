<!-- Made by scripts/skill.ts from docs/frontmatter/content-types.md; change those and run pnpm skill. -->

# Content types

Every kind of content, its folder, and every field of its frontmatter.

Each type of content has its own fields, defined in [`content-types.ts`](https://github.com/babaygt/gensane/blob/main/src/frontmatter/validation/content-types.ts).

| Kind of value     | What to write                                                 |
| ----------------- | ------------------------------------------------------------- |
| Text              | Any text that isn't empty. A number needs quotes: `"1984"`    |
| Date              | `2026-11-18`                                                  |
| Month or date     | `2024-06` or `2024-06-15`                                     |
| Date or `present` | A month, a date, or the word `present`                        |
| Web address       | `https://example.com`, or `/about` for a page on this site    |
| True or false     | `true` or `false`                                             |
| Whole number      | `3`                                                           |
| List of text      | `[TypeScript, Node]`                                          |

## `post`

| Field         | Required | Kind of value | When left out |
| ------------- | -------- | ------------- | ------------- |
| `title`       | Yes      | Text          |               |
| `slug`        | No       | Text          | File name     |
| `date`        | Yes      | Date          |               |
| `updated`     | No       | Date          | Empty         |
| `description` | No       | Text          | Empty         |
| `tags`        | No       | List of text  | No tags       |
| `draft`       | No       | True or false | `false`       |
| `cover`       | No       | Text          | Empty         |

## `page`

| Field         | Required | Kind of value | When left out |
| ------------- | -------- | ------------- | ------------- |
| `title`       | Yes      | Text          |               |
| `slug`        | No       | Text          | File name     |
| `description` | No       | Text          | Empty         |
| `draft`       | No       | True or false | `false`       |
| `order`       | No       | Whole number  | After the pages that have one, by title |

`order` places a page in its [section](https://gensane.dev/docs/reference/site/pages/#sections), such as a page of documentation; lower comes first.

## `project`

| Field         | Required | Kind of value                            | When left out |
| ------------- | -------- | ---------------------------------------- | ------------- |
| `title`       | Yes      | Text                                     |               |
| `slug`        | No       | Text                                     | File name     |
| `description` | No       | Text                                     | Empty         |
| `stack`       | No       | List of text                             | Empty list    |
| `repo`        | No       | Web address                              | Empty         |
| `website`     | No       | Web address                              | Empty         |
| `links`       | No       | List of `name` (text) and `url` (web address) | Empty list |
| `status`      | No       | `active`, `paused` or `archived`         | Empty         |
| `featured`    | No       | True or false                            | `false`       |
| `draft`       | No       | True or false                            | `false`       |
| `cover`       | No       | Text                                     | Empty         |
| `order`       | No       | Whole number                             | Empty         |

## `talk`

| Field         | Required | Kind of value | When left out |
| ------------- | -------- | ------------- | ------------- |
| `title`       | Yes      | Text          |               |
| `event`       | Yes      | Text          |               |
| `date`        | Yes      | Date          |               |
| `description` | No       | Text          | Empty         |
| `location`    | No       | Text          | Empty         |
| `slides`      | No       | Web address   | Empty         |
| `video`       | No       | Web address   | Empty         |

## `experience`

| Field      | Required | Kind of value     | When left out |
| ---------- | -------- | ----------------- | ------------- |
| `company`  | Yes      | Text              |               |
| `role`     | Yes      | Text              |               |
| `start`    | Yes      | Month or date     |               |
| `end`      | No       | Date or `present` | `present`     |
| `location` | No       | Text              | Empty         |
| `stack`    | No       | List of text      | Empty list    |
| `order`    | No       | Whole number      | Empty         |

## `education`

| Field      | Required | Kind of value     | When left out |
| ---------- | -------- | ----------------- | ------------- |
| `school`   | Yes      | Text              |               |
| `degree`   | Yes      | Text              |               |
| `field`    | No       | Text              | Empty         |
| `start`    | Yes      | Month or date     |               |
| `end`      | No       | Date or `present` | `present`     |
| `location` | No       | Text              | Empty         |
| `order`    | No       | Whole number      | Empty         |

## Rules that apply to every type

**A field with no value counts as left out.** `description:` on its own behaves as if the line weren't there.

**Text must be text.** `title: 1984` is an error rather than a quiet conversion, and the hint shows the quotes to add.

**An end can't come before the start.** Days are only compared when both dates have one, so a job from `2024-06-15` to `2024-06` is allowed.

**`slug` sets the URL.** Posts, pages and projects get their URL from the file name, and `slug: my-post` replaces it. A slug can only
use lowercase letters, digits and single dashes.

**Custom fields are allowed.** Fields that the type doesn't define are kept for templates.

**A likely typo gets a warning.** A custom field that looks like a misspelling of a field you haven't used is reported as
[GS224](https://gensane.dev/docs/internals/frontmatter/diagnostics/), with a suggestion. The file is still valid.
