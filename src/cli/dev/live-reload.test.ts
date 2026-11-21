import { describe, expect, it } from "vitest";
import { RELOAD_PATH, withLiveReload } from "./live-reload.ts";

const SCRIPT = `<script>new WebSocket("ws://" + location.host + "${RELOAD_PATH}").addEventListener("message", () => location.reload());</script>`;

describe("withLiveReload", () => {
  it("adds the script just before </body>", () => {
    expect(withLiveReload("<body><p>Hi</p></body></html>")).toBe(
      `<body><p>Hi</p>${SCRIPT}</body></html>`,
    );
  });

  it("finds </body> in any case, and uses the last one", () => {
    expect(withLiveReload("<pre>&lt;/body&gt;</pre></BODY>")).toBe(
      `<pre>&lt;/body&gt;</pre>${SCRIPT}</BODY>`,
    );
    expect(withLiveReload("<p></body></p></body>")).toBe(`<p></body></p>${SCRIPT}</body>`);
  });

  it("adds the script at the end of a page without </body>", () => {
    expect(withLiveReload("<h1>Hello</h1>")).toBe(`<h1>Hello</h1>${SCRIPT}`);
  });
});
