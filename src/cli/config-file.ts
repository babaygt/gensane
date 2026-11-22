/** Finds the config file of a site, runs it, and checks its settings. */
import { join } from "node:path";
import { type CheckedConfig, ConfigCodes, checkConfig, configProblem } from "../config/index.ts";
import { type Diagnostic, type Result, err, ok } from "../diagnostics/index.ts";
import type { FileSystem, ModuleLoader } from "../ports/index.ts";
import { PACKAGE_NAME } from "./package-name.ts";

export const CONFIG_FILES = ["gensane.config.ts", "gensane.config.js", "gensane.config.mjs"];

export interface LoadedConfig extends CheckedConfig {
  /** The config file inside the site folder, if the site has one. */
  readonly file: string | undefined;
}

/** Node's messages can go on for many lines, with where in Node the mistake was noticed. */
function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? "";
}

function hintFor(error: unknown): string {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code === "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX") {
    return "Node runs the config by removing its types, so it can't use TypeScript that needs compiling, such as an enum; use a union of strings or an object instead";
  }
  if (code === "ERR_MODULE_NOT_FOUND") {
    return firstLineOf(error).includes(`'${PACKAGE_NAME}'`)
      ? `install gensane in the site folder: npm install --save-dev ${PACKAGE_NAME}`
      : "install the package the config imports, or correct its name";
  }
  return "fix the mistake in the config; running it with node shows where it is";
}

export async function loadConfig(
  fileSystem: FileSystem,
  moduleLoader: ModuleLoader,
  siteFolder: string,
): Promise<Result<LoadedConfig, readonly Diagnostic[]>> {
  const found: string[] = [];
  for (const name of CONFIG_FILES) {
    if (await fileSystem.isFile(join(siteFolder, name))) found.push(name);
  }
  const [file, second] = found;
  if (file === undefined) return ok({ config: {}, file: undefined, warnings: [] });
  if (second !== undefined) {
    const message = `there are two config files: "${file}" and "${second}"`;
    return err([configProblem(second, ConfigCodes.twoConfigFiles, message, "keep one of them")]);
  }

  let exports: Readonly<Record<string, unknown>>;
  try {
    exports = await moduleLoader.load(join(siteFolder, file));
  } catch (error) {
    const message = `the config couldn't be loaded: ${firstLineOf(error)}`;
    return err([configProblem(file, ConfigCodes.notLoaded, message, hintFor(error))]);
  }
  const checked = checkConfig(exports["default"], file);
  return checked.ok ? ok({ ...checked.value, file }) : checked;
}
