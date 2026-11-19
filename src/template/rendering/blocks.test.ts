import { describe, expect, it } from "vitest";
import { TemplateCodes } from "../index.ts";
import { compileCodes, html, renderCodes, renderProblems } from "../test-helpers.ts";

describe("conditions", () => {
  const choose = "{% if a %}1{% elif b %}2{% else %}3{% endif %}";

  it.each([
    [true, true, "1"],
    [true, false, "1"],
    [false, true, "2"],
    [false, false, "3"],
  ])("with a = %s and b = %s, shows %s", (a, b, shown) => {
    expect(html(choose, { a, b })).toBe(shown);
  });

  it("shows nothing when no branch is true and there is no else", () => {
    expect(html("a{% if b %}x{% endif %}c", { b: false })).toBe("ac");
  });

  it.each([
    ["an empty list", [], ""],
    ["a list", [1], "yes"],
    ["an empty group of fields", {}, ""],
    ["a group of fields", { a: 1 }, "yes"],
    ["empty text", "", ""],
    ["text", "0", "yes"],
    ["zero", 0, ""],
    ["a number", 2, "yes"],
    ["nothing", null, ""],
  ])("treats %s as the condition the same way as `not`", (_, condition, shown) => {
    expect(html("{% if value %}yes{% endif %}", { value: condition })).toBe(shown);
  });

  it("is silent about a missing field, which is normal in a condition", () => {
    expect(renderProblems("{% if page.cover %}x{% endif %}", { page: {} })).toEqual([]);
  });

  it("is silent about a missing field passed to a filter in a condition", () => {
    expect(renderProblems("{% if page.cover | length %}x{% endif %}", { page: {} })).toEqual([]);
  });

  it("still warns about a missing field printed inside the branch", () => {
    expect(renderCodes("{% if true %}{{ page.titel }}{% endif %}", { page: {} })).toEqual([
      TemplateCodes.missingField,
    ]);
  });

  it("only runs the branch it chooses", () => {
    expect(html("{% if true %}a{% else %}{{ missing }}{% endif %}")).toBe("a");
    expect(html("{% if false %}{{ 1 / 0 }}{% endif %}")).toBe("");
  });

  it("stops at the first true branch", () => {
    expect(html("{% if a %}1{% elif 1 / 0 %}2{% endif %}", { a: true })).toBe("1");
  });

  it("reports an unknown variable in a condition once, and shows no branch", () => {
    const source = "{% if missing %}a{% else %}b{% endif %}";
    expect(renderCodes(source)).toEqual([TemplateCodes.unknownVariable]);
  });

  it("uses operators and filters in conditions", () => {
    expect(
      html("{% if posts | length > 1 and not draft %}many{% endif %}", {
        posts: [1, 2],
        draft: false,
      }),
    ).toBe("many");
  });
});

