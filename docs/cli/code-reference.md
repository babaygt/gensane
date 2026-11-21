# Code reference

Every source file of the command line, the config and the ports, and their most important names. Select a name to open its file,
then search for that name. Names starting with `#` are private methods of a class.

## Entry points

### [`src/cli/main.ts`](../../src/cli/main.ts)

The `gensane` program: the real disk, clock, terminal, watcher and questions, and Ctrl+C for `dev`.

### [`src/cli/index.ts`](../../src/cli/index.ts)

The public entry point of the command line module.

### [`src/cli/run-cli.ts`](../../src/cli/run-cli.ts)

Reads the arguments, picks the command, and turns every way it can end into an exit code.

| Name                                         | Purpose                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| [`runCli`](../../src/cli/run-cli.ts)         | Runs gensane with the arguments after `gensane`, and gives back the exit code |
| [`parseArguments`](../../src/cli/run-cli.ts) | Node's `util.parseArgs`, with messages and "did you mean" for its errors      |
| [`generalHelp`](../../src/cli/run-cli.ts)    | The list of commands                                                          |

### [`src/cli/environment.ts`](../../src/cli/environment.ts)

| Name                                          | Purpose                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| [`Environment`](../../src/cli/environment.ts) | The disk, config loader, clock, terminal, watcher, prompter and stop signal a command gets |
| [`ExitCode`](../../src/cli/environment.ts)    | 0, 1 and 2                                                                       |

## Commands

### [`src/cli/commands/command.ts`](../../src/cli/commands/command.ts)

| Name                                              | Purpose                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| [`Command`](../../src/cli/commands/command.ts)    | An abstract class: a name, arguments, help and `run`      |
| [`OptionSpec`](../../src/cli/commands/command.ts) | One argument: its kind, its description and what it holds |

### [`src/cli/commands/site-command.ts`](../../src/cli/commands/site-command.ts)

| Name                                                    | Purpose                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`SiteCommand`](../../src/cli/commands/site-command.ts) | The steps of build and check, with what happens before and after left to each (a template method) |

### [`src/cli/commands/build-command.ts`](../../src/cli/commands/build-command.ts)

| Name                                                        | Purpose                                              |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| [`BuildCommand`](../../src/cli/commands/build-command.ts)   | Checks `--out` first, and writes the site at the end |
| [`outputFolderOf`](../../src/cli/commands/build-command.ts) | `dist/`, or the folder after `--out`                 |

### [`src/cli/commands/check-command.ts`](../../src/cli/commands/check-command.ts)

| Name                                                      | Purpose                    |
| --------------------------------------------------------- | -------------------------- |
| [`CheckCommand`](../../src/cli/commands/check-command.ts) | Builds, and writes nothing |

### [`src/cli/commands/new-command.ts`](../../src/cli/commands/new-command.ts)

| Name                                                  | Purpose                                                   |
| ----------------------------------------------------- | --------------------------------------------------------- |
| [`NewCommand`](../../src/cli/commands/new-command.ts) | The type, the title, `--slug`, and never replacing a file |

### [`src/cli/commands/init-command.ts`](../../src/cli/commands/init-command.ts)

| Name                                                    | Purpose                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`InitCommand`](../../src/cli/commands/init-command.ts) | The folder, `--yes`, `--deploy`, the questions, and never writing into a full folder |
| [`askUntil`](../../src/cli/commands/init-command.ts)    | Asks again, with the reason, until an answer fits                        |

### [`src/cli/commands/deploy-command.ts`](../../src/cli/commands/deploy-command.ts)

| Name                                                        | Purpose                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| [`DeployCommand`](../../src/cli/commands/deploy-command.ts) | `deploy init <host>`, and never replacing a file           |

### [`src/cli/init/deploy-files.ts`](../../src/cli/init/deploy-files.ts)

| Name                                                  | Purpose                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| [`deployFiles`](../../src/cli/init/deploy-files.ts)    | The file that publishes the site on a host                    |
| [`publishSteps`](../../src/cli/init/deploy-files.ts)   | What to do after the file is written                          |
| [`DEPLOY_TARGETS`](../../src/cli/init/deploy-files.ts) | GitHub Pages, Cloudflare and Netlify                          |
| [`isDeployTarget`](../../src/cli/init/deploy-files.ts) | Whether a name is one of them                                 |

### [`src/cli/init/starter-site.ts`](../../src/cli/init/starter-site.ts)

| Name                                                  | Purpose                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| [`starterSite`](../../src/cli/init/starter-site.ts)   | The files of a new site, made from the answers             |
| [`Answers`](../../src/cli/init/starter-site.ts)       | The title, the author, the address, the parts, the palette, the host |
| [`SECTIONS`](../../src/cli/init/starter-site.ts)      | The parts a site can start with                            |
| [`siteNameOf`](../../src/cli/init/starter-site.ts) | A name for the site from its folder, for npm and Cloudflare |

### [`src/cli/local-day.ts`](../../src/cli/local-day.ts)

