// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PAGES, SPECS } from "../e2e/pages.ts";
import { grepFor, lighthouseConfig, manifest, pageFile, select } from "./e2e-select.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// A built site: every page links the shared stylesheet, which uses a font; the kit
// also loads its own script.
function site(overrides: Record<string, string> = {}) {
  const files: Record<string, string> = {
    "_astro/site.AAA.css": "body{font-family:x} @font-face{src:url(/fonts/body.woff2)}",
    "fonts/body.woff2": "font-v1",
    "_astro/kit.BBB.js": "export const kit = 1;",
    "robots.txt": "User-agent: *",
    ...overrides,
  };
  for (const page of PAGES) {
    const script = page.name === "kit" ? '<script src="/_astro/kit.BBB.js"></script>' : "";
    files[pageFile(page)] ??= `<link href="/_astro/site.AAA.css">${script}<h1>${page.name}</h1>`;
  }
  const dir = mkdtempSync(join(tmpdir(), "e2e-select-"));
  dirs.push(dir);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  return manifest(dir);
}

const ALL = PAGES.map((p) => p.name);
const changed = ["src/pages/about.astro"];

describe("select", () => {
  it("runs only the page whose HTML changed", () => {
    const head = site({ "about.html": '<link href="/_astro/site.AAA.css"><h1>About me</h1>' });
    expect(select(changed, site(), head)).toMatchObject({ mode: "some", pages: ["about"] });
  });

  it("runs only the page whose script changed", () => {
    expect(select(changed, site(), site({ "_astro/kit.BBB.js": "export const kit = 2;" }))).toMatchObject({ mode: "some", pages: ["kit"] });
  });

  it("runs every page that loads a changed stylesheet", () => {
    expect(select(changed, site(), site({ "_astro/site.AAA.css": "body{color:red}" }))).toMatchObject({ mode: "some", pages: ALL });
  });

  it("follows a stylesheet to the font it loads", () => {
    expect(select(changed, site(), site({ "fonts/body.woff2": "font-v2" }))).toMatchObject({ mode: "some", pages: ALL });
  });

  it("runs nothing when no built output changed", () => {
    expect(select(["README.md", "docs/STYLE.md"], site(), site())).toMatchObject({ mode: "none", pages: [] });
  });

  it("runs everything when a built file no page pulls in changed", () => {
    expect(select(changed, site(), site({ "robots.txt": "Disallow: /" }))).toMatchObject({ mode: "all", pages: ALL });
  });

  it("runs everything when the test setup changed, even if no page did", () => {
    for (const file of ["e2e/visual.spec.ts", "playwright.config.ts", "package-lock.json", ".github/workflows/ci.yml", "scripts/e2e-select.ts"]) {
      expect(select([file], site(), site()).mode).toBe("all");
    }
  });

  it("runs everything outside a pull request or without a base build", () => {
    expect(select(undefined, undefined, undefined).mode).toBe("all");
    expect(select(changed, undefined, site()).mode).toBe("all");
  });
});

describe("grepFor", () => {
  // Playwright matches --grep against "<project> <file> <describe> <title> <tags>".
  const matches = (pages: string[], line: string) => new RegExp(grepFor(pages)).test(line);

  it("picks the per-page tests by tag", () => {
    expect(matches(["about"], "phone-360 visual.spec.ts about looks the same when loaded @page:about")).toBe(true);
    expect(matches(["about"], "phone-360 visual.spec.ts kit looks the same when loaded @page:kit")).toBe(false);
  });

  it("picks the specs that visit a changed page by file name", () => {
    expect(matches(["site"], "phone-360 site-figure.spec.ts where it breaks the frames")).toBe(true);
    expect(matches(["kit"], "phone-360 site-figure.spec.ts where it breaks the frames")).toBe(false);
    expect(matches(["kit"], "phone-360 figures.spec.ts the lane chart draws")).toBe(true);
  });

  it("always picks the specs that visit no page", () => {
    expect(matches(["about"], "phone-360 checks.spec.ts the collision check fails")).toBe(true);
  });
});

describe("SPECS", () => {
  const specs = readdirSync("e2e").filter((f) => f.endsWith(".spec.ts"));

  it("lists every spec, and only real ones", () => {
    expect(Object.keys(SPECS).sort()).toEqual(specs.sort());
  });

  it("names only real pages", () => {
    for (const visits of Object.values(SPECS)) if (visits !== "tagged") for (const name of visits) expect(ALL).toContain(name);
  });

  it("tags every test in a tagged spec", () => {
    for (const [file, visits] of Object.entries(SPECS)) {
      if (visits !== "tagged") continue;
      const text = readFileSync(join("e2e", file), "utf8");
      const tests = text.match(/^\s*test\(/gm)?.length ?? 0;
      expect(tests, file).toBeGreaterThan(0);
      expect(text.match(/\{ tag: pageTag\(name\) \}/g)?.length ?? 0, file).toBe(tests);
    }
  });
});

describe("lighthouseConfig", () => {
  it("keeps only the changed pages' URLs", () => {
    const rc = JSON.parse(readFileSync("lighthouserc.json", "utf8"));
    const url = lighthouseConfig(rc, ["home", "kit", "not-found"]).ci.collect.url;
    expect(url.map((u: string) => new URL(u).pathname)).toEqual(["/", "/kit"]);
  });
});
