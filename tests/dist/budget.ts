import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { gzipSync } from "node:zlib";
import { parse } from "node-html-parser";

/** Gzipped JavaScript budget per built page, in bytes. A world can set its own. */
export const DEFAULT_BUDGET = 60_000;
export const BUDGETS: Record<string, number> = {};

/** Every script URL a page loads: script src, module preloads and Astro island bundles. */
export function pageScriptUrls(html: string): string[] {
  const doc = parse(html);
  const urls = [
    ...doc.querySelectorAll("script[src]").map((s) => s.getAttribute("src")),
    ...doc.querySelectorAll('link[rel="modulepreload"]').map((l) => l.getAttribute("href")),
    ...doc
      .querySelectorAll("astro-island")
      .flatMap((i) => [i.getAttribute("component-url"), i.getAttribute("renderer-url")]),
  ];
  return [...new Set(urls.filter((u): u is string => !!u))];
}

// Static `import … from "./x.js"`, bare `import "./x.js"`, `export … from "./x.js"`
// and dynamic `import("./x.js")`: the shared chunks an island pulls in never
// appear in the HTML, only in the files that import them.
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;

/** Root-relative URLs of a script and every local chunk it imports, transitively. */
function withImports(url: string, distDir: string, seen: Set<string>): void {
  if (seen.has(url)) return;
  seen.add(url);
  const source = readFileSync(join(distDir, url.replace(/^\//, "")), "utf-8");
  for (const [, spec] of source.matchAll(IMPORT)) {
    withImports(posix.normalize(posix.join(dirname(url), spec)), distDir, seen);
  }
}

/** Gzipped bytes of JavaScript a page loads: inline scripts plus local script files and their imports. */
export function pageScriptBytes(html: string, distDir: string): number {
  const inline = parse(html)
    .querySelectorAll("script:not([src])")
    .reduce((sum, s) => sum + (s.text.trim() ? gzipSync(s.text).length : 0), 0);
  const seen = new Set<string>();
  for (const url of pageScriptUrls(html)) {
    if (/^(https?:)?\/\//.test(url)) throw new Error(`third-party script not allowed: ${url}`);
    withImports(url, distDir, seen);
  }
  const files = [...seen].reduce(
    (sum, url) => sum + gzipSync(readFileSync(join(distDir, url.replace(/^\//, "")))).length,
    0,
  );
  return inline + files;
}
