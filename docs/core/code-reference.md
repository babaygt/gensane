# Code reference

Every source file of the core and its most important functions. Select a name to open its file, then search for that name. Names
starting with `#` are private methods of a class.

## Public API and shared types

### [`src/core/index.ts`](../../src/core/index.ts)

The public entry point of the module.

### [`src/core/build/build-site.ts`](../../src/core/build/build-site.ts)

The whole build, from text to files.

| Name                                                   | Purpose                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| [`buildSite`](../../src/core/build/build-site.ts)      | Runs every step, and stops at the first step with errors    |
| [`SiteConfig`](../../src/core/build/build-site.ts)     | The settings of a site                                      |
| [`SiteInput`](../../src/core/build/build-site.ts)      | The content, the templates, the config and the public files |
| [`BuiltSite`](../../src/core/build/build-site.ts)      | The files to write, sorted by path, and the warnings        |
| [`withoutRepeats`](../../src/core/build/build-site.ts) | Reports a mistake that repeats on many pages once           |

### [`src/core/build/base-path.ts`](../../src/core/build/base-path.ts)

| Name                                                   | Purpose                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [`withBasePath`](../../src/core/build/base-path.ts)    | Adds the site's path to `href`, `src` and `srcset` that start at `/` |
| [`AttributeScanner`](../../src/core/build/base-path.ts) | Finds where attribute values start, without parsing all of HTML     |

### [`src/core/diagnostic-codes.ts`](../../src/core/diagnostic-codes.ts)

| Name                                              | Purpose                           |
| ------------------------------------------------- | --------------------------------- |
| [`CoreCodes`](../../src/core/diagnostic-codes.ts) | All problem codes, GS401 to GS415 |

### [`src/core/problems.ts`](../../src/core/problems.ts)

| Name                                        | Purpose                                                  |
| ------------------------------------------- | -------------------------------------------------------- |
| [`problem`](../../src/core/problems.ts)     | Makes a problem                                          |
| [`startOf`](../../src/core/problems.ts)     | The start of a file, for problems without a better place |
| [`inFileOrder`](../../src/core/problems.ts) | Sorts problems by file, then by position                 |

## Content

### [`src/core/content/load-content.ts`](../../src/core/content/load-content.ts)

Content files to entries.

| Name                                                      | Purpose                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| [`loadContent`](../../src/core/content/load-content.ts)   | Entry point                                                           |
| [`ContentLoader`](../../src/core/content/load-content.ts) | Reads every file, in the order of their paths                         |
| [`#loadFile`](../../src/core/content/load-content.ts)     | The type, the frontmatter, the body, the slug and the URL of one file |
| [`moveBy`](../../src/core/content/load-content.ts)        | Moves body warnings below the frontmatter                             |
| [`#checkDate`](../../src/core/content/load-content.ts)    | Warns about a file name date that isn't the post's day                |
| [`#checkUrls`](../../src/core/content/load-content.ts)    | Two files with one URL                                                |

### [`src/core/content/entries.ts`](../../src/core/content/entries.ts)

| Name                                                | Purpose                                              |
| --------------------------------------------------- | ---------------------------------------------------- |
| [`ContentEntry`](../../src/core/content/entries.ts) | A union that ties each type of content to its fields |
| [`EntryOf`](../../src/core/content/entries.ts)      | The entries of one type                              |

### [`src/core/content/slugs.ts`](../../src/core/content/slugs.ts)

| Name                                                  | Purpose                                     |
| ----------------------------------------------------- | ------------------------------------------- |
| [`slugify`](../../src/core/content/slugs.ts)          | Lowercase letters, digits and single dashes |
| [`isValidSlug`](../../src/core/content/slugs.ts)      | Checks a written slug                       |
| [`slugFromFileName`](../../src/core/content/slugs.ts) | Leaves out a date at the start              |

### [`src/core/content/folders.ts`](../../src/core/content/folders.ts)

