import { describe, expect, it } from "vitest";
import { MAX_INCLUDE_DEPTH, TemplateCodes, compileTemplate, compileTemplates } from "../index.ts";
import { fileHtml, renderFile, setCodes, setProblems } from "../test-helpers.ts";

/** Templates that each include the next one, `t0.html` first. */
function includeChain(length: number): Record<string, string> {
  const files: Record<string, string> = {};
  for (let index = 0; index < length; index++) {
    files[`t${index}.html`] = `${index}{% include "t${index + 1}.html" %}`;
  }
  files[`t${length}.html`] = "end";
  return files;
}

describe("compiling a set of templates", () => {
  it("gives a template for every file", () => {
    const result = compileTemplates({ "a.html": "A", "b.html": "B" });
    expect(result.ok && [...result.value.keys()]).toEqual(["a.html", "b.html"]);
  });

  it("still compiles a single template on its own", () => {
    const result = compileTemplate('{% include "other.html" %}', "page.html");
    expect(result.ok ? [] : result.error.map((problem) => problem.code)).toEqual([
      TemplateCodes.unknownTemplate,
    ]);
  });

  it("reports problems file by file, each in file order", () => {
    const problems = setProblems({ "b.html": "{{ b c }}{{ + }}", "a.html": "{{ a b }}" });
    expect(problems.map((problem) => problem.span.file)).toEqual(["a.html", "b.html", "b.html"]);
  });

  it("checks the filters of every file", () => {
    expect(setCodes({ "a.html": "{{ a }}", "b.html": "{{ b | nope }}" })).toEqual([
      TemplateCodes.unknownFilter,
    ]);
  });

  it("checks how templates use each other only when every file reads without mistakes", () => {
    expect(setCodes({ "a.html": '{% include "missing.html" %}{{ a b }}' })).toEqual([
      TemplateCodes.unexpectedToken,
    ]);
  });
});

