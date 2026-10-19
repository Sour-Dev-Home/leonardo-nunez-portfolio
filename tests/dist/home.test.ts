import { statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, it, expect } from "vitest";
import { SITE, page, metaContent, hrefs, distFileExists } from "./helpers";
import { RUNNABLE_SCRIPTS } from "./budget";

describe("home page", () => {
  const doc = page("index.html");

  it("has the site title and absolute link-preview tags", () => {
    expect(doc.querySelector("title")?.text).toBe("Leonardo Nunez — Full-Stack Developer");
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${SITE}/`);
    expect(metaContent(doc, 'meta[property="og:url"]')).toBe(`${SITE}/`);
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(`${SITE}/og/default.png`);
    expect(metaContent(doc, 'meta[name="description"]')).toMatch(/portfolio/);
  });

  it("lists every project in order", () => {
    const names = doc.querySelectorAll(".project-card h3").map((h) => h.text.trim());
    expect(names).toEqual(["satisfactory-dash", "lanes", "leonardonunez.dev", "local-worker", "Home Lab"]);
  });

  it("keeps every external link the old site had", () => {
    const links = hrefs(doc);
    for (const href of [
      "https://github.com/Sour-Dev-Home/satisfactory-dash",
      "https://demo.satis-manager.com",
      "https://github.com/Sour-Dev-Home/lanes",
      "https://github.com/Sour-Dev-Home/local-worker",
      "mailto:soure393@gmail.com",
      "https://github.com/SourE-dev",
      "https://www.linkedin.com/in/leonardo-nunez-708634248",
      "https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio",
    ]) {
      expect(links).toContain(href);
    }
  });

  it("links only to case studies that exist", () => {
    const caseLinks = hrefs(doc).filter((h) => h.startsWith("/projects/"));
    expect(caseLinks).toEqual(["/projects/satisfactory-dash", "/projects/lanes", "/projects/leonardonunez-dev"]);
  });

  it("keeps the section anchors the header links to", () => {
    for (const id of ["top", "work", "contact"]) {
      expect(doc.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("shows a small, described portrait in the hero, with no metadata in the file", async () => {
    const img = doc.querySelector(".hero img.hero-portrait");
    expect(img?.getAttribute("alt")).toMatch(/Leonardo Nunez/);
    expect(img?.getAttribute("width")).toBe("720");
    expect(img?.getAttribute("height")).toBe("900");
    const src = img!.getAttribute("src")!;
    expect(src).toMatch(/\.webp$/);
    const file = join(process.cwd(), "dist", src);
    expect(statSync(file).size).toBeLessThan(150_000);
    // Phone photos carry GPS and camera details in EXIF/XMP; none of it may ship.
    const meta = await sharp(file).metadata();
    expect([meta.exif, meta.xmp, meta.iptc]).toEqual([undefined, undefined, undefined]);
  });

  it("ships no JavaScript", () => {
    expect(doc.querySelectorAll(RUNNABLE_SCRIPTS)).toHaveLength(0);
  });
});

describe("404 page", () => {
  const doc = page("404.html");

  it("says the page wasn't found and links home", () => {
    expect(doc.querySelector("h1")?.text).toBe("Page not found");
    expect(hrefs(doc)).toContain("/");
  });

  it("is built where Cloudflare Pages looks for it", () => {
    expect(distFileExists("404.html")).toBe(true);
  });
});
