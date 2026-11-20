# Feed and sitemap

A site with an address in `site.url` also gets `feed.xml`, an [Atom](https://www.rfc-editor.org/rfc/rfc4287) feed that readers can
follow, and `sitemap.xml`, a [sitemap](https://www.sitemaps.org/protocol.html) for search engines. Both need full addresses, so without
`site.url` they are left out with a [warning](diagnostics.md).

## The feed

The feed has the 20 newest posts, with their full content and their tags. Its title comes from `site.title`, its subtitle from
`site.description`, and its author from `site.author`, which can be a name or a group with a `name`. Without a title, the host name of
the address is used, and without an author, the title. A site without posts has no feed.

<!-- builds -->
```markdown blog/2026-11-17-hello.md
---
title: Hello
date: 2026-11-17T09:30
description: The first post
tags: [testing]
---
Hi *there*
```

```json config
{ "site": { "title": "Ada's notes", "url": "https://example.com", "author": { "name": "Ada" } } }
```

```xml feed.xml
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Ada&apos;s notes</title>
  <link href="https://example.com/"/>
  <link rel="self" href="https://example.com/feed.xml"/>
  <id>https://example.com/</id>
  <updated>2026-11-17T09:30:00Z</updated>
  <author>
    <name>Ada</name>
  </author>
  <entry>
    <title>Hello</title>
    <link href="https://example.com/blog/hello/"/>
    <id>https://example.com/blog/hello/</id>
    <published>2026-11-17T09:30:00Z</published>
    <updated>2026-11-17T09:30:00Z</updated>
    <summary>The first post</summary>
    <content type="html">&lt;p&gt;Hi &lt;em&gt;there&lt;/em&gt;&lt;/p&gt;
</content>
    <category term="testing"/>
  </entry>
</feed>
```

A feed needs seconds and a time zone, so a time written without them gets `:00` and is read as UTC. `updated` is the post's `updated`
field, or else its date.

## The sitemap

The sitemap lists every page except the page for missing pages and the search page, with the last change of each post.

<!-- builds -->
```markdown blog/a.md
---
title: A
date: 2026-11-17
updated: 2026-11-20
---
```

```json config
{ "site": { "url": "https://ada.github.io/notes" } }
```

```xml sitemap.xml
<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://ada.github.io/notes/</loc>
  </url>
  <url>
    <loc>https://ada.github.io/notes/blog/</loc>
  </url>
  <url>
    <loc>https://ada.github.io/notes/blog/a/</loc>
    <lastmod>2026-11-20</lastmod>
  </url>
</urlset>
```

An address with a path, as on GitHub Pages, works: the URL of each page is added to it.

## Drafts

Drafts never appear in the feed or the sitemap, not even when the config shows drafts for a preview.
