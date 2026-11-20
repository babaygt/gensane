import { DevServer } from "../dev/dev-server.ts";
import { type Environment, ExitCode } from "../environment.ts";
import { printUsageError } from "../report.ts";
import { Command, type OptionValues } from "./command.ts";

const DEFAULT_PORT = 4000;

function codeOf(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

/** Waits until gensane is asked to stop, such as with Ctrl+C. */
function untilStopped(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

/** Serves the site while it is being written, with drafts, and reloads the browser after every change. */
export class DevCommand extends Command {
  readonly name = "dev";
  readonly summary = "Serve the site while you write, and reload the browser on every change";
  readonly options = {
    port: {
      type: "string",
      valueName: "number",
      description: `Serve on this port instead of ${DEFAULT_PORT}`,
    },
  } as const;

  async run(values: OptionValues, environment: Environment): Promise<number> {
    const { terminal, watcher, siteFolder, stopped } = environment;
    const written = values["port"];
    const port = typeof written === "string" ? Number(written) : DEFAULT_PORT;
    if (!Number.isInteger(port) || port < 0 || port > 65_535 || written === "") {
      printUsageError(
        terminal,
        `"${String(written)}" is not a port`,
        "use a number from 1 to 65535, such as --port 4000",
      );
      return ExitCode.usage;
    }

    const server = new DevServer(environment);
    let actualPort: number;
    try {
      actualPort = await server.listen(port);
    } catch (error) {
      if (codeOf(error) !== "EADDRINUSE") throw error;
      printUsageError(
        terminal,
        `port ${port} is already in use`,
        `stop the other program that uses it, or choose another port, such as --port ${port + 1}`,
      );
      return ExitCode.problems;
    }

    await server.build();
    const stopWatching = watcher.watch(siteFolder, (path) => server.changed(path));
    terminal.write(`Serving the site at http://localhost:${actualPort}/ (press Ctrl+C to stop).`);
    await untilStopped(stopped);
    stopWatching();
    await server.close();
    return ExitCode.success;
  }
}
