import { describe, expect, it } from "vitest";
import { outputPath } from "./output-paths.ts";

describe("outputPath", () => {
  it.each([
    ["/", "index.html"],
    ["/blog/", "blog/index.html"],
    ["/blog/page/2/", "blog/page/2/index.html"],
    ["/404.html", "404.html"],
    ["/feed.xml", "feed.xml"],
  ])("writes %s to %s", (url, path) => {
    expect(outputPath(url)).toBe(path);
  });
});