describe("include", () => {
  it("shows another template where the tag is", () => {
    expect(fileHtml({ "page.html": 'a{% include "b.html" %}c', "b.html": "b" }, "page.html")).toBe(
      "abc",
    );
  });

  it("gives the included template the variables at that place", () => {
    const files = {
      "list.html": '{% for post in posts %}{% include "item.html" %}{% endfor %}',
      "item.html": "<li>{{ site.name }}: {{ post.title }} ({{ loop.index }})</li>",
    };
    const variables = { site: { name: "Blog" }, posts: [{ title: "A" }, { title: "B" }] };
    expect(fileHtml(files, "list.html", variables)).toBe(
      "<li>Blog: A (1)</li><li>Blog: B (2)</li>",
    );
  });

  it("includes templates in folders", () => {
    const files = { "page.html": '{% include "partials/nav.html" %}', "partials/nav.html": "nav" };
    expect(fileHtml(files, "page.html")).toBe("nav");
  });

  it("allows two templates to include the same one", () => {
    const files = {
      "a.html": '{% include "b.html" %}{% include "c.html" %}',
      "b.html": '{% include "d.html" %}',
      "c.html": '{% include "d.html" %}',
      "d.html": "d",
    };
    expect(fileHtml(files, "a.html")).toBe("dd");
  });

  it("points at the included file when it has a problem", () => {
    const result = renderFile(
      { "page.html": '{% include "b.html" %}', "b.html": "\n {{ missing }}" },
      "page.html",
    );
    expect(result.ok ? [] : result.error).toMatchObject([
      {
        code: TemplateCodes.unknownVariable,
        span: { file: "b.html", start: { line: 2, column: 5 } },
      },
    ]);
  });

  it("explains a template that does not exist", () => {
    expect(
      setProblems({ "page.html": '{% include "nav.html" %}', "partials/nav.html": "" }),
    ).toMatchObject([
      {
        code: TemplateCodes.unknownTemplate,
        message: 'there is no template named "nav.html"',
        hint: 'did you mean "partials/nav.html"?',
        span: { file: "page.html", start: { column: 12 } },
      },
    ]);
  });

  it("lists the templates when no name is close", () => {
    expect(setProblems({ "page.html": '{% include "zzzzzzzz" %}', "a.html": "" })[0]?.hint).toBe(
      "the templates are: page.html, a.html",
    );
  });

  it("rejects a template that includes itself", () => {
    expect(setProblems({ "a.html": 'x{% include "a.html" %}' })).toMatchObject([
      {
        code: TemplateCodes.templateCycle,
        message: "templates cannot use each other in a circle: a.html → a.html",
        hint: "remove one of the `include` or `extends` tags in the circle",
        span: { start: { column: 13 } },
      },
    ]);
  });

  it("rejects templates that include each other, once", () => {
    const problems = setProblems({
      "a.html": '{% include "b.html" %}',
      "b.html": '{% include "c.html" %}',
      "c.html": '{% include "a.html" %}',
    });
    expect(problems.map((problem) => problem.message)).toEqual([
      "templates cannot use each other in a circle: a.html → b.html → c.html → a.html",
    ]);
  });

  it("reports a circle once, however many templates lead to it", () => {
    expect(
      setCodes({
        "a.html": '{% include "c.html" %}',
        "b.html": '{% include "c.html" %}',
        "c.html": '{% include "c.html" %}',
      }),
    ).toEqual([TemplateCodes.templateCycle]);
  });

  it("names only the templates in the circle", () => {
    const problems = setProblems({
      "a.html": '{% include "b.html" %}',
      "b.html": '{% include "c.html" %}',
      "c.html": '{% include "b.html" %}',
    });
    expect(problems.map((problem) => problem.message)).toEqual([
      "templates cannot use each other in a circle: b.html → c.html → b.html",
    ]);
  });

  it("finds includes in every branch", () => {
    for (const source of [
      '{% if a %}{% else %}{% include "missing.html" %}{% endif %}',
      '{% for a in b %}{% else %}{% include "missing.html" %}{% endfor %}',
      '{% block a %}{% include "missing.html" %}{% endblock %}',
    ]) {
      expect(setCodes({ "page.html": source })).toEqual([TemplateCodes.unknownTemplate]);
    }
  });

  it("allows many includes side by side", () => {
    const files = { "page.html": '{% include "dot.html" %}'.repeat(100), "dot.html": "." };
    expect(fileHtml(files, "page.html")).toBe(".".repeat(100));
  });

  it("reports the same mistake at the same place in two files", () => {
    const result = renderFile(
      { "page.html": '{{ x }}{% include "b.html" %}', "b.html": "{{ y }}" },
      "page.html",
    );
    expect(result.ok ? [] : result.error.map((problem) => problem.span.file)).toEqual([
      "b.html",
      "page.html",
    ]);
  });

  it("rejects a circle of extends and include", () => {
    expect(
      setCodes({
        "a.html": '{% extends "b.html" %}',
        "b.html": '{% include "a.html" %}',
      }),
    ).toEqual([TemplateCodes.templateCycle]);
  });

  it(`allows ${MAX_INCLUDE_DEPTH} levels of includes, and stops after that`, () => {
    expect(renderFile(includeChain(MAX_INCLUDE_DEPTH), "t0.html").ok).toBe(true);
    const result = renderFile(includeChain(MAX_INCLUDE_DEPTH + 1), "t0.html");
    expect(result.ok ? [] : result.error).toMatchObject([
      {
        code: TemplateCodes.nestingTooDeep,
        message: `templates are included more than ${MAX_INCLUDE_DEPTH} levels deep`,
      },
    ]);
  });

  it("survives a very long chain of includes", () => {
    const result = renderFile(includeChain(2000), "t0.html");
    expect(result.ok ? [] : result.error.map((problem) => problem.code)).toEqual([
      TemplateCodes.nestingTooDeep,
    ]);
  });
});

