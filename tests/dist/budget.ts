import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/** Gzipped bytes of JavaScript a page loads: inline scripts plus local script files. */
export function pageScriptBytes(html: string, distDir: string): number {
  const inline = parse(html)
    .querySelectorAll("script:not([src])")
    .reduce((sum, s) => sum + (s.text.trim() ? gzipSync(s.text).length : 0), 0);
  const files = pageScriptUrls(html).reduce((sum, url) => {
    if (/^(https?:)?\/\//.test(url)) throw new Error(`third-party script not allowed: ${url}`);
    return sum + gzipSync(readFileSync(join(distDir, url.replace(/^\//, "")))).length;
  }, 0);
  return inline + files;
}
