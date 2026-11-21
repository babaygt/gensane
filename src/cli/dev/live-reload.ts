/** Reloads the browser after every build, over a WebSocket. */

/** Where the browser listens. No page of a site starts with `__gensane`. */
export const RELOAD_PATH = "/__gensane/reload";

const SCRIPT = `<script>new WebSocket("ws://" + location.host + "${RELOAD_PATH}").addEventListener("message", () => location.reload());</script>`;

/** Adds the script before `</body>`, or at the end when the page has none. Only `gensane dev` adds it. */
export function withLiveReload(html: string): string {
  const end = html.toLowerCase().lastIndexOf("</body>");
  return end === -1 ? `${html}${SCRIPT}` : `${html.slice(0, end)}${SCRIPT}${html.slice(end)}`;
}

/** What is sent to every open page after a build. */
export const RELOAD_MESSAGE = "reload";
