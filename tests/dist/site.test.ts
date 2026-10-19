import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { SITE, page, metaContent, hrefs, distFileExists } from "./helpers";
import { RUNNABLE_SCRIPTS, pageScriptBytes } from "./budget";

const GH = "https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/";

describe("leonardonunez.dev case study", () => {
  const doc = page("projects/leonardonunez-dev.html");
  const body = () => doc.querySelector(".case-study-body")!;

  it("renders its sections, limits and trade-offs in the main read", () => {
    expect(doc.querySelector("h1")?.text).toBe("leonardonunez.dev");
    expect(body().querySelectorAll("h2").map((h) => h.text.trim())).toEqual([
      "The problem",
      "What every change must pass",
      "Where it breaks",
      "What it caught, and what it missed",
      "Fast by default",
      "Limits and trade-offs",
      "How it was built",
    ]);
    const limits = body().querySelectorAll("h2").find((h) => h.text.trim() === "Limits and trade-offs")!;
    expect(limits.closest("details")).toBeNull();
  });

  it("addresses interested viewers, never hiring managers", () => {
    expect(doc.text).not.toMatch(/hiring manager/i);
  });

  it("places its figure in the site world", () => {
    expect(doc.querySelector('.world-site figure[data-figure="site"]')).not.toBeNull();
  });

  it("links each claim's source", () => {
    const links = hrefs(doc);
    for (const path of [
      "pull/35",
      "pull/38",
      "pull/40",
      "pull/43",
      "pull/46",
      "blob/main/.github/workflows/ci.yml",
      "blob/main/e2e/layout.spec.ts",
      "blob/main/e2e/loading.spec.ts",
      "blob/main/e2e/a11y.spec.ts",
      "blob/main/e2e/visual.spec.ts",
      "blob/main/lighthouserc.json",
      "blob/main/tests/dist/budget.ts",
      "blob/main/public/_headers",
      "blob/main/src/layouts/Shell.astro",
    ]) {
      expect(links.some((h) => h.startsWith(GH + path)), path).toBe(true);
    }
  });

  // Final review: each claim says only what its source says.
  it("states its claims as their sources do", () => {
    const text = body().text;
    // #35 shipped the picture bug, then fixed it with the loading tests.
    expect(text).not.toMatch(/never shipped/);
    const misses = body().querySelectorAll("p").filter((p) => /reserved/.test(p.text));
    expect(misses.some((p) => p.querySelectorAll("a").some((a) => a.getAttribute("href") === GH + "pull/35"))).toBe(true);
    // Only #40 is called a catch (owner, 2026-10-18).
    expect(text).not.toMatch(/caught this page/);
    // Only verify, e2e and Lighthouse are required on main.
    expect(text).not.toMatch(/nothing merges until it is green/);
    expect(text).toMatch(/required/);
    // #43's commit doesn't say which widths failed.
    expect(body().querySelectorAll("li").find((li) => /smooth scrolling/.test(li.text))!.text).not.toMatch(/tablets/);
  });

  // The link checker fails on a path that only exists once this merges.
  it("links only pages that exist before it merges", () => {
    expect(hrefs(doc).some((h) => h.includes("/tree/main/src/design/checks"))).toBe(false);
  });

  it("names the miss in its limits, with its PR", () => {
    const limits = body().querySelectorAll("li").filter((li) => /thought of/.test(li.text));
    expect(limits.some((li) => li.querySelectorAll("a").some((a) => a.getAttribute("href") === GH + "pull/38"))).toBe(true);
  });

  it("states each listed page's real JavaScript size, within 10 %", () => {
    const rows = body().querySelectorAll("table tbody tr");
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const tr of rows) {
      const [path, size] = tr.querySelectorAll("td").map((td) => td.text.trim());
      const file = path === "/" ? "index.html" : `${path.slice(1)}.html`;
      const bytes = pageScriptBytes(page(file).toString(), join(process.cwd(), "dist"));
      const stated = parseFloat(size) * 1000;
      if (bytes === 0) expect(stated, path).toBe(0);
      else expect(Math.abs(stated - bytes) / bytes, path).toBeLessThanOrEqual(0.1);
    }
  });

  it("runs only module scripts, and previews with its own still", () => {
    for (const s of doc.querySelectorAll(RUNNABLE_SCRIPTS)) expect(s.getAttribute("type")).toBe("module");
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(`${SITE}/og/leonardonunez-dev.png`);
    expect(distFileExists("covers/leonardonunez-dev.png")).toBe(true);
  });
});
