#!/usr/bin/env node
// The `gensane` program: the real disk, clock, terminal and watcher, given to the command line.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  NodeFileSystem,
  NodeModuleLoader,
  NodeTerminal,
  NodeWatcher,
  SystemClock,
} from "../ports/index.ts";
import { runCli } from "./run-cli.ts";

const packageFile = new URL("../../package.json", import.meta.url);
const { version } = JSON.parse(readFileSync(packageFile, "utf8")) as { version: string };

const args = process.argv.slice(2);
const stop = new AbortController();
// Only `dev` runs until it is stopped, and closes its server first. Other commands keep Node's own
// Ctrl+C, which stops them at once.
if (args[0] === "dev") {
  process.once("SIGINT", () => stop.abort());
  process.once("SIGTERM", () => stop.abort());
}

process.exitCode = await runCli(args, {
  fileSystem: new NodeFileSystem(),
  moduleLoader: new NodeModuleLoader(),
  clock: new SystemClock(),
  terminal: new NodeTerminal(process.stdout, process.stderr, process.env),
  watcher: new NodeWatcher(),
  defaultTheme: fileURLToPath(new URL("../../themes/default", import.meta.url)),
  stopped: stop.signal,
  siteFolder: process.cwd(),
  version,
});
