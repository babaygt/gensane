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
      "base.html": '{% block a %}base{% endblock %}{% include "part.html" %}',
      "part.html": "{% block a %}part{% endblock %}",
      "child.html": '{% extends "base.html" %}{% block a %}child{% endblock %}',
    };
    expect(fileHtml(files, "child.html")).toBe("childpart");
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
