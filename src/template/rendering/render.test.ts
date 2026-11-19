import { describe, expect, it } from "vitest";
import {
  FilterError,
  TemplateCodes,
  type TemplateFilter,
  compileTemplate,
  renderTemplate,
} from "../index.ts";
import { compileCodes, compiled, errorCodes, html, render, value } from "../test-helpers.ts";

const repeat: TemplateFilter = (input, times) => String(input).repeat(Number(times));

const failWithHint: TemplateFilter = () => {
  throw new FilterError("that did not work", "try something else");
};

const failWithTypeError: TemplateFilter = () => {
  throw new TypeError("broken");
};

const failWithText: TemplateFilter = () => {
  throw "plain text";
};

describe("compiling", () => {
  it("collects the problems of every stage in file order", () => {
    expect(compileCodes("{{ a | nope }}{{ @ }}{{ b c }}")).toEqual([
      TemplateCodes.unknownFilter,
      TemplateCodes.unexpectedCharacter,
      TemplateCodes.unexpectedToken,
    ]);
  });
});

describe("text and output", () => {
  it("returns text unchanged", () => {
    expect(html("<p>Hello</p>\n")).toBe("<p>Hello</p>\n");
  });

  it("replaces output with its value", () => {
    expect(html("<h1>{{ title }}</h1>", { title: "Hello" })).toBe("<h1>Hello</h1>");
  });

  it.each([
    ["text", "text"],
    [42, "42"],
    [1.5, "1.5"],
    [0, "0"],
    [true, "true"],
    [false, "false"],
    [null, ""],
    [undefined, ""],
  ])("prints %j as %j", (input, printed) => {
    expect(value("input", { input })).toBe(printed);
  });

  it.each([
    [["a"], "use the `join` filter to print a list"],
    [{ a: 1 }, "print one of its fields, such as `input.a`"],
    [{}, "print one of its fields"],
  ])("explains why %j cannot be printed", (input, hint) => {
    const result = render("{{ input }}", { input });
    expect(result.ok ? [] : result.error).toMatchObject([
      { code: TemplateCodes.notPrintable, hint, span: { start: { column: 4 } } },
    ]);
  });
});

describe("escaping", () => {
  it.each([
    ["<script>", "&lt;script&gt;"],
    ["a & b", "a &amp; b"],
    ['"quoted"', "&quot;quoted&quot;"],
    ["it's", "it&#39;s"],
  ])("escapes %s", (input, escaped) => {
    expect(value("input", { input })).toBe(escaped);
  });

  it("escapes only once", () => {
    expect(value("input", { input: "&amp;" })).toBe("&amp;amp;");
  });

  it("does not escape the text of the template", () => {
    expect(html('<a href="/">&amp;</a>')).toBe('<a href="/">&amp;</a>');
  });

  it("escapes values from string literals", () => {
    expect(value('"<b>"')).toBe("&lt;b&gt;");
  });

  it("prints raw HTML when asked to", () => {
    expect(value("input | raw", { input: "<b>bold</b>" })).toBe("<b>bold</b>");
  });

  it("rejects another filter after raw, and says what to do", () => {
    const result = render("{{ input | raw | upper }}", { input: "<b>" });
    expect(result.ok ? [] : result.error).toMatchObject([
      { code: TemplateCodes.filterFailed, hint: "put `raw` last, after the other filters" },
    ]);
  });

  it("treats empty raw HTML as false", () => {
    expect(value('not ("" | raw)')).toBe("true");
    expect(value('not ("a" | raw)')).toBe("false");
  });
});

