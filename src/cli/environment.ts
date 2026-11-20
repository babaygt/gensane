import type { Clock, FileSystem, ModuleLoader, Terminal, Watcher } from "../ports/index.ts";

/** Everything a command needs from outside. `main.ts` gives the real ones; tests give versions in memory. */
export interface Environment {
  readonly fileSystem: FileSystem;
  readonly moduleLoader: ModuleLoader;
  readonly clock: Clock;
  readonly terminal: Terminal;
  readonly watcher: Watcher;
  /** Aborted when gensane should stop, such as on Ctrl+C. Only `gensane dev` keeps running until then. */
  readonly stopped: AbortSignal;
  /** The folder gensane runs in, which is the site folder. */
  readonly siteFolder: string;
  readonly version: string;
}

/** Exit codes, so that scripts and CI can tell what happened. */
export const ExitCode = {
  success: 0,
  /** The site has errors. */
  problems: 1,
  /** The command was written wrong. */
  usage: 2,
} as const;
