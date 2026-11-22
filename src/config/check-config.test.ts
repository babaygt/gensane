import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../diagnostics/index.ts";
import { ConfigCodes, checkConfig } from "./index.ts";

const FILE = "gensane.config.ts";

/** The problems of a config, as the parts a test cares about. */
function problemsOf(value: unknown) {
  const result = checkConfig(value, FILE);
  const problems: readonly Diagnostic[] = result.ok ? result.value.warnings : result.error;
  return problems.map(({ code, severity, message, hint }) => ({ code, severity, message, hint }));
}

function messagesOf(value: unknown): string[] {
  return problemsOf(value).map(({ message }) => message);
}

const shout = (value: unknown) => String(value).toUpperCase();

describe("a config that is right", () => {
  it("accepts an empty config", () => {
    expect(checkConfig({}, FILE)).toEqual({ ok: true, value: { config: {}, warnings: [] } });
  });

  it("accepts every setting, and gives the config back as it is", () => {
    const config = {
      site: {
        title: "Ada's notes",
        url: "https://example.com",
        description: "Notes",
        author: { name: "Ada", email: "ada@example.com" },
      },
      perPage: 5,
      markdown: { rawHtml: "escape", headingIds: false },
      filters: { shout },
      llms: true,
    };
    const result = checkConfig(config, FILE);
    expect(result).toEqual({ ok: true, value: { config, warnings: [] } });
    expect(result.ok && result.value.config.filters?.["shout"]).toBe(shout);
  });

  it("accepts an author written as a name", () => {
    expect(problemsOf({ site: { author: "Ada" } })).toEqual([]);
  });

  it("keeps settings of the site it doesn't know, for the templates", () => {
    const config = { site: { github: "ada", links: [{ name: "Blog", url: "/blog/" }] } };
    expect(checkConfig(config, FILE)).toEqual({ ok: true, value: { config, warnings: [] } });
  });
});

describe("a file that doesn't export settings", () => {
  it("reports a config without a default export", () => {
    expect(problemsOf(undefined)).toEqual([
      {
        code: ConfigCodes.noSettings,
        severity: "error",
        message: "the config doesn't export its settings",
        hint: "end the config with `export default defineConfig({ ... })`",
      },
    ]);
  });

  it.each([
    [null, "it is null"],
    [[], "it is a list"],
    ["site", '"site" is text'],
    [10, "10 is a number"],
    [shout, "it is a function"],
  ])("reports a config that exports %s", (value, found) => {
    expect(problemsOf(value)).toEqual([
      {
        code: ConfigCodes.noSettings,
        severity: "error",
        message: `the config must export a group of settings, but ${found}`,
        hint: "end the config with `export default defineConfig({ ... })`",
      },
    ]);
  });
});

describe("settings it doesn't know", () => {
  it("suggests the setting that is closest", () => {
    expect(problemsOf({ perpage: 5 })).toEqual([
      {
        code: ConfigCodes.unknownSetting,
        severity: "error",
        message: '"perpage" is not a setting',
        hint: 'did you mean "perPage"?',
      },
    ]);
  });

  it("lists the settings when none is close", () => {
    expect(problemsOf({ colours: "blue" })).toEqual([
      {
        code: ConfigCodes.unknownSetting,
        severity: "error",
        message: '"colours" is not a setting',
        hint: "the settings are site, perPage, markdown, filters, theme and llms",
      },
    ]);
  });

  it("knows the settings of markdown", () => {
    expect(problemsOf({ markdown: { rawhtml: "escape" } })).toEqual([
      {
        code: ConfigCodes.unknownSetting,
        severity: "error",
        message: '"markdown.rawhtml" is not a setting',
        hint: 'did you mean "rawHtml"?',
      },
    ]);
  });

  it("lists the settings of markdown when none is close", () => {
    expect(problemsOf({ markdown: { tables: true } })[0]?.hint).toBe(
      "the settings of markdown are rawHtml, headingIds and highlight",
    );
  });

  it("warns about a site setting that looks misspelled, because the templates would not see it", () => {
    expect(problemsOf({ site: { titel: "Ada's notes" } })).toEqual([
      {
        code: ConfigCodes.misspelledSiteSetting,
        severity: "warning",
        message: '"site.titel" is not a known setting',
        hint: 'did you mean "title"? Other settings of the site are fine, for the templates',
      },
    ]);
  });

  it("warns about a misspelled profile, which the theme would not show", () => {
    expect(problemsOf({ site: { githb: "ada" } })).toEqual([
      {
        code: ConfigCodes.misspelledSiteSetting,
        severity: "warning",
        message: '"site.githb" is not a known setting',
        hint: 'did you mean "github"? Other settings of the site are fine, for the templates',
      },
    ]);
  });

  it("knows every profile, so none is mistaken for a misspelling", () => {
    const profiles = { github: "a", gitlab: "a", codeberg: "a", mastodon: "https://m.example/@a" };
    const more = { bluesky: "a.example.com", linkedin: "a", email: "a@example.com" };
    expect(problemsOf({ site: { ...profiles, ...more } })).toEqual([]);
  });

  it("leaves settings of the site's own alone, even near a profile, once that profile is there", () => {
    expect(problemsOf({ site: { github: "ada", github2: "ada-work", twitter: "ada" } })).toEqual(
      [],
    );
  });

  it("doesn't suggest a site setting that is already there", () => {
    expect(problemsOf({ site: { title: "A", titel: "B" } })).toEqual([]);
  });

  it("gives back the config with its warnings", () => {
    const result = checkConfig({ site: { titel: "A" } }, FILE);
    expect(result.ok && result.value.warnings.length).toBe(1);
  });
});

