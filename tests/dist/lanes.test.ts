import { describe, it, expect } from "vitest";
import { SITE, page, metaContent, hrefs, distFileExists } from "./helpers";
import { RUNNABLE_SCRIPTS } from "./budget";

const GH = "https://github.com/Sour-Dev-Home/lanes/blob/main/";

describe("lanes case study", () => {
  const doc = page("projects/lanes.html");

  it("renders its sections, limits and trade-offs in the main read", () => {
    expect(doc.querySelector("h1")?.text).toBe("lanes");
    expect(doc.querySelectorAll(".case-study-body h2").map((h) => h.text.trim())).toEqual([
      "The problem",
      "How a lane ships",
      "What it refuses",
      "Results",
      "Limits and trade-offs",
      "How it was built",
    ]);
    const limits = doc.querySelectorAll(".case-study-body h2").find((h) => h.text.trim() === "Limits and trade-offs")!;
    expect(limits.closest("details")).toBeNull();
    expect(doc.querySelector(".case-study-body")!.text).toMatch(/Conway’s law|Conway's law/);
  });

  it("places its figure in a lanes world", () => {
    expect(doc.querySelector('.world-lanes figure[data-figure="lanes"]')).not.toBeNull();
  });

  it("links each claim's source", () => {
    const links = hrefs(doc);
    for (const path of [
      "scripts/lanes/lib.mjs",
      "scripts/lanes/gate.mjs",
      "docs/SECURITY.md",
      "docs/history/2026-09-29-lanes-v0.1.0-snapshot.md",
      "docs/history/2026-09-30-lane-size-and-cost.md",
      "docs/history/2026-10-02-lanes-depends-on-the-owners-machine.md",
      "docs/history/2026-10-01-retire-solo-profile.md",
    ]) {
      expect(links.some((h) => h.startsWith(GH + path)), path).toBe(true);
    }
    expect(links).toContain("/projects/satisfactory-dash");
  });

  // The trust-model wording ("mistakes and strangers, not a hostile lane") is USING.md's, not SECURITY.md's.
  it("links the hostile-lane limit to the page that states it", () => {
    const p = doc.querySelectorAll(".case-study-body p").find((el) => el.text.includes("turns hostile"))!;
    expect(p.querySelectorAll("a").map((a) => a.getAttribute("href"))).toContain(GH + "docs/USING.md");
  });

  it("keeps deeper material in closed 'More detail' sections", () => {
    const details = doc.querySelectorAll(".case-study-body details");
    expect(details.filter((d) => /More detail/.test(d.querySelector("summary")?.text ?? "")).length).toBeGreaterThanOrEqual(1);
    for (const d of details) expect(d.hasAttribute("open")).toBe(false);
  });

  it("runs only module scripts, and previews with its own still", () => {
    for (const s of doc.querySelectorAll(RUNNABLE_SCRIPTS)) expect(s.getAttribute("type")).toBe("module");
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(`${SITE}/og/lanes.png`);
    expect(distFileExists("covers/lanes.png")).toBe(true);
  });
});
