---
title: Why my site has no server
date: 2026-11-18
description: Plain files, built once, served from anywhere.
tags: [web, compilers]
cover: /images/build-pipeline.svg
---

A static site is a compiler's output: Markdown in, HTML out. Nothing runs when someone reads it, so there is nothing to patch,
scale or keep awake.

![Markdown files go into the generator, which writes HTML, CSS and a search index](/images/build-pipeline.svg)

The search box still works: the site ships a small index, and the browser searches it.