describe("values of the wrong kind", () => {
  it.each([
    ["10", '"perPage" must be a whole number above 0, but "10" is text'],
    [0, '"perPage" must be a whole number above 0, but 0 is a number'],
    [-1, '"perPage" must be a whole number above 0, but -1 is a number'],
    [2.5, '"perPage" must be a whole number above 0, but 2.5 is a number'],
    [Number.NaN, '"perPage" must be a whole number above 0, but NaN is a number'],
    [Infinity, '"perPage" must be a whole number above 0, but Infinity is a number'],
  ])("reports perPage: %s", (perPage, message) => {
    expect(problemsOf({ perPage })).toEqual([
      {
        code: ConfigCodes.wrongValue,
        severity: "error",
        message,
        hint: "write a number such as 10",
      },
    ]);
  });

  it.each([
    [{ site: "Ada" }, '"site" must be a group of settings, but "Ada" is text'],
    [{ site: { title: 5 } }, '"site.title" must be text, but 5 is a number'],
    [{ site: { url: true } }, '"site.url" must be text, but true is true or false'],
    [{ site: { description: ["a"] } }, '"site.description" must be text, but it is a list'],
    [{ site: { title: {} } }, '"site.title" must be text, but it is a group of settings'],
    [{ site: { github: 5 } }, '"site.github" must be text, but 5 is a number'],
    [{ llms: "yes" }, '"llms" must be true or false, but "yes" is text'],
    [{ site: { email: ["a@example.com"] } }, '"site.email" must be text, but it is a list'],
    [
      { site: { author: 5 } },
      '"site.author" must be text or a group of settings with a "name", but 5 is a number',
    ],
    [{ site: { author: {} } }, '"site.author.name" must be text, but it is missing'],
    [{ site: { author: { name: null } } }, '"site.author.name" must be text, but it is null'],
    [{ markdown: [] }, '"markdown" must be a group of settings, but it is a list'],
    [
      { markdown: { rawHtml: "strip" } },
      '"markdown.rawHtml" must be "allow" or "escape", but "strip" is text',
    ],
    [
      { markdown: { headingIds: "yes" } },
      '"markdown.headingIds" must be true or false, but "yes" is text',
    ],
    [{ filters: shout }, '"filters" must be a group of settings, but it is a function'],
    [{ filters: { shout: "loud" } }, '"filters.shout" must be a function, but "loud" is text'],
  ])("reports %j", (config, message) => {
    expect(messagesOf(config)).toEqual([message]);
    expect(problemsOf(config)[0]?.code).toBe(ConfigCodes.wrongValue);
  });

  it.each([
    ["a big number", 10n, "10 is a number"],
    ["a symbol", Symbol("ten"), "it is a symbol"],
  ])("reports perPage as %s", (_, perPage, found) => {
    expect(messagesOf({ perPage })).toEqual([
      `"perPage" must be a whole number above 0, but ${found}`,
    ]);
  });

  it("reports a filter that a template couldn't name", () => {
    expect(problemsOf({ filters: { "to-upper": shout } })).toEqual([
      {
        code: ConfigCodes.wrongValue,
        severity: "error",
        message: '"to-upper" can\'t be the name of a filter, which only has letters, digits and _',
        hint: 'name it "to_upper"',
      },
    ]);
  });

  it("suggests a filter name that doesn't start with a digit", () => {
    expect(problemsOf({ filters: { "1st": shout } })[0]?.hint).toBe('name it "_1st"');
  });
});

