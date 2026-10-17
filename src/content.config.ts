import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { projectSchema } from "./lib/projects";

// One folder per project: src/content/projects/<slug>/index.md(x). The folder name
// is the entry id and the case-study URL. A file with no body is a data-only project.
const projects = defineCollection({
  loader: glob({
    pattern: "*/index.{md,mdx}",
    base: "./src/content/projects",
    generateId: ({ entry }) => entry.split("/")[0],
  }),
  schema: projectSchema,
});

export const collections = { projects };