| Name                                            | Purpose                               |
| ----------------------------------------------- | ------------------------------------- |
| [`FOLDERS`](../../src/core/content/folders.ts)  | The type of content each folder holds |
| [`folderOf`](../../src/core/content/folders.ts) | The folder of a type of content       |

### [`src/core/content/new-entry.ts`](../../src/core/content/new-entry.ts)

What `gensane new` writes.

| Name                                                     | Purpose                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`newEntry`](../../src/core/content/new-entry.ts)        | The path and text of a new content file, and the fields left to fill in |
| [`yamlText`](../../src/core/content/new-entry.ts)        | Puts a title in quotes only when frontmatter would read it differently  |
| [`NEW_ENTRY_TYPES`](../../src/core/content/new-entry.ts) | The types `gensane new` can write                                       |

### [`src/core/content/summary.ts`](../../src/core/content/summary.ts)

| Name                                                 | Purpose                                        |
| ---------------------------------------------------- | ---------------------------------------------- |
| [`excerptOf`](../../src/core/content/summary.ts)     | Before the more marker, or the first paragraph |
| [`readingTimeOf`](../../src/core/content/summary.ts) | Words divided by 200, at least 1 minute        |

## Site

### [`src/core/site/site-graph.ts`](../../src/core/site/site-graph.ts)

Entries to routes.

| Name                                                   | Purpose                                      |
| ------------------------------------------------------ | -------------------------------------------- |
| [`buildSiteGraph`](../../src/core/site/site-graph.ts)  | Entry point                                  |
| [`listRoutes`](../../src/core/site/site-graph.ts)      | The pages of posts, tags, projects and talks |
| [`GENERATED_PAGES`](../../src/core/site/site-graph.ts) | URLs that a page can't take                  |

### [`src/core/site/sections.ts`](../../src/core/site/sections.ts)

| Name                                                  | Purpose                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| [`sectionsOf`](../../src/core/site/sections.ts)       | Every section of the site, from the folders of `pages/`          |
| [`readingOrder`](../../src/core/site/sections.ts)     | A section's pages in the order a reader goes through them        |
| [`foldersAbove`](../../src/core/site/sections.ts)     | The folders from the section down to a page, for breadcrumbs     |
| [`foldersOf`](../../src/core/site/sections.ts)        | The folders a page is in                                         |
| [`SectionFolder`](../../src/core/site/sections.ts)    | A folder of a section, with its own page and its items           |

### [`src/core/site/routes.ts`](../../src/core/site/routes.ts)

| Name                                          | Purpose                            |
| --------------------------------------------- | ---------------------------------- |
| [`Route`](../../src/core/site/routes.ts)      | A union of every kind of page      |
| [`TEMPLATES`](../../src/core/site/routes.ts)  | The template for each kind of page |
| [`Pagination`](../../src/core/site/routes.ts) | One page of a list                 |
| [`Tag`](../../src/core/site/routes.ts)        | A tag and its posts                |

### [`src/core/site/collections.ts`](../../src/core/site/collections.ts)

| Name                                                 | Purpose                                     |
| ---------------------------------------------------- | ------------------------------------------- |
| [`collect`](../../src/core/site/collections.ts)      | Drafts, and the order of each list          |
| [`TagCollector`](../../src/core/site/collections.ts) | Groups posts by tag, and chooses a spelling |

### [`src/core/site/order.ts`](../../src/core/site/order.ts)

| Name                                           | Purpose                                    |
| ---------------------------------------------- | ------------------------------------------ |
| [`compareText`](../../src/core/site/order.ts)  | Without caring about capital letters first |
| [`compareDates`](../../src/core/site/order.ts) | A month before the days in it              |
| [`compareOrder`](../../src/core/site/order.ts) | Entries with an `order` first              |

### [`src/core/site/pagination.ts`](../../src/core/site/pagination.ts)

