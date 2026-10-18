import { describe, it, expect } from "vitest";
import { builtCss, distFileExists, page } from "./helpers";

const css = builtCss();

describe("fonts", () => {
  it("are self-hosted, with no font CDN anywhere", () => {
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com|jsdelivr|unpkg/);
    for (const file of [
      "fonts/fraunces-latin-full-normal.woff2",
      "fonts/public-sans-latin-wght-normal.woff2",
      "fonts/gochi-hand-latin-400-normal.woff2",
    ]) {
      expect(distFileExists(file), file).toBe(true);
    }
  });

  it("never swap in late (font-display: optional on every face)", () => {
    // Inlined CSS repeats per page, so count distinct faces.
    const faces = [...new Set(css.match(/@font-face\s*{[^}]*}/g) ?? [])];
    expect(faces.length).toBe(4);
    for (const face of faces) expect(face).toMatch(/font-display:\s*optional/);
  });

  it("preloads the two faces every page uses", () => {
    const preloads = page("index.html")
      .querySelectorAll('link[rel="preload"][as="font"]')
      .map((l) => l.getAttribute("href"));
    expect(preloads.sort()).toEqual([
      "/fonts/fraunces-latin-full-normal.woff2",
      "/fonts/public-sans-latin-wght-normal.woff2",
    ]);
  });
});

describe("the 404 page", () => {
  it("asks search engines not to index it", () => {
    expect(page("404.html").querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
  });
});
