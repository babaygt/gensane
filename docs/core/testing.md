# Testing

The core is tested at several levels, because each level finds different kinds of mistakes.

| Level                | What it checks                                           | Where                                                                                  |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Content tests        | Types, URLs, slugs, excerpts, reading time               | [`load-content.test.ts`](../../src/core/content/load-content.test.ts), [`slugs.test.ts`](../../src/core/content/slugs.test.ts) |
| Site tests           | Pages, orders, tags, pagination, previous and next       | [`site-graph.test.ts`](../../src/core/site/site-graph.test.ts), [`order.test.ts`](../../src/core/site/order.test.ts) |
| Build tests          | What each template is given, and the files written       | [`build-site.test.ts`](../../src/core/build/build-site.test.ts)                         |
| Feed tests           | The whole feed and sitemap                               | [`feeds.test.ts`](../../src/core/feeds/feeds.test.ts), [`xml.test.ts`](../../src/core/feeds/xml.test.ts) |
| Link tests           | Links, images, parts of pages and public files           | [`check-links.test.ts`](../../src/core/links/check-links.test.ts)                       |
| Property-based tests | Rules that must hold for any site                        | [`site-graph.property.test.ts`](../../src/core/site/site-graph.property.test.ts), [`build-site.property.test.ts`](../../src/core/build/build-site.property.test.ts) |
| Architecture tests   | Module boundaries                                        | [`architecture.test.ts`](../../test/architecture/architecture.test.ts)                  |
| Documentation tests  | These pages match the code                               | [`core-docs.test.ts`](../../test/docs/core-docs.test.ts)                                |

```sh
pnpm test       # run everything
pnpm coverage   # run with a coverage report
pnpm check      # type check, lint, format check and tests
```

## Small sites as tests

Most tests build a small site from a few files given as text, and look at one page or one problem. The core reads no files, so a test
needs no folder on disk and no clean-up. A test that is about one template replaces only that one, and every other page uses a plain
template that prints its title.

## Property-based tests

[fast-check](https://fast-check.dev/) generates random sites and checks rules that must hold for all of them:

- Every published post is on the pages of the blog exactly once, in order, and no draft is.
- Each tag lists exactly the posts that have it.
- No two pages share a URL, and every page is written to exactly one file.
- Previous and next point at each other.
- The same files in any order give exactly the same site.
- `slugify` always gives a valid slug or nothing, and changes nothing the second time.
- Escaping XML leaves no special character in any text, and loses nothing.

## Whole files as the expected answer

The feed and sitemap tests compare the whole file, written out in the test, so any change to the output is visible. A real XML parser read
a generated feed and sitemap once, with ampersands, angle brackets and quotes in them, to check that they are well formed.

## Breaking the code on purpose

Each part was also tested by making small mistakes in a copy of the code and checking that a test fails for each one. These mistakes were
made by hand, so this is not a full mutation score, but every one that went unnoticed showed something:

| Part                     | Mistakes made | Caught at first | Afterwards                                                |
| ------------------------ | ------------- | --------------- | --------------------------------------------------------- |
| Content                  | 51            | 36              | All caught, after 4 pieces of code that did nothing were removed |
| Site                     | 48            | 33              | All caught, after 3 pieces of code that did nothing were removed |
| Building                 | 48            | 43              | All caught                                                |
| Feed and sitemap         | 42            | 35              | 40 of 41 caught; the last can't be reached                |
| Links                    | 37            | 25              | 35 of 36 caught; the last only changes speed              |

Some showed missing tests, such as an address with an `&` in it. Others showed tests whose expected answer was the same for the right and
the wrong code, which were rewritten so that the two answers differ.

## Documentation tests

The documentation is checked like code:

- Examples that build a site must write exactly the files shown, with exactly the content shown, and give no problem except the warning
  about a missing site address.
- Examples of a problem must report that code, with exactly the file, position, message and hint shown.
- Every problem code must be documented with an example.
- The table of pages must name the template of every kind of page, and the table of titles must match the code.
- Every link must point to a file that exists, and every linked name must exist in that file.
- Every source file must appear in the [code reference](code-reference.md).