describe("where problems are", () => {
  it("reports every problem at once, in the order of the settings", () => {
    expect(messagesOf({ perPage: 0, site: { title: 5 }, colour: "blue" })).toEqual([
      '"perPage" must be a whole number above 0, but 0 is a number',
      '"site.title" must be text, but 5 is a number',
      '"colour" is not a setting',
    ]);
  });

  it("points every problem at the start of the config file, which has no line numbers once it is loaded", () => {
    const result = checkConfig({ perPage: 0, colour: "blue" }, "site/gensane.config.mjs");
    const spans = result.ok ? [] : result.error.map(({ span }) => span);
    const start = { line: 1, column: 1, offset: 0 };
    expect(spans).toEqual([
      { file: "site/gensane.config.mjs", start, end: start },
      { file: "site/gensane.config.mjs", start, end: start },
    ]);
  });
});

describe("any config", () => {
  const text = fc.string();
  const validConfig = fc.record(
    {
      site: fc.record(
        {
          title: text,
          url: text,
          description: text,
          author: fc.oneof(text, fc.record({ name: text })),
        },
        { requiredKeys: [] },
      ),
      perPage: fc.integer({ min: 1, max: 1000 }),
      markdown: fc.record(
        { rawHtml: fc.constantFrom("allow", "escape"), headingIds: fc.boolean() },
        { requiredKeys: [] },
      ),
      filters: fc.dictionary(fc.stringMatching(/^[A-Za-z_]\w{0,8}$/), fc.constant(shout)),
    },
    { requiredKeys: [] },
  );

  it("that is right is accepted and given back as it is", () => {
    fc.assert(
      fc.property(validConfig, (config) => {
        expect(checkConfig(config, FILE)).toEqual({ ok: true, value: { config, warnings: [] } });
      }),
    );
  });

  it("with one more setting gets exactly one problem, about that setting", () => {
    const known = new Set(["site", "perPage", "markdown", "filters"]);
    const unknownName = fc.string({ minLength: 1 }).filter((name) => !known.has(name));
    fc.assert(
      fc.property(validConfig, unknownName, fc.anything(), (config, name, value) => {
        const problems = problemsOf({ ...config, [name]: value });
        expect(problems.map(({ code, message }) => [code, message])).toEqual([
          [ConfigCodes.unknownSetting, `${JSON.stringify(name)} is not a setting`],
        ]);
      }),
    );
  });

  it("never makes the check throw", () => {
    fc.assert(
      fc.property(fc.anything({ withNullPrototype: true, withObjectString: true }), (value) => {
        expect(() => checkConfig(value, FILE)).not.toThrow();
        expect(() =>
          checkConfig({ site: value, markdown: value, filters: value, perPage: value }, FILE),
        ).not.toThrow();
      }),
    );
  });
});

describe("markdown.highlight", () => {
  it("accepts a function, or false", () => {
    expect(problemsOf({ markdown: { highlight: () => undefined } })).toEqual([]);
    expect(problemsOf({ markdown: { highlight: false } })).toEqual([]);
  });

  it("refuses anything else", () => {
    expect(messagesOf({ markdown: { highlight: "shiki" } })).toEqual([
      '"markdown.highlight" must be a function, or false, but "shiki" is text',
    ]);
  });
});