| Name                                            | Purpose                        |
| ----------------------------------------------- | ------------------------------ |
| [`paginate`](../../src/core/site/pagination.ts) | Splits a list into pages       |
| [`pageUrl`](../../src/core/site/pagination.ts)  | `/blog/`, then `/blog/page/2/` |

## Rendering

### [`src/core/build/page-data.ts`](../../src/core/build/page-data.ts)

| Name                                                     | Purpose                                    |
| -------------------------------------------------------- | ------------------------------------------ |
| [`TemplateVariables`](../../src/core/build/page-data.ts) | The variables each template is given       |
| [`#page`](../../src/core/build/page-data.ts)             | An entry as `page`, converted once         |
| [`DEFAULT_TITLES`](../../src/core/build/page-data.ts)    | The title of a page without a content file |

### [`src/core/build/output-paths.ts`](../../src/core/build/output-paths.ts)

| Name                                                 | Purpose                                   |
| ---------------------------------------------------- | ----------------------------------------- |
| [`outputPath`](../../src/core/build/output-paths.ts) | `/blog/hello/` to `blog/hello/index.html` |

## Feed and sitemap

### [`src/core/feeds/feed-files.ts`](../../src/core/feeds/feed-files.ts)

| Name                                              | Purpose                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| [`feedFiles`](../../src/core/feeds/feed-files.ts) | Decides whether to write them, and checks `site.url` |

### [`src/core/feeds/atom.ts`](../../src/core/feeds/atom.ts)

| Name                                        | Purpose                     |
| ------------------------------------------- | --------------------------- |
| [`atomFeed`](../../src/core/feeds/atom.ts)  | The 20 newest posts         |
| [`FEED_SIZE`](../../src/core/feeds/atom.ts) | How many posts the feed has |

### [`src/core/feeds/sitemap.ts`](../../src/core/feeds/sitemap.ts)

| Name                                         | Purpose                                     |
| -------------------------------------------- | ------------------------------------------- |
| [`sitemap`](../../src/core/feeds/sitemap.ts) | Every page except the one for missing pages |

### [`src/core/feeds/site-address.ts`](../../src/core/feeds/site-address.ts)

| Name                                                    | Purpose                     |
| ------------------------------------------------------- | --------------------------- |
| [`siteAddressOf`](../../src/core/feeds/site-address.ts) | Reads and checks `site.url` |
| [`absoluteUrl`](../../src/core/feeds/site-address.ts)   | A full address              |

### [`src/core/feeds/feed-dates.ts`](../../src/core/feeds/feed-dates.ts)

| Name                                                  | Purpose                                |
| ----------------------------------------------------- | -------------------------------------- |
| [`dateTime`](../../src/core/feeds/feed-dates.ts)      | With seconds and a time zone           |
| [`dayOrDateTime`](../../src/core/feeds/feed-dates.ts) | A day on its own when there is no time |

### [`src/core/feeds/xml.ts`](../../src/core/feeds/xml.ts)

| Name                                       | Purpose                |
| ------------------------------------------ | ---------------------- |
| [`escapeXml`](../../src/core/feeds/xml.ts) | Makes text safe in XML |

## Links

### [`src/core/links/check-links.ts`](../../src/core/links/check-links.ts)

Checks that links and images lead somewhere.

| Name                                                       | Purpose                                               |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| [`checkLinks`](../../src/core/links/check-links.ts)        | Entry point                                           |
| [`LinkChecker`](../../src/core/links/check-links.ts)       | The checks                                            |
| [`#checkLink`](../../src/core/links/check-links.ts)        | One link: its page or file, then the part of the page |
| [`resolve`](../../src/core/links/check-links.ts)           | Resolves a relative link from its page                |
| [`#fileOf`](../../src/core/links/check-links.ts)           | Finds the file a URL leads to                         |
| [`#checkTemplate`](../../src/core/links/check-links.ts)    | Links written out in full in a template               |
| [`#spanOf`](../../src/core/links/check-links.ts)           | Finds a link in the file it was written in            |
| [`#checkPublicFiles`](../../src/core/links/check-links.ts) | A public file that would replace a written one        |

