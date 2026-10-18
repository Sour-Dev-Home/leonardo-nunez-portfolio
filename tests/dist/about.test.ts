import { describe, it, expect } from "vitest";
import { SITE, metaContent, page } from "./helpers";
import { RUNNABLE_SCRIPTS } from "./budget";

describe("about page", () => {
  const doc = page("about.html");

  it("has its own title, canonical URL and description", () => {
    expect(doc.querySelector("title")?.text).toBe("About | Leonardo Nunez");
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${SITE}/about`);
    expect(metaContent(doc, 'meta[name="description"]')?.length).toBeLessThanOrEqual(125);
  });

  it("holds the background and the skills", () => {
    expect(doc.querySelector("h1")?.text).toBe("About");
    expect(doc.text).toContain("Rice University");
    expect(doc.querySelectorAll(".skill-group h3").map((h) => h.text)).toEqual([
      "Languages",
      "Web / full-stack",
      "Infrastructure",
      "Hardware / embedded",
    ]);
  });

  it("ships no JavaScript", () => {
    expect(doc.querySelectorAll(RUNNABLE_SCRIPTS)).toHaveLength(0);
  });
});
