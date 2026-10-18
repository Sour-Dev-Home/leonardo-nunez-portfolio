import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { builtFiles } from "./helpers";

// public/_headers sets browser caching for the Cloudflare Worker's static assets.
// Without it every file is "max-age=0, must-revalidate": the browser asks again on
// every page view. Cloudflare merges the headers of every rule a path matches, so
// two Cache-Control rules on one file would produce a garbled header.

interface Rule {
  pattern: string;
  headers: Record<string, string>;
}

function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: {} });
    else {
      const [name, ...value] = line.trim().split(":");
      rules.at(-1)!.headers[name.trim().toLowerCase()] = value.join(":").trim();
    }
  }
  return rules;
}

/** Cloudflare's matching: a trailing `*` matches the rest of the path. */
function matches(pattern: string, path: string): boolean {
  return pattern.endsWith("*") ? path.startsWith(pattern.slice(0, -1)) : path === pattern;
}

const rules = parseHeaders(readFileSync(join(process.cwd(), "dist", "_headers"), "utf-8"));
const caching = rules.filter((r) => r.headers["cache-control"]);
const cacheFor = (path: string) => caching.filter((r) => matches(r.pattern, path));
// Served URLs: build.format "file" serves about.html at /about, index.html at /.
const urls = builtFiles()
  .filter((f) => f !== "_headers")
  .map((f) => "/" + f.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, ""));
const pages = urls.filter((u) => !/\.\w+$/.test(u) || u === "/");
const assets = urls.filter((u) => !pages.includes(u) && !u.endsWith(".txt"));

describe("cache headers", () => {
  it("cache hashed build files for a year, as immutable", () => {
    const hashed = urls.filter((u) => u.startsWith("/_astro/"));
    expect(hashed.length).toBeGreaterThan(0);
    for (const url of hashed) {
      expect(cacheFor(url).map((r) => r.headers["cache-control"]), url).toEqual([
        "public, max-age=31536000, immutable",
      ]);
    }
  });

  it("give every other static file a cache rule, with no unhashed file marked immutable", () => {
    for (const url of assets.filter((u) => !u.startsWith("/_astro/"))) {
      const found = cacheFor(url);
      expect(found, `${url} has no cache rule: add its folder to public/_headers`).toHaveLength(1);
      expect(found[0].headers["cache-control"], url).not.toMatch(/immutable/);
    }
  });

  it("never let a browser keep a stale page: HTML keeps Cloudflare's revalidate-every-time default", () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const url of pages) expect(cacheFor(url), url).toEqual([]);
  });

  it("never give one file two Cache-Control rules", () => {
    for (const url of urls) expect(cacheFor(url).length, url).toBeLessThanOrEqual(1);
  });
});