## Theme

### [`src/core/theme/theme-settings.ts`](../../src/core/theme/theme-settings.ts)

The settings of the default theme.

| Name                                                      | Purpose                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| [`ThemeSettings`](../../src/core/theme/theme-settings.ts) | The settings as a site writes them                             |
| [`Theme`](../../src/core/theme/theme-settings.ts)         | Every setting with its default, as templates see it as `theme` |
| [`themeOf`](../../src/core/theme/theme-settings.ts)       | Fills in the defaults                                          |
| [`THEME_CHOICES`](../../src/core/theme/theme-settings.ts) | Every choice of every setting                                  |

### [`src/core/theme/palettes.ts`](../../src/core/theme/palettes.ts)

| Name                                           | Purpose                                             |
| ---------------------------------------------- | --------------------------------------------------- |
| [`PALETTES`](../../src/core/theme/palettes.ts) | Six palettes, each with a light and a dark side     |
| [`Colors`](../../src/core/theme/palettes.ts)   | Background, surface, text, muted, border and accent |

### [`src/core/theme/theme-css.ts`](../../src/core/theme/theme-css.ts)

| Name                                                  | Purpose                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| [`themeCss`](../../src/core/theme/theme-css.ts)       | The settings as CSS custom properties, in `assets/settings.css` |
| [`THEME_CSS_PATH`](../../src/core/theme/theme-css.ts) | Where that file is written                                      |

### [`src/core/theme/favicon.ts`](../../src/core/theme/favicon.ts)

| Name                                                 | Purpose                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| [`faviconSvg`](../../src/core/theme/favicon.ts)      | The icon: a letter in the background color on the accent color  |
| [`initialOf`](../../src/core/theme/favicon.ts)       | The first letter of the site's title                             |
| [`FAVICON_PATH`](../../src/core/theme/favicon.ts)    | Where the made icon is written, `assets/favicon.svg`             |
| [`OWN_FAVICONS`](../../src/core/theme/favicon.ts)    | The site's own icons in `public/`, which are used instead        |

### [`src/core/theme/contrast.ts`](../../src/core/theme/contrast.ts)

| Name                                                    | Purpose                                                   |
| ------------------------------------------------------- | --------------------------------------------------------- |
| [`contrast`](../../src/core/theme/contrast.ts)          | How readable one color is on another, as WCAG measures it |
| [`luminance`](../../src/core/theme/contrast.ts)         | How bright a color looks                                  |
| [`READABLE_CONTRAST`](../../src/core/theme/contrast.ts) | 4.5 to 1, the level AA for text                           |

## llms.txt

### [`src/core/llms/llms-files.ts`](../../src/core/llms/llms-files.ts)

| Name                                           | Purpose                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| [`llmsFiles`](../../src/core/llms/llms-files.ts) | `llms.txt` and a Markdown copy of each page that isn't a draft            |
| [`LLMS_PATH`](../../src/core/llms/llms-files.ts) | Where `llms.txt` is written in the site                                   |

## Search

### [`src/core/search/search-index.ts`](../../src/core/search/search-index.ts)

| Name                                                       | Purpose                                               |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| [`searchIndex`](../../src/core/search/search-index.ts)     | The index the search page looks words up in           |
| [`searchDocuments`](../../src/core/search/search-index.ts) | Every post, project, talk and page that isn't a draft |
| [`SearchDocument`](../../src/core/search/search-index.ts)  | What the index holds of one page                      |

### [`src/core/search/words.ts`](../../src/core/search/words.ts)

| Name                                        | Purpose                                                     |
| ------------------------------------------- | ----------------------------------------------------------- |
| [`wordsOf`](../../src/core/search/words.ts) | Lowercase words without accents, at least 2 long, each once |
| [`textOf`](../../src/core/search/words.ts)  | The text of some HTML, without its tags                     |