describe("extends and blocks", () => {
  const layout =
    "<title>{% block title %}Site{% endblock %}</title>" +
    "<main>{% block content %}nothing yet{% endblock %}</main>";

  it("shows the blocks of a template on its own", () => {
    expect(fileHtml({ "base.html": layout }, "base.html")).toBe(
      "<title>Site</title><main>nothing yet</main>",
    );
  });

  it("replaces the blocks a child fills, and keeps the others", () => {
    const files = {
      "base.html": layout,
      "post.html": '{% extends "base.html" %}\n{% block content %}{{ text }}{% endblock %}\n',
    };
    expect(fileHtml(files, "post.html", { text: "Hello" })).toBe(
      "<title>Site</title><main>Hello</main>",
    );
  });

  it("uses the block of the closest template in a chain", () => {
    const files = {
      "base.html": layout,
      "page.html": '{% extends "base.html" %}{% block title %}Page{% endblock %}',
      "about.html":
        '{% extends "page.html" %}{% block content %}About{% endblock %}{% block title %}About me{% endblock %}',
      "contact.html": '{% extends "page.html" %}',
    };
    expect(fileHtml(files, "about.html")).toBe("<title>About me</title><main>About</main>");
    expect(fileHtml(files, "contact.html")).toBe("<title>Page</title><main>nothing yet</main>");
  });

  it("lets a child add blocks inside its blocks, for templates that extend it", () => {
    const files = {
      "base.html": layout,
      "post.html":
        '{% extends "base.html" %}{% block content %}<article>{% block article %}{% endblock %}</article>{% endblock %}',
      "first.html": '{% extends "post.html" %}{% block article %}First{% endblock %}',
    };
    expect(fileHtml(files, "first.html")).toBe(
      "<title>Site</title><main><article>First</article></main>",
    );
  });

  it("shows a block with the variables where the parent places it", () => {
    const files = {
      "list.html": "{% for x in list %}{% block item %}{{ x }}{% endblock %}{% endfor %}",
      "fancy.html":
        '{% extends "list.html" %}{% block item %}<{{ loop.index }}:{{ x }}>{% endblock %}',
    };
    expect(fileHtml(files, "fancy.html", { list: ["a", "b"] })).toBe("<1:a><2:b>");
  });

  it("lets an included template extend another", () => {
    const files = {
      "page.html": '[{% include "card.html" %}]',
      "card-base.html": "<div>{% block body %}{% endblock %}</div>",
      "card.html": '{% extends "card-base.html" %}{% block body %}card{% endblock %}',
    };
    expect(fileHtml(files, "page.html")).toBe("[<div>card</div>]");
  });

  it("keeps its own blocks inside an included template", () => {
    const files = {
      "base.html":
        '{% block a %}base{% endblock %}{% include "part.html" %}{% block b %}base{% endblock %}',
      "part.html": "{% block a %}part{% endblock %}{% block b %}part{% endblock %}",
      "child.html":
        '{% extends "base.html" %}{% block a %}child{% endblock %}{% block b %}child{% endblock %}',
    };
    expect(fileHtml(files, "child.html")).toBe("childpartpartchild");
  });

  it("allows comments and blank lines outside blocks in a child", () => {
    const files = {
      "base.html": layout,
      "post.html":
        '\n{% extends "base.html" %}\n\n{# the post #}\n{% block content %}x{% endblock %}\n',
    };
    expect(fileHtml(files, "post.html")).toBe("<title>Site</title><main>x</main>");
  });
});

