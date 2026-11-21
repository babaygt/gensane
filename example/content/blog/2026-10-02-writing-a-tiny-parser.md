---
title: Writing a tiny parser by hand
date: 2026-10-02
description: A recursive descent parser for arithmetic, in less than a hundred lines.
tags: [compilers, parsing, typescript]
---

Parser generators are powerful, but a hand-written parser is easier to read, to debug and to give good error messages.

## The grammar

```text
expression = term { ("+" | "-") term }
term       = factor { ("*" | "/") factor }
factor     = number | "(" expression ")"
```

Each rule becomes one function, and each `{ }` becomes a loop:

```ts
function expression(): Node {
  let left = term();
  while (peek() === "+" || peek() === "-") {
    const operator = next();
    left = { operator, left, right: term() };
  }
  return left;
}
```

> [!WARNING]
> A rule that starts with itself, such as `expression = expression "+" term`, loops forever in this style. Rewrite it as a loop.

## Errors with a place

A good message says where the problem is. Keep the position of every token, and point at it:

```console
$ calc "1 + (2 * 3"
error: expected ")" at 1:10
```

That is most of the difference between a parser people like and one they put up with. The [first post](/blog/property-based-testing/)
shows how to test one.
