// Keeps the agent skill true: it follows the Agent Skills format (https://agentskills.io/specification),
// its references are the documentation as it is now, and everything it names exists.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigCodes, checkConfig } from "../../src/config/index.ts";
import { CoreCodes, THEME_CHOICES, buildSite } from "../../src/core/index.ts";
import { plainTheme } from "../../src/core/test-helpers.ts";
import {
  FrontmatterCodes,
  contentSchemas,
  parseFrontmatter,
  toPlainData,
} from "../../src/frontmatter/index.ts";
import { DiagnosticCodes as MarkdownCodes } from "../../src/markdown/index.ts";
import { TemplateCodes } from "../../src/template/index.ts";
import { REFERENCES, SKILL_FOLDER, referenceText } from "../../scripts/skill-references.ts";
import { findCodeFences, findFieldRows, findSection } from "../docs/doc-rules.ts";

const packageRoot = join(import.meta.dirname, "..", "..");
const folder = join(packageRoot, SKILL_FOLDER);
const skill = readFileSync(join(folder, "SKILL.md"), "utf8");
const docsPage = (path: string) => readFileSync(join(packageRoot, "docs", path), "utf8");

const parsed = parseFrontmatter(skill, "SKILL.md");
if (!parsed.ok) throw new Error(parsed.error.map(({ message }) => message).join("\n"));
const frontmatter = toPlainData(parsed.value.data) as Record<string, unknown>;

/** The names written as code in some text: "`title`, `date`" → title, date. */
const namesIn = (text: string) => [...text.matchAll(/`(\w+)`/g)].map(([, name]) => name);

const ALL_CODES = [ConfigCodes, CoreCodes, FrontmatterCodes, MarkdownCodes, TemplateCodes].flatMap(
  (codes) => Object.values(codes),
);

describe("the format of the skill", () => {
  it("has a name of lowercase letters, digits and single hyphens, the same as its folder", () => {
    expect(frontmatter["name"]).toBe("gensane");
    expect(String(frontmatter["name"])).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(folder.endsWith(join("skills", String(frontmatter["name"])))).toBe(true);
  });

  it("says what it does and when to use it, in at most 1024 characters", () => {
    const description = String(frontmatter["description"]);
    expect(description.length).toBeGreaterThan(100);
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).toMatch(/^Work on a website built with gensane/);
    expect(description).toContain("Use when");
  });

  it("has only the fields of the format, with metadata as text", () => {
    const fields = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
    for (const field of Object.keys(frontmatter)) expect(fields).toContain(field);
    for (const value of Object.values(frontmatter["metadata"] as object))
      expect(typeof value).toBe("string");
  });

  it("stays under 300 lines, so an agent loads it whole", () => {
    expect(skill.split("\n").length).toBeLessThan(300);
  });

  it("links every reference, and has no other files", () => {
    const files = readdirSync(join(folder, "references")).toSorted();
    expect(files).toEqual(REFERENCES.map(({ file }) => file).toSorted());
    for (const file of files) expect(skill).toContain(`](references/${file})`);
  });
});

describe("the references", () => {
  it.each(REFERENCES.map((reference) => [reference.file, reference] as const))(
    "%s is the documentation as it is now (run pnpm skill after changing it)",
    async (file, reference) => {
      const written = readFileSync(join(folder, "references", file), "utf8");
      expect(written).toBe(await referenceText(packageRoot, reference));
    },
  );

  it("explains every problem gensane can report", () => {
    const problems = readFileSync(join(folder, "references", "problems.md"), "utf8");
    for (const code of ALL_CODES) expect(problems).toContain(`#### ${code}\n`);
  });

  it("has no examples, which stay in the documentation", () => {
    for (const { file } of REFERENCES) {
      expect(findCodeFences(readFileSync(join(folder, "references", file), "utf8"))).toEqual([]);
    }
  });
});

