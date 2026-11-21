/** The files that publish a site on a host, for `gensane init` and `gensane deploy init`. */

export const DEPLOY_TARGETS = ["github", "cloudflare", "netlify"] as const;
export type DeployTarget = (typeof DEPLOY_TARGETS)[number];

/** The Node version the hosts build with. */
const NODE_VERSION = "24";

/**
 * A fixed date rather than today: a Wrangler only a little older than today can't run a site with a
 * later date, and a site of plain files doesn't depend on what changed in the runtime since.
 */
const COMPATIBILITY_DATE = "2026-11-01";

const GITHUB_WORKFLOW = `# Builds the site and publishes it on GitHub Pages on every push to main.
# In the repository's settings, under Pages, set the source to "GitHub Actions".
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${NODE_VERSION}
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
`;

const NETLIFY = `# Netlify builds the site with this command, and publishes dist/.
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "${NODE_VERSION}"
`;

function wrangler(name: string): string {
  const config = {
    name,
    compatibility_date: COMPATIBILITY_DATE,
    assets: { directory: "./dist", not_found_handling: "404-page" },
  };
  return `// Cloudflare serves dist/ as static files. Publish with: npm run build && npx wrangler deploy\n${JSON.stringify(config, null, 2)}\n`;
}

/** The files for a host. `name` names the site on Cloudflare. */
export function deployFiles(target: DeployTarget, name: string): Record<string, string> {
  switch (target) {
    case "github":
      return { ".github/workflows/deploy.yml": GITHUB_WORKFLOW };
    case "cloudflare":
      return { "wrangler.jsonc": wrangler(name) };
    case "netlify":
      return { "netlify.toml": NETLIFY };
  }
}

/** What to do after the files are written, one line for each step. */
export function publishSteps(target: DeployTarget): readonly string[] {
  switch (target) {
    case "github":
      return [
        "Push the site to GitHub, with package-lock.json, and in the repository's settings,",
        'under Pages, set the source to "GitHub Actions".',
      ];
    case "cloudflare":
      return ["npm run build && npx wrangler deploy"];
    case "netlify":
      return ["Push the site to a repository, and add it as a new project on Netlify."];
  }
}

export function isDeployTarget(name: string): name is DeployTarget {
  return DEPLOY_TARGETS.some((target) => target === name);
}
