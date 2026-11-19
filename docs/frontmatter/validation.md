# Validation

Parsing knows what a value _looks like_. Validation knows what it _should be_: a post needs a title and a real date. The rules are written as
**schemas**, small values that combine into bigger ones.

```ts
const post = object({
  title: text(),
  date: fullDate(),
  tags: withDefault(listOf(text()), []),
  draft: withDefault(boolean(), false),
});
```

## What a schema is

A [`Schema<T>`](../../src/frontmatter/validation/schema.ts) is an object with a `check` function. `T` is the type of the data it produces.

```ts
interface Schema<T> {
  readonly check: (value: FrontmatterValue, path: string) => Checked<T>;
  readonly whenMissing?: { readonly value: T };
}
```

`path` names the value in messages, such as `links[0].url`. The result is a [`Checked<T>`](../../src/frontmatter/validation/schema.ts): either the
valid value with any warnings, or the list of problems.

## The building blocks

| Schema                                                              | Accepts                           | Produces                  |
| ------------------------------------------------------------------- | --------------------------------- | ------------------------- |
| [`text`](../../src/frontmatter/validation/schema.ts)                | Text that isn't empty             | `string`                  |
| [`integer`](../../src/frontmatter/validation/schema.ts)             | A whole number                    | `number`                  |
| [`boolean`](../../src/frontmatter/validation/schema.ts)             | `true` or `false`                 | `boolean`                 |
| [`fullDate`](../../src/frontmatter/validation/schema.ts)            | A date with a day                 | `ContentDate`             |
| [`monthOrDate`](../../src/frontmatter/validation/schema.ts)         | A month or a date                 | `ContentDate`             |
| [`dateOrPresent`](../../src/frontmatter/validation/schema.ts)       | A month, a date or `present`      | `ContentDate \| "present"` |
| [`url`](../../src/frontmatter/validation/schema.ts)                 | A web address or a path           | `string`                  |
| [`choice`](../../src/frontmatter/validation/schema.ts)              | One of a fixed list of words      | A union of those words    |

These functions take a schema and return a new one:

| Function                                                      | Result                                              |
| ------------------------------------------------------------- | --------------------------------------------------- |
| [`listOf`](../../src/frontmatter/validation/schema.ts)        | A list whose items all pass the given schema        |
| [`object`](../../src/frontmatter/validation/schema.ts)        | A group of named fields, each with its own schema   |
| [`optional`](../../src/frontmatter/validation/schema.ts)      | The field may be left out, and is then `undefined`  |
| [`withDefault`](../../src/frontmatter/validation/schema.ts)   | The field may be left out, and then has this value  |
| [`withRule`](../../src/frontmatter/validation/schema.ts)      | Adds a rule across several fields of an object      |

## Types are inferred from the schema

The rules and the TypeScript type of the data are written once. [`Infer`](../../src/frontmatter/validation/schema.ts) extracts the type:

```ts
type Infer<S> = S extends Schema<infer T> ? T : never;
```

`object` applies it to each field with a mapped type, so the type of the `post` schema above is:

```ts
{
  readonly title: string;
  readonly date: ContentDate;
  readonly tags: readonly string[];
  readonly draft: boolean;
}
```

Adding a field to a schema adds it to the type, and code that uses a removed field stops compiling. `choice` keeps the exact words through a
`const` type parameter, so `choice("active", "paused")` produces `"active" | "paused"` rather than `string`.

## Reporting every problem

[`combine`](../../src/frontmatter/validation/schema.ts) collects the results of several checks and keeps every problem instead of stopping at the
first one. [`object`](../../src/frontmatter/validation/schema.ts) and [`listOf`](../../src/frontmatter/validation/schema.ts) both use it, so a
problem deep inside a list reaches the top. [`validate`](../../src/frontmatter/validation/schema.ts) then sorts everything into file order.

<!-- reports GS220 as project -->
```yaml
---
title: Gensane
links:
  - name: Documentation
---
```

```text
line 4, column 5: the required field "links[0].url" is missing
hint: add a line such as `url: ...`
```

## Noticing typos

Custom fields are allowed, so an unknown field isn't a mistake by itself. [`typoWarnings`](../../src/frontmatter/validation/schema.ts) only warns
when a field looks like a misspelling of a known field that this file hasn't used yet.

[`closestMatch`](../../src/diagnostics/closest-match.ts) makes that decision with
[`editDistance`](../../src/diagnostics/closest-match.ts), the number of single-character changes between two words. Swapping two
neighbouring letters counts as one change, because that is the most common typo. A word is close enough when the distance is at most a third of the
longer word, and always allows at least one change.

| Written  | Compared with | Distance | Allowed | Result                 |
| -------- | ------------- | -------- | ------- | ---------------------- |
| `titel`  | `title`       | 1        | 1       | Suggested              |
| `tag`    | `tags`        | 1        | 1       | Suggested              |
| `mood`   | `role`        | 3        | 1       | A custom field         |

## Rules across fields

Some rules need two fields at once. [`withRule`](../../src/frontmatter/validation/schema.ts) adds one to an object schema, and it only runs when every
field is valid on its own. [`endsAfterStart`](../../src/frontmatter/validation/content-types.ts) uses it for jobs and degrees.

## Suggesting a date

A date written the wrong way round is text to the parser, so the hint comes from [`dateHint`](../../src/frontmatter/validation/schema.ts). It suggests
a corrected date only when one number can't be a month, because it is above 12, and the corrected date exists.

<!-- reports GS221 as post -->
```yaml
---
title: A
date: 03-04-2026
---
```

```text
line 3, column 7: "date" must be a date, but "03-04-2026" is text
hint: write the date as YYYY-MM-DD, with the year first
```
