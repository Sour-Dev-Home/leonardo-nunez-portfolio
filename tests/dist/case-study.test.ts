import { describe, it, expect } from "vitest";
import { SITE, page, metaContent, hrefs, distFileExists } from "./helpers";

describe("satisfactory-dash case study", () => {
  const doc = page("projects/satisfactory-dash.html");

  it("has its own title, canonical URL and article preview", () => {
    expect(doc.querySelector("title")?.text).toBe("satisfactory-dash — Case Study | Leonardo Nunez");
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `${SITE}/projects/satisfactory-dash`,
    );
    expect(metaContent(doc, 'meta[property="og:type"]')).toBe("article");
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(
      `${SITE}/demo/satisfactory-dash-walkthrough-poster.png`,
    );
    expect(metaContent(doc, 'meta[name="description"]')).toMatch(/^A dashboard and backend/);
  });

  it("renders the heading, stack and every section", () => {
    expect(doc.querySelector("h1")?.text).toBe("satisfactory-dash");
    expect(doc.querySelectorAll(".stack-list li").map((li) => li.text)).toContain("PostgreSQL");
    expect(doc.querySelectorAll(".case-study-body h2").map((h) => h.text.trim())).toEqual([
      "The problem",
      "See it running",
      "Architecture",
      "Key decisions",
      "How it’s built",
      "What’s next",
      "Links",
    ]);
  });

  it("links back home and to every source the old page linked", () => {
    const links = hrefs(doc);
    expect(links).toContain("/");
    for (const href of [
      "https://demo.satis-manager.com",
      "https://satis-manager.com",
      "https://github.com/Sour-Dev-Home/satisfactory-dash",
      "https://github.com/Sour-Dev-Home/satisfactory-dash/blob/main/docs-vault/workspace.dsl",
      "https://github.com/Sour-Dev-Home/satisfactory-dash/tree/main/docs-vault/wiki/decisions",
    ]) {
      expect(links).toContain(href);
    }
  });

  it("references media that is actually in the build", () => {
    const media = [
      ...doc.querySelectorAll("video source").map((s) => s.getAttribute("src") ?? ""),
      ...doc.querySelectorAll(".case-study-body img").map((i) => i.getAttribute("src") ?? ""),
    ];
    expect(media).toContain("/demo/satisfactory-dash-walkthrough.mp4");
    expect(media).toContain("/diagrams/satisfactory-dash-deployment.svg");
    for (const src of media) {
      expect(distFileExists(src.slice(1)), src).toBe(true);
    }
  });

  it("ships no JavaScript", () => {
    expect(doc.querySelectorAll("script")).toHaveLength(0);
  });
});

describe("data-only projects", () => {
  it("get no page", () => {
    expect(distFileExists("projects/lanes.html")).toBe(false);
    expect(distFileExists("projects/home-lab.html")).toBe(false);
  });
});