describe("variables and fields", () => {
  const page = { title: "Hello", author: { name: "Ada" }, tags: ["a", "b"], summary: undefined };

  it.each([
    ["page.title", "Hello"],
    ["page.author.name", "Ada"],
    ['page["title"]', "Hello"],
    ["page.tags[0]", "a"],
    ["page.tags[1]", "b"],
    ["page.tags.length", "2"],
  ])("reads %s", (code, printed) => {
    expect(value(code, { page })).toBe(printed);
  });

  it("reads an index from a variable", () => {
    expect(value("page.tags[position]", { page, position: 1 })).toBe("b");
  });

  it("reports an unknown variable and suggests the closest one", () => {
    const result = render("{{ pgae.title }}", { page });
    expect(result.ok ? [] : result.error).toMatchObject([
      {
        code: TemplateCodes.unknownVariable,
        severity: "error",
        message: 'there is no variable named "pgae"',
        hint: 'did you mean "page"?',
        span: { start: { column: 4 }, end: { column: 8 } },
      },
    ]);
  });

  it("gives a general hint when no variable is close", () => {
    const result = render("{{ other }}", { page });
    expect(result.ok ? undefined : result.error[0]?.hint).toBe("the variables here are: page");
  });

  it.each(["constructor", "__proto__", "toString"])(
    "does not read the inherited field %s",
    (field) => {
      expect(value(`page.${field}`, { page })).toBe("");
    },
  );

  it("does not treat an inherited name as a variable", () => {
    expect(errorCodes("constructor")).toEqual([TemplateCodes.unknownVariable]);
  });

  it.each([
    ["page.tags[5]"],
    ["page.tags[-1]"],
    ["page.missing.deeper"],
    ["page.title.deeper"],
    ["nothing.field"],
    ["nothing[0]"],
  ])("gives nothing for %s", (code) => {
    expect(value(code, { page, nothing: null })).toBe("");
  });

  it.each(["page[true]", "page[1.5]", "page[null]", "page[page]"])(
    "rejects the index in %s",
    (code) => {
      expect(errorCodes(code, { page })).toEqual([TemplateCodes.invalidIndex]);
    },
  );
});

describe("warnings about missing fields", () => {
  const page = { title: "Hello", summary: undefined, author: { name: "Ada" } };

  function warnings(source: string) {
    const result = render(source, { page });
    return result.ok ? result.value.warnings : [];
  }

  it("warns about a printed field that does not exist", () => {
    expect(warnings("{{ page.titel }}")).toMatchObject([
      {
        code: TemplateCodes.missingField,
        severity: "warning",
        message: '"page" has no field "titel"',
        hint: 'did you mean "title"?',
        span: { start: { column: 9 }, end: { column: 14 } },
      },
    ]);
  });

  it("names the full path of a nested field", () => {
    expect(warnings("{{ page.author.nam }}")[0]?.message).toBe('"page.author" has no field "nam"');
  });

  it("warns once, at the first missing field in a path", () => {
    expect(warnings("{{ page.authr.name }}")).toMatchObject([
      { message: '"page" has no field "authr"' },
    ]);
  });

  it("does not warn about a field that exists without a value", () => {
    expect(warnings("{{ page.summary }}")).toEqual([]);
  });

  it("warns about a field that a filter receives", () => {
    expect(warnings("{{ page.titel | upper }}")).toHaveLength(1);
  });

  it("does not warn when the template provides a default", () => {
    expect(warnings('{{ page.titel | default("None") }}')).toEqual([]);
  });

  it("gives a general hint when no field is close", () => {
    expect(warnings("{{ page.zzzzzz }}")[0]?.hint).toBe(
      "check the spelling, or add `default` if the field is optional",
    );
  });
});

describe("arithmetic", () => {
  it.each([
    ["1 + 2", "3"],
    ["5 - 8", "-3"],
    ["3 * 4", "12"],
    ["7 / 2", "3.5"],
    ["7 % 3", "1"],
    ["2 + 3 * 4", "14"],
    ["(2 + 3) * 4", "20"],
    ["-5 + 2", "-3"],
    ['"a" + "b"', "ab"],
  ])("%s is %s", (code, printed) => {
    expect(value(code)).toBe(printed);
  });

  it.each(['1 + "a"', '"a" + 1', "true + 1", "null + 1", '"a" - "b"', '"a" * 2', '-"a"'])(
    "rejects %s",
    (code) => {
      expect(errorCodes(code)).toEqual([TemplateCodes.wrongOperand]);
    },
  );

  it("names the operator and what it found", () => {
    const result = render('{{ 1 + "a" }}');
    expect(result.ok ? undefined : result.error[0]?.message).toBe(
      "`+` needs two numbers or two pieces of text, but found a number and text",
    );
  });

  it.each(["1 / 0", "1 % 0"])("rejects %s", (code) => {
    expect(errorCodes(code)).toEqual([TemplateCodes.divisionByZero]);
  });
});