describe("loops", () => {
  it("shows the body once for each item", () => {
    expect(html("{% for x in list %}[{{ x }}]{% endfor %}", { list: [1, 2, 3] })).toBe("[1][2][3]");
  });

  it("reads the fields of each item", () => {
    const posts = [{ title: "One" }, { title: "Two" }];
    expect(html("{% for post in posts %}<li>{{ post.title }}</li>{% endfor %}", { posts })).toBe(
      "<li>One</li><li>Two</li>",
    );
  });

  it("escapes each item", () => {
    expect(html("{% for x in list %}{{ x }}{% endfor %}", { list: ["<b>", "&"] })).toBe(
      "&lt;b&gt;&amp;",
    );
  });

  it("shows else for an empty list", () => {
    const source = "{% for x in list %}{{ x }}{% else %}none{% endfor %}";
    expect(html(source, { list: [] })).toBe("none");
    expect(html(source, { list: [1] })).toBe("1");
  });

  it("treats a missing field as an empty list, without a warning", () => {
    const source = "{% for tag in page.tags %}{{ tag }}{% else %}no tags{% endfor %}";
    expect(html(source, { page: {} })).toBe("no tags");
    expect(renderProblems(source, { page: {} })).toEqual([]);
  });

  it("is silent about a missing field passed to a filter in the list", () => {
    const source = "{% for tag in page.tags | sort %}{{ tag }}{% endfor %}";
    expect(renderProblems(source, { page: {} })).toEqual([]);
  });

  it("tells each item where it is in the loop", () => {
    const source =
      "{% for x in list %}{{ loop.index }}/{{ loop.length }}" +
      "{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %} {% endfor %}";
    expect(html(source, { list: ["a", "b", "c"] })).toBe("1/3F 2/3 3/3L ");
  });

  it("can put commas between items", () => {
    const source = "{% for tag in tags %}{{ tag }}{% if not loop.last %}, {% endif %}{% endfor %}";
    expect(html(source, { tags: ["a", "b", "c"] })).toBe("a, b, c");
  });

  it("explains how to print the loop information", () => {
    expect(
      renderProblems("{% for x in list %}{{ loop }}{% endfor %}", { list: [1] }),
    ).toMatchObject([
      { code: TemplateCodes.notPrintable, hint: "print one of its fields, such as `loop.index`" },
    ]);
  });

  it.each([
    ["text", '"abc"', "text"],
    ["a number", "3", "a number"],
    ["a group of fields", "page", "a group of fields"],
  ])("rejects %s as the list", (_, list, found) => {
    expect(
      renderProblems(`{% for x in ${list} %}{{ x }}{% endfor %}`, { page: { a: 1 } }),
    ).toMatchObject([
      {
        code: TemplateCodes.notIterable,
        message: `a loop needs a list, but found ${found}`,
        hint: "use a list here, such as `page.tags`",
      },
    ]);
  });

  it("points at the list that cannot be looped over", () => {
    expect(renderProblems("{% for x in page %}{% endfor %}", { page: {} })).toMatchObject([
      { span: { start: { column: 13 }, end: { column: 17 } } },
    ]);
  });

  it("reports an unknown list once, and shows nothing", () => {
    expect(renderCodes("{% for x in missing %}a{% else %}b{% endfor %}")).toEqual([
      TemplateCodes.unknownVariable,
    ]);
  });

  it("reports a mistake inside the body once, not once for each item", () => {
    const list = [1, 2, 3];
    expect(renderCodes("{% for x in list %}{{ x + missing }}{% endfor %}", { list })).toEqual([
      TemplateCodes.unknownVariable,
    ]);
  });

  it("warns once about a missing field inside the body", () => {
    const posts = [{ title: "a" }, { title: "b" }];
    expect(renderCodes("{% for post in posts %}{{ post.titel }}{% endfor %}", { posts })).toEqual([
      TemplateCodes.missingField,
    ]);
  });

  it("reports problems in file order, even when a later item fails earlier in the body", () => {
    const list = [
      { a: 1, b: "x" },
      { a: "x", b: 1 },
    ];
    const source = "{% for item in list %}{{ item.a - 1 }}{{ item.b - 1 }}{% endfor %}";
    expect(renderProblems(source, { list }).map((problem) => problem.span.start.column)).toEqual([
      26, 42,
    ]);
  });

  it("handles a very long list", () => {
    const list = Array.from({ length: 100_000 }, (_, index) => index);
    expect(html("{% for x in list %}.{% endfor %}", { list })).toHaveLength(100_000);
  });
});

describe("scopes", () => {
  it("removes the loop variable after the loop", () => {
    expect(renderCodes("{% for x in list %}{% endfor %}{{ x }}", { list: [1] })).toEqual([
      TemplateCodes.unknownVariable,
    ]);
  });

  it("lets the loop variable hide a variable outside, until the loop ends", () => {
    const source = "{{ x }}{% for x in list %}{{ x }}{% endfor %}{{ x }}";
    expect(html(source, { x: "o", list: [1, 2] })).toBe("o12o");
  });

  it("sees variables from outside the loop", () => {
    const source = "{% for post in posts %}{{ site.name }}: {{ post }} {% endfor %}";
    expect(html(source, { site: { name: "Blog" }, posts: ["a", "b"] })).toBe("Blog: a Blog: b ");
  });

  it("gives an inner loop its own loop information, and keeps the outer item", () => {
    const source =
      "{% for row in rows %}{% for cell in row %}" +
      "{{ row | length }}{{ loop.index }}{% endfor %}{{ loop.index }};{% endfor %}";
    expect(html(source, { rows: [["a", "b"], ["c"]] })).toBe("21221;112;");
  });

  it("suggests the loop variable for a misspelled name", () => {
    const source = "{% for post in posts %}{{ psot }}{% endfor %}";
    expect(renderProblems(source, { posts: [1] })).toMatchObject([
      { code: TemplateCodes.unknownVariable, hint: 'did you mean "post"?' },
    ]);
  });

  it("lists the variables of the loop first", () => {
    const source = "{% for item in list %}{{ zzzzzz }}{% endfor %}";
    expect(renderProblems(source, { list: [1] })[0]?.hint).toBe(
      "the variables here are: item, loop, list",
    );
  });
});

describe("checking blocks before rendering", () => {
  it.each([
    "{% if a | nope %}{% endif %}",
    "{% if a %}{% elif a | nope %}{% endif %}",
    "{% if a %}{% else %}{{ a | nope }}{% endif %}",
    "{% for x in a | nope %}{% endfor %}",
    "{% for x in a %}{{ x | nope }}{% endfor %}",
    "{% for x in a %}{% else %}{{ x | nope }}{% endfor %}",
  ])("finds an unknown filter in %s", (source) => {
    expect(compileCodes(source)).toEqual([TemplateCodes.unknownFilter]);
  });
});

describe("deep templates", () => {
  it("renders blocks nested as deeply as allowed", () => {
    const source =
      "{% for x in list %}{% if x %}".repeat(32) + "." + "{% endif %}{% endfor %}".repeat(32);
    expect(html(source, { list: [1] })).toBe(".");
  });
});
