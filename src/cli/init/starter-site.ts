/** The files of a new site, made from the answers to `gensane init`'s questions. */

import { PACKAGE_NAME } from "../package-name.ts";
import { type DeployTarget, deployFiles } from "./deploy-files.ts";

export const SECTIONS = ["blog", "projects", "talks", "about"] as const;
export type Section = (typeof SECTIONS)[number];

export interface Answers {
  readonly title: string;
  /** Empty when there is no author. */
  readonly author: string;
  /** The full address of the site, or empty when it isn't known yet. */
  readonly url: string;
  readonly sections: readonly Section[];
  readonly palette: string;
  /** Where the site will be published, if that is known. */
  readonly deploy: DeployTarget | "none";
}

interface Details {
  /** Today, as `YYYY-MM-DD`. */
  readonly today: string;
  /** The version of gensane, for `package.json`. */
  readonly version: string;
  /** The name of the folder, for `package.json`. */
  readonly folderName: string;
}

/** Text in double quotes, which YAML and TypeScript both read the same way. */
function quoted(text: string): string {
  return JSON.stringify(text);
}

/** A name for the site from the name of its folder, as npm and Cloudflare accept it. */
export function siteNameOf(folderName: string): string {
  return (
    folderName
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]+/g, "-")
      .replaceAll(/^-+|-+$/g, "") || "my-site"
  );
}

function packageJson({ version, folderName }: Details): string {
  const json = {
    name: siteNameOf(folderName),
    private: true,
    type: "module",
    scripts: { dev: "gensane dev", build: "gensane build", check: "gensane check" },
    devDependencies: { [PACKAGE_NAME]: `^${version}` },
  };
  return `${JSON.stringify(json, null, 2)}\n`;
}

/** The menu `init` would make, as a comment to start from. */
const MENU_EXAMPLE: Readonly<Record<Section, string>> = {
  blog: '{ title: "Blog", url: "/blog/" }',
  projects: '{ title: "Projects", url: "/projects/" }',
  talks: '{ title: "Talks", url: "/talks/" }',
  about: '{ title: "About", url: "/about/" }',
};

function config({ title, author, url, palette, sections }: Answers): string {
  const site = [
    `    title: ${quoted(title)},`,
    url === ""
      ? '    // url: "https://example.com", the address of the site, which the feed and the sitemap need'
      : `    url: ${quoted(url)},`,
    ...(author === "" ? [] : [`    author: ${quoted(author)},`]),
  ];
  return [
    `import { defineConfig } from "${PACKAGE_NAME}";`,
    "",
    "export default defineConfig({",
    "  site: {",
    ...site,
    "  },",
    "  theme: {",
    `    palette: ${quoted(palette)},`,
    "  },",
    "  // The menu, in this order. Without nav, it has the blog, projects, talks and about pages the site has.",
    "  // nav: [",
    ...SECTIONS.filter((section) => sections.includes(section)).map(
      (section) => `  //   ${MENU_EXAMPLE[section]},`,
    ),
    '  //   { title: "GitHub", url: "https://github.com/" },',
    "  // ],",
    "});",
    "",
  ].join("\n");
}

export function starterSite(answers: Answers, details: Details): Record<string, string> {
  const { title, sections, deploy } = answers;
  const { today, folderName } = details;
  const ignored = [
    "dist/",
    "node_modules/",
    ".cloudflare/",
    ...(deploy === "cloudflare" ? [".wrangler/"] : []),
  ];
  const files: Record<string, string> = {
    "package.json": packageJson(details),
    "gensane.config.ts": config(answers),
    ".gitignore": `${ignored.join("\n")}\n`,
    "content/index.md": `---\ntitle: Home\n---\nWelcome to ${title}. This text is in \`content/index.md\`.\n`,
  };
  if (sections.includes("blog")) {
    files[`content/blog/${today}-hello-world.md`] = [
      "---",
      'title: "Hello, world"',
      `date: ${today}`,
      "description: The first post, and how to write the next one",
      "tags: [gensane]",
      "---",
      `The first post of ${title}. Change it, or start a new one:`,
      "",
      "```sh",
      'npx gensane new post "My next post"',
      "```",
      "",
      "Run `npm run dev` to see the site while you write.",
      "",
    ].join("\n");
  }
  if (sections.includes("projects")) {
    files["content/projects/first-project.md"] =
      "---\ntitle: My first project\ndescription: What it does, in one sentence\nstack: [TypeScript]\nfeatured: true\n---\nWhat it is, why it exists, and how it works.\n";
  }
  if (sections.includes("talks")) {
    files["content/talks/first-talk.md"] =
      `---\ntitle: My first talk\nevent: A meetup\ndate: ${today}\n---\n`;
  }
  if (sections.includes("about")) {
    files["content/pages/about.md"] =
      "---\ntitle: About\n---\nWho you are, and what you work on.\n";
  }
  if (deploy !== "none") Object.assign(files, deployFiles(deploy, siteNameOf(folderName)));
  return files;
}