describe("comparison", () => {
  it.each([
    ["1 == 1", "true"],
    ["1 == 2", "false"],
    ['"a" == "a"', "true"],
    ['1 == "1"', "false"],
    ["1 != 2", "true"],
    ["null == nothing", "true"],
    ["null != nothing", "false"],
    ["1 < 2", "true"],
    ["2 < 2", "false"],
    ["2 <= 2", "true"],
    ["3 > 2", "true"],
    ["2 > 2", "false"],
    ["2 >= 2", "true"],
    ['"a" < "b"', "true"],
  ])("%s is %s", (code, printed) => {
    expect(value(code, { nothing: undefined })).toBe(printed);
  });

  it.each(['1 < "a"', "null < 1", "true > false"])("rejects %s", (code) => {
    expect(errorCodes(code)).toEqual([TemplateCodes.wrongOperand]);
  });
});

describe("logic", () => {
  it.each([
    ["not true", "false"],
    ["not false", "true"],
    ["true and false", "false"],
    ["true or false", "true"],
    ['"" or "fallback"', "fallback"],
    ['"first" or "second"', "first"],
    ['"first" and "second"', "second"],
    ['0 and "second"', "0"],
  ])("%s is %s", (code, printed) => {
    expect(value(code)).toBe(printed);
  });

  it.each([[false], [null], [undefined], [0], [""], [[]], [{}]])("treats %j as false", (input) => {
    expect(value("not input", { input })).toBe("true");
  });

  it.each([[true], [1], [-1], ["0"], [" "], [[0]], [{ a: 0 }]])("treats %j as true", (input) => {
    expect(value("not input", { input })).toBe("false");
  });

  it("does not evaluate the right side when the left side decides", () => {
    expect(value("false and missing")).toBe("false");
    expect(value("true or missing")).toBe("true");
  });

  it("evaluates the right side when it is needed", () => {
    expect(errorCodes("true and missing")).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes("false or missing")).toEqual([TemplateCodes.unknownVariable]);
  });
});

describe("text filters", () => {
  it.each([
    ['"Hello" | upper', "HELLO"],
    ['"Hello" | lower', "hello"],
    ['"hello world" | capitalize', "Hello world"],
    ['"" | capitalize', ""],
    ['"😀a" | capitalize', "😀a"],
    ['"  a  " | trim', "a"],
    ['"hello" | truncate(3)', "hel…"],
    ['"hello" | truncate(5)', "hello"],
    ['"hello" | truncate(9)', "hello"],
    ['"hello" | truncate(0)', "…"],
    ['"hello" | truncate(3, "...")', "hel..."],
    ['"hello" | truncate(3, "")', "hel"],
    ['"hi there" | truncate(3)', "hi…"],
    ['"😀😀😀" | truncate(2)', "😀😀…"],
  ])("%s is %s", (code, printed) => {
    expect(value(code)).toBe(printed);
  });

  it.each(["upper", "lower", "capitalize", "trim", "truncate(3)"])(
    "%s treats empty as empty text",
    (filter) => {
      expect(value(`nothing | ${filter}`, { nothing: null })).toBe("");
    },
  );

  it.each(["upper", "lower", "capitalize", "trim", "truncate(3)"])(
    "%s rejects a number",
    (filter) => {
      expect(errorCodes(`1 | ${filter}`)).toEqual([TemplateCodes.filterFailed]);
    },
  );

  it.each([
    '"a" | truncate(-1)',
    '"a" | truncate(1.5)',
    '"a" | truncate("1")',
    '"a" | truncate(1, 2)',
  ])("rejects the arguments of %s", (code) => {
    expect(errorCodes(code)).toEqual([TemplateCodes.filterFailed]);
  });

  it("points at the name of the filter that failed", () => {
    const result = render("{{ 1 | upper }}");
    expect(result.ok ? [] : result.error).toMatchObject([
      {
        message: '"upper" needs text, but found a number',
        span: { start: { column: 8 }, end: { column: 13 } },
      },
    ]);
  });
});

