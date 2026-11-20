/** Reloads the browser after every build, over server-sent events. */

/** Where the browser listens. No page of a site starts with `__gensane`. */
export const EVENTS_PATH = "/__gensane/events";

const SCRIPT = `<script>new EventSource("${EVENTS_PATH}").addEventListener("reload", () => location.reload());</script>`;

/** Adds the script before `</body>`, or at the end when the page has none. Only `gensane dev` adds it. */
export function withLiveReload(html: string): string {
  const end = html.toLowerCase().lastIndexOf("</body>");
  return end === -1 ? `${html}${SCRIPT}` : `${html.slice(0, end)}${SCRIPT}${html.slice(end)}`;
}

/** What is sent to every open page after a build. */
export const RELOAD_EVENT = "event: reload\ndata: \n\n";
