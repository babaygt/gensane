#!/usr/bin/env node
// The `gensane` program: the real disk, clock and terminal, given to the command line.
import { readFileSync } from "node:fs";
import { NodeFileSystem, NodeModuleLoader, NodeTerminal, SystemClock } from "../ports/index.ts";
import { runCli } from "./run-cli.ts";

const packageFile = new URL("../../package.json", import.meta.url);
const { version } = JSON.parse(readFileSync(packageFile, "utf8")) as { version: string };

process.exitCode = await runCli(process.argv.slice(2), {
  fileSystem: new NodeFileSystem(),
  moduleLoader: new NodeModuleLoader(),
  clock: new SystemClock(),
  terminal: new NodeTerminal(process.stdout, process.stderr, process.env),
  siteFolder: process.cwd(),
  version,
});