describe("value filters", () => {
  it.each([
    ['nothing | default("x")', "x"],
    ['"" | default("x")', "x"],
    ['"a" | default("x")', "a"],
    ['0 | default("x")', "0"],
    ['false | default("x")', "false"],
  ])("%s is %s", (code, printed) => {
    expect(value(code, { nothing: null })).toBe(printed);
  });

  it.each([
    ['"héllo" | length', "5"],
    ['"😀" | length', "1"],
    ["list | length", "3"],
    ["map | length", "2"],
    ["nothing | length", "0"],
    ['list | join(", ")', "1, 2, 3"],
    ["list | join", "1, 2, 3"],
    ['list | join("-")', "1-2-3"],
    ['nothing | join(", ")', ""],
    ["list | first", "1"],
    ["list | last", "3"],
    ['"abc" | first', "a"],
    ['"abc" | last', "c"],
    ['"😀a" | first', "😀"],
    ["nothing | first", ""],
    ["nothing | last", ""],
    ["empty | first", ""],
    ["empty | last", ""],
  ])("%s is %s", (code, printed) => {
    expect(value(code, { list: [1, 2, 3], map: { a: 1, b: 2 }, nothing: null, empty: [] })).toBe(
      printed,
    );
  });

  it("escapes what join produces", () => {
    expect(value('list | join(" & ")', { list: ["<a>", "b"] })).toBe("&lt;a&gt; &amp; b");
  });

  it.each(["1 | length", "true | length", "1 | join", "map | join", "1 | first", "1 | last"])(
    "rejects %s",
    (code) => {
      expect(errorCodes(code, { map: {} })).toEqual([TemplateCodes.filterFailed]);
    },
  );

  it("rejects a list of lists in join", () => {
    expect(errorCodes("list | join", { list: [[1]] })).toEqual([TemplateCodes.filterFailed]);
  });

  it("rejects a separator that is not text", () => {
    expect(errorCodes("list | join(1)", { list: [1] })).toEqual([TemplateCodes.filterFailed]);
  });
});

describe("checking filters before rendering", () => {
  it("reports an unknown filter and suggests the closest one", () => {
    const result = compileTemplate("{{ a | uppr }}", "page.html");
    expect(result.ok ? [] : result.error).toMatchObject([
      {
        code: TemplateCodes.unknownFilter,
        message: 'there is no filter named "uppr"',
        hint: 'did you mean "upper"?',
        span: { start: { column: 8 }, end: { column: 12 } },
      },
    ]);
  });

  it("finds filters in every part of an expression", () => {
    const parts = [
      "-(a | nope)",
      "not (a | nope)",
      "(a | nope) + 1",
      "1 + (a | nope)",
      "(a | nope) or b",
      "a or (b | nope)",
      "(a | nope).b",
      "(a | nope)[0]",
      "a[b | nope]",
      "(a | nope) | upper",
      "a | default(b | nope)",
    ];
    for (const code of parts)
      expect(compileCodes(`{{ ${code} }}`)).toEqual([TemplateCodes.unknownFilter]);
  });

  it.each([
    ['a | upper("x")', "remove the extra arguments"],
    ["a | truncate", "add the missing arguments"],
  ])("explains how to correct %s", (code, hint) => {
    const result = compileTemplate(`{{ ${code} }}`, "page.html");
    expect(result.ok ? undefined : result.error[0]?.hint).toBe(hint);
  });

  it.each([
    ['a | upper("x")', '"upper" takes no arguments, but got 1'],
    ["a | truncate", '"truncate" takes 1 to 2 arguments, but got 0'],
    ["a | truncate(1, 2, 3)", '"truncate" takes 1 to 2 arguments, but got 3'],
    ["a | default", '"default" takes 1 argument, but got 0'],
    ["a | join(1, 2)", '"join" takes 0 to 1 arguments, but got 2'],
  ])("checks the number of arguments of %s", (code, message) => {
    const result = compileTemplate(`{{ ${code} }}`, "page.html");
    expect(result.ok ? [] : result.error).toMatchObject([
      { code: TemplateCodes.wrongArgumentCount, message },
    ]);
  });
});

