// Takes the screenshots of the README and gensane.dev from the example site: the top of its home page in
// each palette, light and dark. Run with `pnpm screenshots` after the theme changes.
import { type ChildProcess, spawn } from "node:child_process";
import { copyFile, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { PALETTES } from "../src/core/index.ts";
import { installGensane } from "../test/support/installed-gensane.ts";

const root = join(import.meta.dirname, "..");
const images = join(root, "docs", "images");
const website = join(root, "website", "public", "images");

/** Starts `gensane dev` on a copy of the example with this palette, and gives its address. */
async function serveExample(
  palette: string,
): Promise<{ address: string; stop: () => Promise<void> }> {
  const site = await mkdtemp(join(tmpdir(), "gensane-screenshots-"));
  await cp(join(root, "example"), site, {
    recursive: true,
    filter: (path) => !path.endsWith("dist"),
  });
  await installGensane(site);
  const config = await readFile(join(site, "gensane.config.ts"), "utf8");
  await writeFile(
    join(site, "gensane.config.ts"),
    config.replace("theme: {", `theme: {\n    palette: "${palette}",`),
  );
  const dev: ChildProcess = spawn(
    process.execPath,
    [join(root, "src", "cli", "main.ts"), "dev", "--port", "0"],
    {
      cwd: site,
      env: { ...process.env, NO_COLOR: "1" },
    },
  );
  const address = await new Promise<string>((resolve, reject) => {
    let output = "";
    dev.stdout?.on("data", (chunk: Buffer) => {
      output += String(chunk);
      const found = /http:\/\/localhost:\d+/.exec(output)?.[0];
      if (found !== undefined) resolve(found);
    });
    dev.on("exit", () => reject(new Error(`gensane dev stopped:\n${output}`)));
  });
  return {
    address,
    stop: async () => {
      const exited = new Promise((resolve) => dev.on("exit", resolve));
      dev.kill("SIGINT");
      await exited;
      await rm(site, { recursive: true, force: true });
    },
  };
}

const browser = await chromium.launch();
try {
  for (const palette of Object.keys(PALETTES)) {
    const { address, stop } = await serveExample(palette);
    try {
      for (const scheme of ["light", "dark"] as const) {
        const context = await browser.newContext({
          colorScheme: scheme,
          viewport: { width: 1100, height: 760 },
        });
        const page = await context.newPage();
        await page.goto(address);
        const name = `palette-${palette}-${scheme}`;
        await page.screenshot({ path: join(images, `${name}.png`) });
        // gensane.dev shows the default palette's pair too.
        if (palette === "default")
          await copyFile(join(images, `${name}.png`), join(website, `${name}.png`));
        await context.close();
        console.log(`docs/images/${name}.png`);
      }
    } finally {
      await stop();
    }
  }
} finally {
  await browser.close();
}
