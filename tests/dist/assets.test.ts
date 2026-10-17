import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { distFileExists, metaContent, page } from "./helpers";

function builtPages(dir = join(process.cwd(), "dist"), prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? builtPages(join(dir, entry.name), `${prefix}${entry.name}/`)
      : entry.name.endsWith(".html")
        ? [`${prefix}${entry.name}`]
        : [],
  );
}

describe("shared assets", () => {
  it("includes the default link-preview image every page without its own falls back to", () => {
    expect(distFileExists("og/default.png")).toBe(true);
  });

  it("gives every page a link-preview image that exists in the build", () => {
    const pages = builtPages();
    expect(pages.length).toBeGreaterThan(0);
    for (const file of pages) {
      const image = metaContent(page(file), 'meta[property="og:image"]');
      expect(image, file).toBeDefined();
      expect(distFileExists(new URL(image!).pathname.slice(1)), `${file} -> ${image}`).toBe(true);
    }
  });

  it("keeps every page's description short enough that search and previews don't cut it", () => {
    for (const file of builtPages()) {
      const doc = page(file);
      for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
        const content = metaContent(doc, selector) ?? "";
        expect(content.length, `${file} ${selector}`).toBeGreaterThan(0);
        expect(content.length, `${file} ${selector}`).toBeLessThanOrEqual(160);
      }
    }
  });
});
