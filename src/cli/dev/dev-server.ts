/**
 * The server of `gensane dev`. It builds the site in memory, answers requests from that build, builds
 * again when a file changes, and tells every open page to reload.
 */
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { buildFolder, countProblems, countWarnings, pagesOf } from "../build-folder.ts";
import { CONFIG_FILES } from "../config-file.ts";
import type { Environment } from "../environment.ts";
import { count, printProblems } from "../report.ts";
import { type Answer, type ServedSite, answer } from "./answer.ts";
import { EVENTS_PATH, RELOAD_EVENT, withLiveReload } from "./live-reload.ts";
import { filesToCopy } from "../site-folder.ts";
import { problemsPage } from "./problems-page.ts";

/** Editors often save a file in several steps, so changes this close together become one build. */
const QUIET_TIME = 30;

/** Only these parts of the site folder change the site; `dist/` and `node_modules/` don't. */
export function changesSite(path: string): boolean {
  const first = path.split("/")[0] ?? "";
  return ["content", "theme", "public"].includes(first) || CONFIG_FILES.includes(path);
}

export class DevServer {
  readonly #environment: Environment;
  readonly #server: Server;
  readonly #pages = new Set<ServerResponse>();
  #served: ServedSite = { kind: "site", files: new Map(), copies: new Map() };
  #building: Promise<void> | undefined;
  #buildAgain = false;
  /** The last file that changed, which the next build names. */
  #lastChange = "";
  #closed = false;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(environment: Environment) {
    this.#environment = environment;
    this.#server = createServer((request, response) => {
      void this.#respond(request, response);
    });
  }

  /** Starts serving, and gives back the port, or the error the system gave. */
  listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(port, "localhost", () => {
        const address = this.#server.address();
        resolve(typeof address === "object" && address !== null ? address.port : port);
      });
    });
  }

  /**
   * Builds the site, prints its problems, serves the result and reloads every open page. `change` is
   * the file whose change caused the build, if one did.
   */
  async build(change?: string): Promise<void> {
    const { clock, terminal } = this.#environment;
    const started = clock.now().getTime();
    const build = await buildFolder(this.#environment, { drafts: true, servedAtRoot: true });
    const files = build.kind === "config-failed" ? undefined : build.files;
    printProblems(build.problems, files, terminal);

    if (build.kind === "built") {
      this.#served = {
        kind: "site",
        files: new Map(build.site.files.map(({ path, content }) => [path, content])),
        copies: new Map(
          filesToCopy(this.#environment.siteFolder, build.files).map(({ path, source }) => [
            path,
            source,
          ]),
        ),
      };
      const time = clock.now().getTime() - started;
      const done = change === undefined ? "Built" : `${change} changed. Rebuilt`;
      terminal.write(
        `${done} ${count(pagesOf(build.site), "page")} in ${time} ms, with ${countWarnings(build.problems)}.`,
      );
    } else {
      this.#served = { kind: "problems", page: problemsPage(build.problems, files) };
      const changed = change === undefined ? "" : `${change} changed. `;
      terminal.write(
        `${changed}Found ${countProblems(build.problems)}; the browser shows them until they are fixed.`,
      );
    }
    for (const page of this.#pages) page.write(RELOAD_EVENT);
  }

  /** Builds again after a change, once the changes stop for a moment, and never two builds at once. */
  changed(path: string): void {
    if (!changesSite(path)) return;
    this.#lastChange = path;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      void this.#buildAfterChange();
    }, QUIET_TIME);
  }

  async #buildAfterChange(): Promise<void> {
    if (this.#closed) return;
    if (this.#building !== undefined) {
      this.#buildAgain = true;
      return;
    }
    this.#building = this.build(this.#lastChange);
    await this.#building;
    this.#building = undefined;
    if (this.#buildAgain) {
      this.#buildAgain = false;
      await this.#buildAfterChange();
    }
  }

  async close(): Promise<void> {
    this.#closed = true;
    clearTimeout(this.#timer);
    await this.#building;
    for (const page of this.#pages) page.end();
    this.#server.closeAllConnections();
    await new Promise((resolve) => this.#server.close(resolve));
  }

  async #respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    if (pathname === EVENTS_PATH) {
      this.#listen(request, response);
      return;
    }
    await this.#send(answer(this.#served, pathname), response);
  }

  /** Keeps the request open, so a reload can be sent to the page later. */
  #listen(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write(": connected\n\n");
    this.#pages.add(response);
    request.on("close", () => this.#pages.delete(response));
  }

  async #send(reply: Answer, response: ServerResponse): Promise<void> {
    const headers = { "cache-control": "no-store" };
    if (reply.kind === "redirect") {
      response.writeHead(301, { ...headers, location: reply.location }).end();
      return;
    }
    let body: string | Uint8Array;
    let status = 200;
    if (reply.kind === "copy") {
      try {
        body = await this.#environment.fileSystem.readBytes(reply.source);
      } catch {
        // Deleted since the last build; the next build will know.
        response.writeHead(404, headers).end();
        return;
      }
    } else {
      status = reply.status;
      body = reply.type.startsWith("text/html") ? withLiveReload(reply.body) : reply.body;
    }
    response.writeHead(status, { ...headers, "content-type": reply.type });
    // Node leaves out the body of an answer to HEAD by itself.
    response.end(body);
  }
}
