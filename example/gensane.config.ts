import { defineConfig } from "gensane";

export default defineConfig({
  site: {
    title: "Ivy Lambda",
    url: "https://gensane.dev/example",
    description:
      "Notes on compilers, testing and the tools in between, by a developer who doesn't exist.",
    author: { name: "Ivy Lambda" },
    github: "ivy-lambda-example",
  },
  perPage: 4,
  theme: {
    palette: "nord",
    home: { sections: ["intro", "featured-projects", "recent-posts", "talks"] },
  },
});