describe("the theme", () => {
  it("accepts every setting", () => {
    const theme = {
      palette: "nord",
      accent: "#3b5f8f",
      colorScheme: "light",
      font: "serif",
      width: "wide",
      blog: { layout: "grid" },
      home: { sections: ["recent-posts", "intro"] },
      toc: false,
    };
    expect(problemsOf({ theme })).toEqual([]);
  });

  it.each([
    [
      { palette: "nordic" },
      '"theme.palette" must be "default", "paper", "nord", "solarized", "gruvbox" or "midnight", but "nordic" is text',
      'did you mean "nord"?',
    ],
    [
      { colorScheme: "system" },
      '"theme.colorScheme" must be "auto", "light" or "dark", but "system" is text',
      'write "auto", "light" or "dark"',
    ],
    [
      { font: "serrif" },
      '"theme.font" must be "sans", "serif" or "mono", but "serrif" is text',
      'did you mean "serif"?',
    ],
    [
      { width: 900 },
      '"theme.width" must be "narrow", "normal" or "wide", but 900 is a number',
      'write "narrow", "normal" or "wide"',
    ],
    [
      { blog: { layout: "cards" } },
      '"theme.blog.layout" must be "list" or "grid", but "cards" is text',
      'write "list" or "grid"',
    ],
    [{ toc: "yes" }, '"theme.toc" must be true or false, but "yes" is text', "write true or false"],
    [
      { accent: "purple" },
      '"theme.accent" must be a color such as "#6d5dfc", but "purple" is text',
      "write the color as # and 3 or 6 hexadecimal digits",
    ],
    [
      { home: { sections: "intro" } },
      '"theme.home.sections" must be a list, but "intro" is text',
      'write a list, such as ["intro", "recent-posts"]',
    ],
    [
      { home: { sections: ["intro", "blog"] } },
      '"theme.home.sections[1]" must be "intro", "recent-posts", "featured-projects" or "talks", but "blog" is text',
      'write "intro", "recent-posts", "featured-projects" or "talks"',
    ],
    [
      { home: { sections: ["talks", "intro", "talks"] } },
      '"theme.home.sections" has "talks" more than once',
      "list each part of the home page once",
    ],
    [
      { blog: "grid" },
      '"theme.blog" must be a group of settings, but "grid" is text',
      "write the settings between { and }",
    ],
  ])("reports theme %j", (theme, message, hint) => {
    expect(
      problemsOf({ theme }).map((found) => ({
        code: found.code,
        message: found.message,
        hint: found.hint,
      })),
    ).toEqual([{ code: ConfigCodes.wrongValue, message, hint }]);
  });

  it.each([
    [
      { colours: "blue" },
      '"theme.colours" is not a setting',
      "the settings of theme are palette, accent, colorScheme, font, width, blog, home and toc",
    ],
    [
      { blog: { columns: 2 } },
      '"theme.blog.columns" is not a setting',
      "the settings of theme.blog are layout",
    ],
    [{ fonts: "serif" }, '"theme.fonts" is not a setting', 'did you mean "font"?'],
  ])("reports a setting of the theme it doesn't know: %j", (theme, message, hint) => {
    expect(problemsOf({ theme })).toEqual([
      { code: ConfigCodes.unknownSetting, severity: "error", message, hint },
    ]);
  });

  describe("an accent of the site's own", () => {
    it("warns when it is hard to read on the light side, and on the dark side", () => {
      expect(problemsOf({ theme: { accent: "#7a7a7a" } })).toEqual([
        {
          code: ConfigCodes.hardToRead,
          severity: "warning",
          message:
            '"theme.accent" is hard to read in the light colors of the "default" palette: 3.9 to 1, and text needs 4.5 to 1',
          hint: "choose a darker color, or leave accent out to use the palette's own",
        },
        {
          code: ConfigCodes.hardToRead,
          severity: "warning",
          message:
            '"theme.accent" is hard to read in the dark colors of the "default" palette: 3.8 to 1, and text needs 4.5 to 1',
          hint: "choose a lighter color, or leave accent out to use the palette's own",
        },
      ]);
    });

    it("is only checked on the side the site uses", () => {
      expect(problemsOf({ theme: { accent: "#ffd400", colorScheme: "dark" } })).toEqual([]);
      expect(problemsOf({ theme: { accent: "#ffd400", colorScheme: "light" } })).toHaveLength(1);
    });

    it("is checked against the palette the site uses", () => {
      expect(
        problemsOf({ theme: { accent: "#9a3b1a", colorScheme: "light", palette: "paper" } }),
      ).toEqual([]);
      expect(
        problemsOf({ theme: { accent: "#9a3b1a", colorScheme: "dark", palette: "midnight" } }),
      ).toHaveLength(1);
    });

    it("isn't checked when the accent or the palette is wrong, which is reported already", () => {
      expect(problemsOf({ theme: { accent: "nope" } }).map(({ code }) => code)).toEqual([
        ConfigCodes.wrongValue,
      ]);
      expect(
        problemsOf({ theme: { accent: "#ffd400", palette: "nope" } }).map(({ code }) => code),
      ).toEqual([ConfigCodes.wrongValue]);
    });

    it("gives back the config with its warnings", () => {
      const result = checkConfig({ theme: { accent: "#7a7a7a" } }, FILE);
      expect(result.ok && result.value.warnings.length).toBe(2);
    });
  });
});
