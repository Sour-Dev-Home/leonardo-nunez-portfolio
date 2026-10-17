import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { PAGES } from "../../e2e/pages";

// The browser tests (layout, axe, loading, screenshots) and Lighthouse run on
// listed pages. A new page that isn't listed would pass CI untested.
const built = readdirSync(join(process.cwd(), "dist"), { recursive: true, encoding: "utf-8" })
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(/\\/g, "/"));

function route(file: string): string {
  if (file === "index.html") return "/";
  if (file === "404.html") return "404";
  return "/" + file.replace(/\.html$/, "");
}

describe("every built page is tested", () => {
  it("is listed in e2e/pages.ts", () => {
    const listed = new Set(PAGES.map((p) => (p.status === 404 ? "404" : p.path)));
    expect(built.map(route).filter((r) => !listed.has(r))).toEqual([]);
  });

  it("is audited by Lighthouse (except the 404 page)", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), "lighthouserc.json"), "utf-8"));
    const audited = new Set(config.ci.collect.url.map((u: string) => new URL(u).pathname));
    expect(built.map(route).filter((r) => r !== "404" && !audited.has(r))).toEqual([]);
  });
});