| Name                                         | Purpose                                                       |
| -------------------------------------------- | ------------------------------------------------------------- |
| [`localDay`](../../src/cli/local-day.ts)     | Today on the computer's own calendar, for `new` and `init`    |

### [`src/cli/commands/dev-command.ts`](../../src/cli/commands/dev-command.ts)

| Name                                                    | Purpose                                                |
| ------------------------------------------------------- | ------------------------------------------------------ |
| [`DevCommand`](../../src/cli/commands/dev-command.ts)   | `--port`, a busy port, and running until it is stopped |
| [`untilStopped`](../../src/cli/commands/dev-command.ts) | Waits for Ctrl+C                                       |

### [`src/cli/commands/theme-command.ts`](../../src/cli/commands/theme-command.ts)

| Name                                                        | Purpose                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| [`ThemeCommand`](../../src/cli/commands/theme-command.ts)   | `theme eject`: copies the default theme, never replacing a file |

## Reading, building and printing

### [`src/cli/site-folder.ts`](../../src/cli/site-folder.ts)

| Name                                                  | Purpose                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| [`readSiteFolder`](../../src/cli/site-folder.ts)      | `content/`, `theme/` and `public/` as the text `buildSite` takes |
| [`isHidden`](../../src/cli/site-folder.ts)            | Names starting with a dot, left out of `content/` and `theme/`   |
| [`outputFolderProblem`](../../src/cli/site-folder.ts) | Why an output folder can't be used, if it can't                  |
| [`writeSite`](../../src/cli/site-folder.ts)           | Empties the output folder, and writes the site into it           |

### [`src/cli/config-file.ts`](../../src/cli/config-file.ts)

| Name                                           | Purpose                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| [`loadConfig`](../../src/cli/config-file.ts)   | Finds the config file, runs it, and checks its default export |
| [`hintFor`](../../src/cli/config-file.ts)      | A hint for each of Node's errors                              |
| [`CONFIG_FILES`](../../src/cli/config-file.ts) | The names a config can have                                   |

### [`src/cli/build-folder.ts`](../../src/cli/build-folder.ts)

| Name                                           | Purpose                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`buildFolder`](../../src/cli/build-folder.ts) | Loads the config, reads the site folder and builds: the steps build, check and dev share |
| [`FolderBuild`](../../src/cli/build-folder.ts) | The config failed, the site failed, or the site built                                    |
| [`pagesOf`](../../src/cli/build-folder.ts)     | The `.html` files of a built site                                                        |

### [`src/cli/report.ts`](../../src/cli/report.ts)

| Name                                         | Purpose                                                              |
| -------------------------------------------- | -------------------------------------------------------------------- |
| [`printProblems`](../../src/cli/report.ts)   | Each problem with its source                                         |
| [`located`](../../src/cli/report.ts)         | Shows a template's problems at its file in `theme/`, with its source |
| [`printUsageError`](../../src/cli/report.ts) | A mistake in the command                                             |

## The dev server

### [`src/cli/dev/dev-server.ts`](../../src/cli/dev/dev-server.ts)

| Name                                                   | Purpose                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| [`DevServer`](../../src/cli/dev/dev-server.ts)         | HTTP, builds after changes, and reloads over WebSockets            |
| [`#buildAfterChange`](../../src/cli/dev/dev-server.ts) | Never two builds at once, and one more for a change during a build |
| [`changesSite`](../../src/cli/dev/dev-server.ts)       | Only `content/`, `theme/`, `public/` and the config                |

### [`src/cli/dev/answer.ts`](../../src/cli/dev/answer.ts)

Pure: how a request is answered.

| Name                                        | Purpose                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| [`answer`](../../src/cli/dev/answer.ts)     | A file of the build, a public file, a redirect, or the 404 page |
| [`ServedSite`](../../src/cli/dev/answer.ts) | The last build, or its problems                                 |
| [`typeOf`](../../src/cli/dev/answer.ts)     | The media type of a file                                        |

### [`src/cli/dev/live-reload.ts`](../../src/cli/dev/live-reload.ts)

Pure.

| Name                                                 | Purpose                                 |
| ---------------------------------------------------- | --------------------------------------- |
| [`withLiveReload`](../../src/cli/dev/live-reload.ts) | Adds the reload script before `</body>` |
| [`RELOAD_PATH`](../../src/cli/dev/live-reload.ts)    | Where pages listen for the next build   |

### [`src/cli/dev/web-socket.ts`](../../src/cli/dev/web-socket.ts)

The part of the WebSocket protocol (RFC 6455) that live reload needs. Pure, apart from `node:crypto` for the handshake.

| Name                                               | Purpose                                                        |
| -------------------------------------------------- | -------------------------------------------------------------- |
| [`acceptKey`](../../src/cli/dev/web-socket.ts)     | The server's answer to a browser's handshake key               |
| [`frame`](../../src/cli/dev/web-socket.ts)         | A whole frame, as a server sends it, with its length encoded   |
| [`textFrame`](../../src/cli/dev/web-socket.ts)     | A text message                                                 |
| [`closeFrame`](../../src/cli/dev/web-socket.ts)    | Closing, with the reason as a code                             |
| [`opcodeOf`](../../src/cli/dev/web-socket.ts)      | The kind of a frame a browser sent                             |