describe("mistakes in layouts", () => {
  it.each([
    ["text", "Hello"],
    ["output", "{{ title }}"],
    ["a condition", "{% if a %}{% block content %}{% endblock %}{% endif %}"],
    ["an include", '{% include "base.html" %}'],
  ])("rejects %s outside every block of a child", (_, outside) => {
    const files = { "base.html": base(), "post.html": `{% extends "base.html" %}${outside}` };
    expect(setProblems(files)).toMatchObject([
      {
        code: TemplateCodes.contentOutsideBlock,
        message: "this is outside every block, so it is never shown",
        hint: 'put it inside a `{% block %}`, because this template extends "base.html"',
        span: { file: "post.html", start: { column: 26 } },
      },
    ]);
  });

  it.each([
    ["\n", { line: 3, column: 3, offset: 29 }, { line: 3, column: 8, offset: 34 }],
    ["\r\n", { line: 3, column: 3, offset: 31 }, { line: 3, column: 8, offset: 36 }],
  ])(
    "points at the text itself, not the blank lines around it, with %j",
    (lineBreak, start, end) => {
      const child = `{% extends "base.html" %}${lineBreak}${lineBreak}  Hello  ${lineBreak}`;
      expect(setProblems({ "base.html": base(), "post.html": child })).toMatchObject([
        { code: TemplateCodes.contentOutsideBlock, span: { start, end } },
      ]);
    },
  );

  it("points at text on the same line as extends", () => {
    expect(
      setProblems({ "base.html": base(), "post.html": '{% extends "base.html" %} Hi' }),
    ).toMatchObject([{ span: { start: { line: 1, column: 27 }, end: { line: 1, column: 29 } } }]);
  });

  it.each([
    ["after text", 'Hello{% extends "base.html" %}'],
    ["after output", '{{ a }}{% extends "base.html" %}'],
    ["twice", '{% extends "base.html" %}{% extends "base.html" %}'],
    ["inside a block", '{% block content %}{% extends "base.html" %}{% endblock %}'],
    ["inside a condition", '{% if a %}{% extends "base.html" %}{% endif %}'],
  ])("rejects extends %s", (_, source) => {
    expect(setProblems({ "base.html": base(), "post.html": source })).toMatchObject([
      {
        code: TemplateCodes.misplacedExtends,
        message: "`extends` must come before everything else",
        hint: "move it to the top of the template",
      },
    ]);
  });

  it("rejects two blocks with the same name", () => {
    const source = "{% block a %}{% endblock %}{% if b %}{% block a %}{% endblock %}{% endif %}";
    expect(setProblems({ "base.html": source })).toMatchObject([
      {
        code: TemplateCodes.duplicateBlock,
        message: 'there is already a block named "a" in this template',
        hint: "give each block its own name",
        span: { start: { column: 47 } },
      },
    ]);
  });

  it("finds blocks with the same name in every branch", () => {
    for (const branch of ["{% if b %}{% else %}", "{% for b in c %}{% else %}"]) {
      const end = branch.startsWith("{% if") ? "{% endif %}" : "{% endfor %}";
      const source = `{% block a %}{% endblock %}${branch}{% block a %}{% endblock %}${end}`;
      expect(setCodes({ "base.html": source })).toEqual([TemplateCodes.duplicateBlock]);
    }
  });

  it("puts the problems of how templates use each other in file order", () => {
    const problems = setProblems({
      "b.html": '{% include "missing.html" %}',
      "a.html": "{% block x %}{% endblock %}{% block x %}{% endblock %}",
    });
    expect(problems.map((problem) => problem.span.file)).toEqual(["a.html", "b.html"]);
  });

  it("rejects a block that the parent does not have, and suggests one", () => {
    const files = {
      "base.html": base(),
      "post.html": '{% extends "base.html" %}{% block contnet %}{% endblock %}',
    };
    expect(setProblems(files)).toMatchObject([
      {
        code: TemplateCodes.unknownBlock,
        message: 'there is no block named "contnet" in "base.html"',
        hint: 'did you mean "content"?',
        span: { start: { column: 35 } },
      },
    ]);
  });

  it("finds blocks anywhere up the chain", () => {
    const files = {
      "base.html": base(),
      "page.html": '{% extends "base.html" %}',
      "about.html": '{% extends "page.html" %}{% block title %}About{% endblock %}',
    };
    expect(setCodes(files)).toEqual([]);
  });

  it("lists the blocks when no name is close", () => {
    const files = {
      "base.html": base(),
      "post.html": '{% extends "base.html" %}{% block zzzzzzzz %}{% endblock %}',
    };
    expect(setProblems(files)[0]?.hint).toBe("the blocks there are: title, content");
  });

  it("explains a parent without blocks", () => {
    const files = {
      "base.html": "plain",
      "post.html": '{% extends "base.html" %}{% block content %}{% endblock %}',
    };
    expect(setProblems(files)[0]?.hint).toBe(
      'add `{% block content %}` to "base.html" where it should go',
    );
  });

  it("reports a missing parent once, without its blocks", () => {
    const files = { "post.html": '{% extends "bsae.html" %}{% block content %}{% endblock %}' };
    expect(setCodes({ ...files, "base.html": base() })).toEqual([TemplateCodes.unknownTemplate]);
  });

  it("rejects templates that extend each other", () => {
    expect(
      setCodes({
        "a.html": '{% extends "b.html" %}',
        "b.html": '{% extends "a.html" %}',
      }),
    ).toEqual([TemplateCodes.templateCycle]);
  });
});

function base(): string {
  return "{% block title %}{% endblock %}{% block content %}{% endblock %}";
}
