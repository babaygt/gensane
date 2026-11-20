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

export interface SiteFiles {
  /** Each content file by its path inside `content/`. */
  readonly content: Record<string, string>;
  /** Each `.html` file in `theme/` by its path inside it. */
  readonly templates: Record<string, string>;
  /** The paths of the files in `public/`, which are copied as they are. */
  readonly publicFiles: readonly string[];
}

/** Editors and the system leave files such as `.DS_Store` and `.post.md.swp` next to the real ones. */
function isHidden(path: string): boolean {
  return path.split("/").some((part) => part.startsWith("."));
}

/** Hosts read some files that start with a dot, such as `.nojekyll`, so only this one is left out. */
function isSystemFile(path: string): boolean {
  return path.split("/").at(-1) === ".DS_Store";
}

async function readAll(
  fileSystem: FileSystem,
  folder: string,
  paths: readonly string[],
): Promise<Record<string, string>> {
  const texts = await Promise.all(paths.map((path) => fileSystem.readText(join(folder, path))));
  return Object.fromEntries(paths.map((path, index) => [path, texts[index] ?? ""]));
}

export async function readSiteFolder(
  fileSystem: FileSystem,
  siteFolder: string,
): Promise<SiteFiles> {
  const contentFolder = join(siteFolder, CONTENT);
  const themeFolder = join(siteFolder, THEME);
  const [contentPaths, themePaths, publicPaths] = await Promise.all([
    fileSystem.listFiles(contentFolder),
    fileSystem.listFiles(themeFolder),
    fileSystem.listFiles(join(siteFolder, PUBLIC)),
  ]);
  const templatePaths = themePaths.filter((path) => !isHidden(path) && path.endsWith(".html"));
  return {
    content: await readAll(
      fileSystem,
      contentFolder,
      contentPaths.filter((path) => !isHidden(path)),
    ),
    templates: await readAll(fileSystem, themeFolder, templatePaths),
    publicFiles: publicPaths.filter((path) => !isSystemFile(path)),
  };
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
  /** The paths inside `public/` to copy. */
  readonly publicFiles: readonly string[];
}

/** Empties the output folder, so nothing from an earlier build stays, and writes the site into it. */
export async function writeSite(
  fileSystem: FileSystem,
  { siteFolder, outputFolder, files, publicFiles }: SiteToWrite,
): Promise<Result<void, string>> {
  const problem = outputFolderProblem(siteFolder, outputFolder);
  if (problem !== undefined) return err(problem);

  await fileSystem.removeFolder(outputFolder);
  await Promise.all([
    ...files.map((file) => fileSystem.writeText(join(outputFolder, file.path), file.content)),
    ...publicFiles.map((path) =>
      fileSystem.copyFile(join(siteFolder, PUBLIC, path), join(outputFolder, path)),
    ),
  ]);
  return ok(undefined);
}
