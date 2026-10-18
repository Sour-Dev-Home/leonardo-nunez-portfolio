import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://leonardonunez.dev",
  trailingSlash: "never",
  // projects/satisfactory-dash.html, served by the Worker at /projects/satisfactory-dash.
  build: { format: "file" },
  integrations: [react(), mdx()],
});
