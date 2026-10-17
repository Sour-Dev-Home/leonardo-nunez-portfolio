import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// The site is a Cloudflare Worker serving static assets. Without this config,
// Cloudflare guesses a single-page-app setup: every unknown path returns the home
// page with a 200 instead of the 404 page.
describe("Cloudflare Worker config", () => {
  const path = join(process.cwd(), "wrangler.json");

  it("exists", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("serves the built site with a real 404 and slashless URLs", () => {
    const config = JSON.parse(readFileSync(path, "utf-8"));
    expect(config.name).toBe("leonardo-nunez-portfolio");
    expect(config.main).toBeUndefined();
    expect(config.assets).toEqual({
      directory: "./dist",
      not_found_handling: "404-page",
      html_handling: "drop-trailing-slash",
    });
  });
});
