---
title: Mutation testing in practice
date: 2026-10-20
description: Breaking your own code on purpose, to see whether the tests notice.
tags: [testing, mutation-testing]
---

A mutation test changes one small thing in the code, such as `>` into `>=`, and runs the tests. If they still pass, the change
"survived", and the tests don't check that line as well as they seemed to.

| Change             | Survived | What was missing         |
| ------------------ | -------: | ------------------------ |
| `>` into `>=`      |        3 | A test at the boundary   |
| A removed `return` |        1 | A test of the early exit |
| `&&` into `\|\|`   |        0 | Nothing                  |

> [!CAUTION]
> Not every survivor is a gap. Some changes don't change what the code does, and no test can catch them.

Run it on the code you changed, not on everything: a full run can take longer than the tests themselves.
