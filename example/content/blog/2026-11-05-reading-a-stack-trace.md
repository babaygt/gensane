---
title: Reading a stack trace from the bottom
date: 2026-11-05
description: The line that failed is at the top; the reason is often at the bottom.
tags: [debugging]
---

The top line of a stack trace says _where_ it failed. The lines below say _how it got there_, and the cause is usually the
first line in your own code, not the deepest one in a library.

> Read the trace like a story told backwards: the end comes first.

> [!IMPORTANT]
> A trace from a build tool often has two parts: the tool's own frames, then yours. Skip to the first file you wrote.
