import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";

export default defineConfig({
  // Plan 5 switches this to the custom domain.
  site: "https://leonardo-nunez-portfolio.pages.dev",
  trailingSlash: "never",
  // projects/satisfactory-dash.html, served by Cloudflare Pages at /projects/satisfactory-dash.
  build: { format: "file" },
  // Keep straight quotes and dashes exactly as written, as the old marked renderer
  // did. The Editorial redesign (Plan 3) decides whether to turn typographic quotes on.
  markdown: { smartypants: false },
  integrations: [react(), mdx()],
});
