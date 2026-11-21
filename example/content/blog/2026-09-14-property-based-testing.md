---
title: Property-based testing, from the first property to the last bug
date: 2026-09-14
updated: 2026-10-01
description: How to find properties worth testing, and what they found in a parser.
tags: [testing, property-based-testing, typescript]
---

An example-based test checks one input. A property-based test states something that holds for **every** input, and lets the
computer look for the one that breaks it.

<!-- more -->

## A first property

The easiest properties come in pairs of functions that undo each other. Whatever a printer writes, the parser must read back:

```ts
import fc from "fast-check";

fc.assert(
  fc.property(arbitraryDocument(), (document) => {
    expect(parse(print(document))).toEqual(document);
  }),
);
```

> [!TIP]
> Start with a round trip. It needs no knowledge of the right answer, only two functions that should agree.

## Where properties come from

| Kind       | Example                               | How strong |
| :--------- | :------------------------------------ | :--------: |
| Round trip | `parse(print(x))` is `x`              |    High    |
| Invariant  | A sorted list has the same items      |   Medium   |
| Model      | A map behaves like a list of pairs    |    High    |
| No crash   | Any input gives a result or a problem |    Low     |

A property that only says "it doesn't crash" still finds real bugs[^crash], but it can't tell a wrong answer from a right one.

## What it found

1. A heading with only spaces after the `#` lost its text.
2. Two footnotes with the same label were both kept.
3. A table with an empty last cell printed one cell too few.

> [!NOTE]
> Every one of these was in code with full line coverage. Coverage says a line ran, not that it was right.

## Shrinking

When a property fails, the library makes the input smaller until it can't any more, so the failure you read is the smallest one:
not a document of 200 lines, but `"#  "`.

## What's next

- [x] Round trips for the parser and the printer
- [x] A model for the symbol table
- [ ] Properties for the type checker

[^crash]: Most of the crashes were inputs nobody would type, which is exactly why nobody had typed them.