### [`src/cli/dev/problems-page.ts`](../../src/cli/dev/problems-page.ts)

Pure.

| Name                                                 | Purpose                                    |
| ---------------------------------------------------- | ------------------------------------------ |
| [`problemsPage`](../../src/cli/dev/problems-page.ts) | The problems as a page, as in the terminal |

## The config

### [`src/config/index.ts`](../../src/config/index.ts)

The public entry point of the config module.

### [`src/config/config.ts`](../../src/config/config.ts)

| Name                                          | Purpose                                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| [`GensaneConfig`](../../src/config/config.ts) | Every setting                                               |
| [`SiteSettings`](../../src/config/config.ts)  | The settings of `site`, and any other for the templates     |
| [`defineConfig`](../../src/config/config.ts)  | Gives the editor the types, and returns the config as it is |

### [`src/config/check-config.ts`](../../src/config/check-config.ts)

| Name                                                | Purpose                                                 |
| --------------------------------------------------- | ------------------------------------------------------- |
| [`checkConfig`](../../src/config/check-config.ts)   | Checks every setting, and reports every problem at once |
| [`describeFound`](../../src/config/check-config.ts) | What a wrong value is, for the message                  |
| [`configProblem`](../../src/config/check-config.ts) | A problem at the start of the config file               |

### [`src/config/diagnostic-codes.ts`](../../src/config/diagnostic-codes.ts)

| Name                                                  | Purpose        |
| ----------------------------------------------------- | -------------- |
| [`ConfigCodes`](../../src/config/diagnostic-codes.ts) | GS501 to GS506 |

## Ports

### [`src/ports/index.ts`](../../src/ports/index.ts)

The public entry point of the ports.

### [`src/ports/file-system.ts`](../../src/ports/file-system.ts)

| Name                                           | Purpose                                             |
| ---------------------------------------------- | --------------------------------------------------- |
| [`FileSystem`](../../src/ports/file-system.ts) | List, check, read, write, copy, and remove a folder |

### [`src/ports/node-file-system.ts`](../../src/ports/node-file-system.ts)

| Name                                                    | Purpose       |
| ------------------------------------------------------- | ------------- |
| [`NodeFileSystem`](../../src/ports/node-file-system.ts) | The real disk |

### [`src/ports/memory-file-system.ts`](../../src/ports/memory-file-system.ts)

| Name                                                        | Purpose                     |
| ----------------------------------------------------------- | --------------------------- |
| [`MemoryFileSystem`](../../src/ports/memory-file-system.ts) | A disk in memory, for tests |

### [`src/ports/module-loader.ts`](../../src/ports/module-loader.ts)

| Name                                                   | Purpose                                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| [`ModuleLoader`](../../src/ports/module-loader.ts)     | Runs a config file                                  |
| [`NodeModuleLoader`](../../src/ports/module-loader.ts) | Node's `import()`, with a new address for each load |

### [`src/ports/clock.ts`](../../src/ports/clock.ts)

| Name                                      | Purpose              |
| ----------------------------------------- | -------------------- |
| [`Clock`](../../src/ports/clock.ts)       | The time             |
| [`SystemClock`](../../src/ports/clock.ts) | The computer's clock |

### [`src/ports/terminal.ts`](../../src/ports/terminal.ts)

| Name                                            | Purpose                                       |
| ----------------------------------------------- | --------------------------------------------- |
| [`Terminal`](../../src/ports/terminal.ts)       | Results, problems, and whether to color       |
| [`wantsColor`](../../src/ports/terminal.ts)     | Only in a terminal, and never with `NO_COLOR` |
| [`NodeTerminal`](../../src/ports/terminal.ts)   | The real output and error streams             |
| [`MemoryTerminal`](../../src/ports/terminal.ts) | Keeps what is written, for tests              |

### [`src/ports/watcher.ts`](../../src/ports/watcher.ts)

| Name                                          | Purpose                        |
| --------------------------------------------- | ------------------------------ |
| [`Watcher`](../../src/ports/watcher.ts)       | Tells when files change        |
| [`NodeWatcher`](../../src/ports/watcher.ts)   | Node's `fs.watch`              |
| [`ManualWatcher`](../../src/ports/watcher.ts) | A watcher tests change by hand |

### [`src/ports/prompter.ts`](../../src/ports/prompter.ts)

| Name                                               | Purpose                                                  |
| -------------------------------------------------- | -------------------------------------------------------- |
| [`Prompter`](../../src/ports/prompter.ts)          | Asks the person at the terminal, as `gensane init` does  |
| [`NodePrompter`](../../src/ports/prompter.ts)      | Node's `readline`, at a real terminal                    |
| [`ScriptedPrompter`](../../src/ports/prompter.ts)  | Answers from a list, for tests                           |
| [`AskingStopped`](../../src/ports/prompter.ts)     | The person stopped with Ctrl+C                           |
