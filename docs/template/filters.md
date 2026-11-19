# Filters

A filter takes a value and gives a new one: `{{ value | filter }}`, or `{{ value | filter(argument) }}` when it needs more. Filters are
defined in [`filters.ts`](../../src/template/rendering/filters.ts), [`list-filters.ts`](../../src/template/rendering/list-filters.ts) and
[`dates.ts`](../../src/template/rendering/dates.ts).

The names and the number of arguments are checked before anything is rendered. A filter that gets the wrong kind of value reports
[GS334](diagnostics.md), and most filters treat nothing as empty, so a missing optional field doesn't break the page.

| Filter                                         | What it does                                      |
| ---------------------------------------------- | ------------------------------------------------- |
| `upper`, `lower`, `capitalize`, `trim`         | Change text                                       |
| `truncate(length)`, `truncate(length, ending)` | Shorten text                                      |
| `default(value)`                               | Gives a fallback for nothing or empty text        |
| `length`                                       | Counts characters, items or fields                |
| `join`, `join(separator)`                      | Prints a list                                     |
| `first`, `last`                                | The first or last item or character               |
| `raw`                                          | Prints HTML without escaping                      |
| `where(field)`, `where(field, value)`          | Keeps some items of a list                        |
| `take(count)`, `skip(count)`                   | Keeps the first items, or leaves them out         |
| `sort`, `sort(field)`                          | Sorts a list                                      |
| `reverse`                                      | Reverses a list                                   |
| `date(format)`                                 | Writes a date                                     |

## Text

### `upper`

<!-- renders -->
```jinja
{{ "Hello" | upper }}
```

```html
HELLO
```

### `lower`

<!-- renders -->
```jinja
{{ "Hello" | lower }}
```

```html
hello
```

### `capitalize`

Only the first letter changes.

<!-- renders -->
```jinja
{{ "hello wORLD" | capitalize }}
```

```html
Hello wORLD
```

### `trim`

Removes spaces and line breaks at both ends.

<!-- renders -->
```jinja
[{{ "  hi  " | trim }}]
```

```html
[hi]
```

### `truncate`

Keeps at most this many characters, and adds `…` or the given ending when something was cut off. It counts whole characters, so an emoji
is never cut in half.

<!-- renders -->
```jinja
{{ "A long title" | truncate(6) }} / {{ "A long title" | truncate(6, "...") }} / {{ "Short" | truncate(6) }}
```

```html
A long… / A long... / Short
```

## Values

### `default`

Gives the fallback for nothing or empty text. A missing field before `default` is never a warning.

<!-- renders -->
```jinja
{{ page.subtitle | default("No subtitle") }}
```

```json
{ "page": {} }
```

```html
No subtitle
```

### `length`

Counts the characters of text, the items of a list or the fields of a group. Nothing has a length of 0.

<!-- renders -->
```jinja
{{ "héllo" | length }} {{ tags | length }} {{ page.tags | length }}
```

```json
{ "tags": ["a", "b"], "page": { "tags": null } }
```

```html
5 2 0
```

### `join`

Prints the items of a list, separated by `, ` unless another separator is given.

<!-- renders -->
```jinja
{{ tags | join }} / {{ tags | join(" + ") }}
```

```json
{ "tags": ["html", "css"] }
```

```html
html, css / html + css
```

### `first`

<!-- renders -->
```jinja
{{ tags | first }} {{ "abc" | first }}
```

```json
{ "tags": ["html", "css", "js"] }
```

```html
html a
```

### `last`

<!-- renders -->
```jinja
{{ tags | last }} {{ "abc" | last }}
```

```json
{ "tags": ["html", "css", "js"] }
```

```html
js c
```

### `raw`

Prints HTML without escaping it. It must be the last filter, because other filters can only change text.

<!-- renders -->
```jinja
{{ page.body | raw }}
```

```json
{ "page": { "body": "<p><strong>Hi</strong></p>" } }
```

```html
<p><strong>Hi</strong></p>
```

## Lists

These filters return a new list and leave the original unchanged. They can be chained:
`posts | where("draft", false) | sort("date") | reverse | take(5)` gives the five newest posts that aren't drafts.

### `where`

Keeps the items whose field has the value. With only a field, it keeps the items where that field is true.

<!-- renders -->
```jinja
{% for post in posts | where("draft", false) %}{{ post.title }};{% endfor %} {% for post in posts | where("featured") %}{{ post.title }};{% endfor %}
```

```json
{
  "posts": [
    { "title": "A", "draft": false, "featured": true },
    { "title": "B", "draft": true },
    { "title": "C", "draft": false }
  ]
}
```

```html
A;C; A;
```

### `take`

<!-- renders -->
```jinja
{{ list | take(2) | join }}
```

```json
{ "list": [1, 2, 3, 4] }
```

```html
1, 2
```

### `skip`

<!-- renders -->
```jinja
{{ list | skip(1) | join }}
```

```json
{ "list": [1, 2, 3, 4] }
```

```html
2, 3, 4
```

### `sort`

Sorts numbers, text or dates, or the items by one of their fields. Text is sorted without caring about capital letters, items without a
value go last, and equal items keep their order. A list can't mix kinds of values.

<!-- renders -->
```jinja
{{ names | sort | join }} / {% for project in projects | sort("order") %}{{ project.title }};{% endfor %}
```

```json
{
  "names": ["banana", "Cherry", "apple"],
  "projects": [{ "title": "B", "order": 2 }, { "title": "Z" }, { "title": "A", "order": 1 }]
}
```

```html
apple, banana, Cherry / A;B;Z;
```

### `reverse`

<!-- renders -->
```jinja
{{ list | reverse | join }}
```

```json
{ "list": [1, 2, 3] }
```

```html
3, 2, 1
```

## Dates

### `date`

Dates are always written as `2026-11-18` in frontmatter, and the template decides how they look. The format is made of these parts, and
every other character is kept as it is:

| Part   | Gives          |
| ------ | -------------- |
| `yyyy` | `2026`         |
| `M`    | `3`            |
| `MM`   | `03`           |
| `MMM`  | `Mar`          |
| `MMMM` | `March`        |
| `d`    | `7`            |
| `dd`   | `07`           |

<!-- renders -->
```jinja
{{ page.date | date("MMM d, yyyy") }} / {{ page.date | date("dd.MM.yyyy") }} / {{ job.start | date("MMMM yyyy") }}
```

```json
{
  "page": { "date": { "text": "2026-03-07", "year": 2026, "month": 3, "day": 7 } },
  "job": { "start": { "text": "2024-06", "year": 2024, "month": 6 } }
}
```

```html
Mar 7, 2026 / 07.03.2026 / June 2024
```

Any other letter is a mistake, so `Today` can't silently turn into `To7ay`. Month names are in English. A date that is only a month, such
as the start of a job, has no day, so `d` and `dd` are a mistake there. A missing date gives nothing.

A date printed without the filter appears as it was written: `{{ page.date }}` gives `2026-03-07`.

## Your own filters

A filter is a plain function from a value to a new value. Your own filters are passed when compiling, and can also replace built-in ones.
They can take any number of arguments.

```ts
import { FilterError, compileTemplates } from "./src/template/index.ts";

const compiled = compileTemplates(files, {
  filters: {
    shout: (value) => {
      if (typeof value !== "string") throw new FilterError("shout needs text", "pass it some text");
      return `${value}!`;
    },
  },
});
```

A filter reports a mistake by throwing [`FilterError`](../../src/template/rendering/filter-types.ts) with a message and an optional hint.
Rendering turns it into problem [GS334](diagnostics.md) at the place where the filter was used, and continues with the rest of the template.