describe("what the skill names exists", () => {
  it("names only problem codes gensane has", () => {
    const named = skill.match(/GS\d{3}/g) ?? [];
    expect(named.length).toBeGreaterThan(2);
    for (const code of named) expect(ALL_CODES).toContain(code);
  });

  it("names only commands gensane has", () => {
    const help = execFileSync(
      process.execPath,
      [join(packageRoot, "src", "cli", "main.ts"), "--help"],
      {
        encoding: "utf8",
      },
    );
    const commands = [...skill.matchAll(/npx gensane ([a-z]+)/g)].map(([, name]) => name ?? "");
    expect(commands.length).toBeGreaterThan(5);
    for (const name of commands) expect(help).toMatch(new RegExp(`^  ${name}\\b`, "m"));
  });

  it("has every type of content, with exactly its required fields and only fields it has", () => {
    const table = findSection(skill, "## Content");
    const rows = [...table.matchAll(/^\| `(\w+)`\s*\|[^|]*\|([^|]*)\|([^|]*)\|$/gm)];
    expect(rows.map(([, type]) => type)).toEqual(Object.keys(contentSchemas));
    const typesPage = docsPage("frontmatter/content-types.md");
    for (const [, type = "", required = "", used = ""] of rows) {
      const fields = findFieldRows(findSection(typesPage, `## \`${type}\``));
      expect(namesIn(required)).toEqual(
        fields.filter((row) => row.required).map(({ field }) => field),
      );
      for (const name of namesIn(used)) expect(fields.map(({ field }) => field)).toContain(name);
    }
  });

  it("names every palette, and only choices the theme has", () => {
    const config = findSection(skill, "## The config");
    for (const palette of THEME_CHOICES.palette) expect(config).toContain(`\`${palette}\``);
    expect(config).toContain(
      THEME_CHOICES.blogLayout.map((layout) => `\`${layout}\``).join(" or "),
    );
  });

  it("names every profile, each one a setting the config knows", () => {
    const line = findSection(skill, "## The config")
      .split("\n")
      .find((text) => text.includes("Profiles shown"));
    const profiles = [...(line ?? "").matchAll(/`(\w+)`/g)].map(([, name]) => name ?? "");
    expect(profiles).toHaveLength(7);
    for (const name of profiles) {
      const result = checkConfig({ site: { [name]: 5 } }, "gensane.config.ts");
      expect(result.ok).toBe(false);
    }
  });

  it("names every other setting of the config", () => {
    const result = checkConfig({ notASetting: true }, "gensane.config.ts");
    const hint = result.ok ? "" : (result.error[0]?.hint ?? "");
    const settings = hint.replace("the settings are ", "").split(/, | and /);
    for (const setting of settings)
      expect(findSection(skill, "## The config")).toContain(`\`${setting}\``);
  });
});

describe("the examples of the skill", () => {
  const fences = findCodeFences(skill);

  it("show a post that builds without a problem", () => {
    const post = fences.find((fence) => fence.info === "markdown")?.text ?? "";
    const result = buildSite({
      content: { "blog/2026-11-20-why-i-write-tests-first.md": `${post}\n` },
      templates: plainTheme,
      config: { site: { url: "https://ada.dev" } },
    });
    expect(result.ok && result.value.warnings).toEqual([]);
  });

  it("show a config that has no problem", async () => {
    const source = fences.find((fence) => fence.info === "ts")?.text ?? "";
    const objectText = source.slice(
      source.indexOf("defineConfig(") + "defineConfig(".length,
      source.lastIndexOf(")"),
    );
    const config: unknown = new Function(`return (${objectText});`)();
    expect(checkConfig(config, "gensane.config.ts")).toEqual({
      ok: true,
      value: { config, warnings: [] },
    });
  });

  it("show the problem that gensane really prints, as the tutorial runs it", () => {
    const problem = fences.find((fence) => fence.text.startsWith("error[GS413]"))?.text ?? "";
    expect(problem.length).toBeGreaterThan(100);
    expect(docsPage("start/tutorial.md")).toContain(problem);
  });
});
