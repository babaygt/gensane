import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEPLOY_TARGETS, deployFiles, isDeployTarget, publishSteps } from "./deploy-files.ts";

const workflow = deployFiles("github", "my-site")[".github/workflows/deploy.yml"] ?? "";

describe("deployFiles", () => {
  it("writes one file for each host", () => {
    expect(DEPLOY_TARGETS.map((target) => Object.keys(deployFiles(target, "my-site")))).toEqual([
      [".github/workflows/deploy.yml"],
      ["wrangler.jsonc"],
      ["netlify.toml"],
    ]);
  });

  it("builds on GitHub with npm and publishes dist/ with GitHub's own Pages actions", () => {
    for (const line of [
      "    branches: [main]",
      "  pages: write",
      "  id-token: write",
      "      - run: npm ci",
      "      - run: npm run build",
      "      - uses: actions/upload-pages-artifact@v5",
      "          path: dist",
      "      name: github-pages",
      "      url: ${{ steps.deployment.outputs.page_url }}",
      "        uses: actions/deploy-pages@v5",
    ]) {
      expect(workflow.split("\n")).toContain(line);
    }
  });

  it("serves dist/ on Cloudflare under the site's name, with its own 404 page", () => {
    const [comment, ...json] = (deployFiles("cloudflare", "my-site")["wrangler.jsonc"] ?? "").split(
      "\n",
    );
    expect(comment).toBe(
      "// Cloudflare serves dist/ as static files. Publish with: npm run build && npx wrangler deploy",
    );
    expect(JSON.parse(json.join("\n"))).toEqual({
      name: "my-site",
      compatibility_date: "2026-11-01",
      assets: { directory: "./dist", not_found_handling: "404-page" },
    });
  });

  it("builds on Netlify with npm and publishes dist/", () => {
    expect(deployFiles("netlify", "my-site")["netlify.toml"]).toBe(
      [
        "# Netlify builds the site with this command, and publishes dist/.",
        "[build]",
        '  command = "npm run build"',
        '  publish = "dist"',
        "",
        "[build.environment]",
        '  NODE_VERSION = "24"',
        "",
      ].join("\n"),
    );
  });

  it("builds with a Node version gensane runs on", () => {
    const engines = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "..", "..", "package.json"), "utf8"),
    ).engines.node as string;
    const lowest = Number(/\d+/.exec(engines)?.[0]);
    expect(workflow).toContain("node-version: 24");
    expect(24).toBeGreaterThan(lowest);
  });
});

describe("publishSteps", () => {
  it.each(DEPLOY_TARGETS)("says how to publish on %s", (target) => {
    expect(publishSteps(target).length).toBeGreaterThan(0);
  });

  it("publishes on Cloudflare with Wrangler, after a build", () => {
    expect(publishSteps("cloudflare")).toEqual(["npm run build && npx wrangler deploy"]);
  });
});

describe("isDeployTarget", () => {
  it.each([...DEPLOY_TARGETS])("knows %s", (target) => {
    expect(isDeployTarget(target)).toBe(true);
  });

  it.each(["vercel", "none", "GitHub", ""])("doesn't know %j", (name) => {
    expect(isDeployTarget(name)).toBe(false);
  });
});
