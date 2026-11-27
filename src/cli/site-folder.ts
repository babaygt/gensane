/**
 * Reads a site folder into the text that `buildSite` takes, and writes what it builds. The folders
 * have fixed names, so every site looks the same.
 */
import { isAbsolute, join, relative, sep } from "node:path";
import type { OutputFile } from "../core/index.ts";
import { type Result, err, ok } from "../diagnostics/index.ts";
import type { FileSystem } from "../ports/index.ts";

const CONTENT = "content";
const PUBLIC = "public";
const THEME = "theme";
/** The folder of a theme whose files are copied into the site, at the same path. */
const ASSETS = "assets";

/** A file copied into the site as it is, from `public/` or from a theme's `assets/`. */
export interface CopiedFile {
  /** Where it goes in the site, such as `assets/style.css`. */
  readonly path: string;
  /** Where it is read from. */
  readonly source: string;
}

export interface SiteFiles {
  /** Each content file by its path inside `content/`. */
  readonly content: Record<string, string>;
  /** Each template by its path inside the theme, from the site's `theme/` or else from the default theme. */
  readonly templates: Record<string, string>;
  /** Where each template was read from, for problems: `theme/post.html`, or the file of the default theme. */
  readonly templateFiles: Record<string, string>;
  /** The paths of the files in `public/`. */
  readonly publicFiles: readonly string[];
  /** The files of the theme's `assets/` folder, which go to `/assets/` in the site. */
  readonly themeAssets: readonly CopiedFile[];
  /** The site's own `head.html`, when it has one. */
  readonly head?: string;
}

/** Editors and the system leave files such as `.DS_Store` and `.post.md.swp` next to the real ones. */
function isHidden(path: string): boolean {
  return path.split("/").some((part) => part.startsWith("."));
}

/** Hosts read some files that start with a dot, such as `.nojekyll`, so only this one is left out. */
function isSystemFile(path: string): boolean {
  return path.split("/").at(-1) === ".DS_Store";
}

/** `../gensane/themes/default` with `/` on every system, as problems show paths. */
function shownPath(siteFolder: string, path: string): string {
  return relative(siteFolder, path).split(sep).join("/");
}

async function readAll(
  fileSystem: FileSystem,
  sources: Readonly<Record<string, string>>,
): Promise<Record<string, string>> {
  const entries = Object.entries(sources);
  const texts = await Promise.all(entries.map(([, source]) => fileSystem.readText(source)));
  return Object.fromEntries(entries.map(([name], index) => [name, texts[index] ?? ""]));
}

/**
 * The files of the theme by their path inside it. A file of the site's `theme/` replaces the file
 * with the same path in the default theme.
 */
async function themeFiles(
  fileSystem: FileSystem,
  siteFolder: string,
  defaultTheme: string,
): Promise<Map<string, string>> {
  const siteTheme = join(siteFolder, THEME);
  const [defaults, own] = await Promise.all([
    fileSystem.listFiles(defaultTheme),
    fileSystem.listFiles(siteTheme),
  ]);
  const files = new Map<string, string>();
  for (const path of defaults) if (!isHidden(path)) files.set(path, join(defaultTheme, path));
  for (const path of own) if (!isHidden(path)) files.set(path, join(siteTheme, path));
  return files;
}

export async function readSiteFolder(
  fileSystem: FileSystem,
  siteFolder: string,
  defaultTheme: string,
): Promise<SiteFiles> {
  const contentFolder = join(siteFolder, CONTENT);
  const [contentPaths, publicPaths, theme] = await Promise.all([
    fileSystem.listFiles(contentFolder),
    fileSystem.listFiles(join(siteFolder, PUBLIC)),
    themeFiles(fileSystem, siteFolder, defaultTheme),
  ]);
  const contentSources = Object.fromEntries(
    contentPaths.filter((path) => !isHidden(path)).map((path) => [path, join(contentFolder, path)]),
  );
  const templateSources = Object.fromEntries(
    [...theme].filter(([path]) => path.endsWith(".html") && !path.startsWith(`${ASSETS}/`)),
  );
  const themeAssets = [...theme]
    .filter(([path]) => path.startsWith(`${ASSETS}/`))
    .map(([path, source]) => ({ path, source }));
  return {
    content: await readAll(fileSystem, contentSources),
    templates: await readAll(fileSystem, templateSources),
    templateFiles: Object.fromEntries(
      Object.entries(templateSources).map(([name, source]) => [
        name,
        shownPath(siteFolder, source),
      ]),
    ),
    publicFiles: publicPaths.filter((path) => !isSystemFile(path)),
    themeAssets,
  };
}

/** Every file copied into the site as it is: the public files and the theme's assets. */
export function filesToCopy(siteFolder: string, files: SiteFiles): CopiedFile[] {
  const publicFiles = files.publicFiles.map((path) => ({
    path,
    source: join(siteFolder, PUBLIC, path),
  }));
  return [...publicFiles, ...files.themeAssets];
}

/**
 * Why the output folder can't be used, if it can't. It is emptied before every build, so it must be
 * inside the site folder and must not hold the site's own files.
 */
export function outputFolderProblem(siteFolder: string, outputFolder: string): string | undefined {
  const inside = relative(siteFolder, outputFolder);
  // Shown from the site folder, as it is written after --out.
  const shown = inside === "" ? "." : inside.split(sep).join("/");
  if (inside === "") return `the output folder "${shown}" is the site folder itself`;
  if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    return `the output folder "${shown}" isn't inside the site folder`;
  }
  const first = inside.split(sep)[0];
  if (first === CONTENT || first === PUBLIC || first === THEME) {
    return `the output folder "${shown}" would replace ${first}/`;
  }
  return undefined;
}

export interface SiteToWrite {
  readonly siteFolder: string;
  readonly outputFolder: string;
  readonly files: readonly OutputFile[];
  readonly copies: readonly CopiedFile[];
}

/** Empties the output folder, so nothing from an earlier build stays, and writes the site into it. */
export async function writeSite(
  fileSystem: FileSystem,
  { siteFolder, outputFolder, files, copies }: SiteToWrite,
): Promise<Result<void, string>> {
  const problem = outputFolderProblem(siteFolder, outputFolder);
  if (problem !== undefined) return err(problem);

  await fileSystem.removeFolder(outputFolder);
  await Promise.all([
    ...files.map((file) => fileSystem.writeText(join(outputFolder, file.path), file.content)),
    ...copies.map(({ path, source }) => fileSystem.copyFile(source, join(outputFolder, path))),
  ]);
  return ok(undefined);
}