describe("custom filters", () => {
  it("runs a filter with its arguments", () => {
    const template = compiled('{{ "ab" | repeat(2) }}', { repeat });
    expect(renderTemplate(template, {})).toMatchObject({ ok: true, value: { html: "abab" } });
  });

  it("can replace a built-in filter", () => {
    const template = compiled('{{ "a" | upper }}', { upper: () => "custom" });
    expect(renderTemplate(template, {})).toMatchObject({ ok: true, value: { html: "custom" } });
  });

  it("allows any number of arguments", () => {
    expect(compileCodes('{{ "a" | mine(1, 2, 3, 4) }}', { mine: (input) => input })).toEqual([]);
  });

  it("escapes what a filter returns", () => {
    const template = compiled('{{ "a" | mine }}', { mine: () => "<b>" });
    expect(renderTemplate(template, {})).toMatchObject({ value: { html: "&lt;b&gt;" } });
  });

  it("reports a filter error with its hint", () => {
    expect(renderTemplate(compiled('{{ "a" | mine }}', { mine: failWithHint }), {})).toMatchObject({
      ok: false,
      error: [
        {
          code: TemplateCodes.filterFailed,
          message: "that did not work",
          hint: "try something else",
        },
      ],
    });
  });

  it("reports any other failure of a filter", () => {
    expect(
      renderTemplate(compiled('{{ "a" | mine }}', { mine: failWithTypeError }), {}),
    ).toMatchObject({
      ok: false,
      error: [{ code: TemplateCodes.filterFailed, message: 'the filter "mine" failed: broken' }],
    });
  });

  it("reports a thrown value that is not an error", () => {
    expect(renderTemplate(compiled('{{ "a" | mine }}', { mine: failWithText }), {})).toMatchObject({
      error: [{ message: 'the filter "mine" failed: plain text' }],
    });
  });
});

describe("reporting every problem", () => {
  it("continues after a problem", () => {
    const result = render("{{ a }}{{ b }}{{ 1 / 0 }}");
    expect(result.ok ? [] : result.error.map((problem) => problem.code)).toEqual([
      TemplateCodes.unknownVariable,
      TemplateCodes.unknownVariable,
      TemplateCodes.divisionByZero,
    ]);
  });

  it("reports one problem for one mistake", () => {
    expect(errorCodes("(missing + 1) * 2")).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes("-missing")).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes("not missing")).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes("missing.a[0]")).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes("missing.a + 1")).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes("list[missing]", { list: [] })).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes("1 + missing")).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes("missing and 1")).toEqual([TemplateCodes.unknownVariable]);
    expect(errorCodes('"a" | truncate(missing)')).toEqual([TemplateCodes.unknownVariable]);
  });

  it("does not run a filter on a value that failed", () => {
    const template = compiled("{{ missing.a | mine }}", { mine: failWithTypeError });
    const result = renderTemplate(template, {});
    expect(result.ok ? [] : result.error.map((problem) => problem.code)).toEqual([
      TemplateCodes.unknownVariable,
    ]);
  });

  it("keeps warnings together with errors, in file order", () => {
    const result = render("{{ page.titel }}{{ missing }}", { page: { title: "a" } });
    expect(result.ok ? [] : result.error.map((problem) => problem.severity)).toEqual([
      "warning",
      "error",
    ]);
  });

  it("sorts problems into file order", () => {
    const result = render("{{ b }}\n{{ page.nope }}\n{{ a }}", { page: {} });
    expect(result.ok ? [] : result.error.map((problem) => problem.span.start.line)).toEqual([
      1, 2, 3,
    ]);
  });
});

describe("rendering again", () => {
  it("gives the same result for the same input", () => {
    const template = compiled("{{ a }}{{ b | upper }}");
    const variables = { a: 1, b: "x" };
    expect(renderTemplate(template, variables)).toEqual(renderTemplate(template, variables));
  });

  it("does not change the variables", () => {
    const variables = Object.freeze({ list: Object.freeze([1, 2]) });
    expect(renderTemplate(compiled("{{ list | first }}"), variables)).toMatchObject({ ok: true });
  });
});

describe("hostile input", () => {
  it("evaluates the longest expression that is allowed", () => {
    const source = `{{ ${Array.from({ length: 500 }, () => "1").join("+")} }}`;
    expect(html(source)).toBe("500");
  });

  it("renders very many outputs", () => {
    expect(html("{{ a }}".repeat(50_000), { a: "x" })).toHaveLength(50_000);
  });

  it("escapes very long text", () => {
    expect(value("a", { a: "<".repeat(200_000) })).toHaveLength(800_000);
  });
});
