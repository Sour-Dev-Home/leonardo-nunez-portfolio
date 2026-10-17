import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import { BUDGETS, DEFAULT_BUDGET, pageScriptBytes, pageScriptUrls } from "./budget";
import { page } from "./helpers";

function fixtureDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "budget-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

describe("pageScriptUrls", () => {
  it("collects script src, module preloads and Astro island URLs, once each", () => {
    const html = `
      <script type="module" src="/_astro/a.js"></script>
      <link rel="modulepreload" href="/_astro/b.js">
      <astro-island component-url="/_astro/c.js" renderer-url="/_astro/a.js"></astro-island>
      <link rel="stylesheet" href="/_astro/site.css">`;
    expect(pageScriptUrls(html).sort()).toEqual(["/_astro/a.js", "/_astro/b.js", "/_astro/c.js"]);
  });
});

describe("pageScriptBytes", () => {
  it("is zero for a page with no scripts", () => {
    expect(pageScriptBytes("<p>hi</p>", fixtureDir({}))).toBe(0);
  });

  it("counts inline scripts and local script files, gzipped", () => {
    const code = "console.log('x');".repeat(50);
    const dir = fixtureDir({ "_astro/a.js": code });
    const html = `<script>${code}</script><script src="/_astro/a.js"></script>`;
    expect(pageScriptBytes(html, dir)).toBe(gzipSync(code).length * 2);
  });

  it("counts chunks a script imports, once each, however they are imported", () => {
    const dir = fixtureDir({
      "_astro/island.js": 'import { a } from "./shared.js"; import "./side.js"; const b = () => import("./lazy.js");',
      "_astro/shared.js": 'export * from "./deep.js"; export const a = 1;',
      "_astro/side.js": "console.log('side')",
      "_astro/lazy.js": 'import { a } from "./shared.js"; export const lazy = a;',
      "_astro/deep.js": "export const deep = 'x'.repeat(40);",
    });
    const files = ["island", "shared", "side", "lazy", "deep"].map((n) =>
      gzipSync(readFileSync(join(dir, "_astro", `${n}.js`))).length,
    );
    const html = '<script type="module" src="/_astro/island.js"></script>';
    expect(pageScriptBytes(html, dir)).toBe(files.reduce((a, b) => a + b, 0));
  });

  it("refuses third-party scripts", () => {
    expect(() => pageScriptBytes('<script src="https://cdn.example.com/x.js"></script>', fixtureDir({}))).toThrow(
      /third-party script/,
    );
  });
});

describe("page budgets", () => {
  const dist = join(process.cwd(), "dist");
  const pages = readdirSync(dist, { recursive: true, encoding: "utf-8" }).filter((f) => f.endsWith(".html"));

  it("keeps every page's JavaScript within its budget", () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const file of pages) {
      const path = file.replace(/\\/g, "/");
      const budget = BUDGETS[path] ?? DEFAULT_BUDGET;
      expect(pageScriptBytes(page(path).toString(), dist), path).toBeLessThanOrEqual(budget);
    }
  });
});
