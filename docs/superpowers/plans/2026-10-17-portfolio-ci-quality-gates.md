# Portfolio CI Quality Gates Implementation Plan (Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every PR is checked for script weight, layout at four screen widths, accessibility, reduced motion, loading behaviour (pop-in, overlaps, half-played animations), visual changes, mobile Lighthouse scores and broken links, so the redesign (Plans 3 and 4) can't silently regress the site.

**Architecture:** A pure script-budget helper backs a build-output test. Playwright runs against `astro preview` in four viewport projects for layout, axe and reduced-motion checks, and freezes in-between states (media held back, animations paused at 0/50/100%) to check them by geometry; visual comparisons (`toHaveScreenshot`) run only inside the official Playwright container so fonts are identical. Lighthouse CI and lychee run as separate CI jobs; lychee also runs nightly.

**Tech Stack:** @playwright/test 1.64.1, @axe-core/playwright 4.14.0, @lhci/cli 0.15.1, lycheeverse/lychee-action v2.9.0, actions/upload-artifact v7.0.2, the `mcr.microsoft.com/playwright:v1.64.1-noble` image.

**Spec:** `docs/superpowers/specs/2026-10-17-portfolio-overhaul-design.md`, Section 6 (CI/CD and quality gates).

## Global Constraints

- Viewports: 360×800, 390×844, 768×1024, 1280×800 (spec Section 6).
- Lighthouse: mobile (Lighthouse's default form factor), performance and accessibility ≥ 0.9 (spec success criterion 4).
- Home page JavaScript ≤ 60 kB gzipped (spec Section 6); every other page has the same default until a world sets its own budget.
- axe: no `serious` or `critical` violation on any page at any viewport.
- No horizontal page scroll at any viewport (spec Section 3).
- Exact versions as listed in Tech Stack.
- **Decision 2026-10-17 (owner):** Argos is replaced by Playwright's built-in visual comparison. Argos's free plan targets personal repos and this repo is organisation-owned; reg-suit was also considered and rejected (it needs a storage bucket and a GitHub app for a few dozen screenshots).
- **Ruling:** the spec's `size-limit` is replaced by a build-output budget test (`tests/dist/budget.test.ts`). It measures what each page actually loads (inline scripts, `<script src>`, module preloads, Astro island URLs) with no new dependency; `size-limit` would need a file glob that matches nothing today.
- No PII or local paths in committed files.

## Review Focus

1. **Pop-in and half-loaded states** (media without reserved space, content overlapping mid-load or mid-animation) look fine in a final screenshot. Pinned by Task 4 (frozen in-between states, checked by geometry) and Task 5 (`-loading` and `-midway` screenshots).
2. **A baseline screenshot taken outside the container** (Windows, macOS) would make CI fail on font rendering. Pinned by Task 5: visual tests skip unless `PW_VISUAL=1`, which only the container jobs set.
3. **A new page with no baseline** must fail CI with its screenshot available, not pass silently. Pinned by Task 5 (`--update-snapshots=missing` writes and fails; the artifact carries it).
4. **A case-study table or code block wider than a phone** must not scroll the whole page. Pinned by Task 2's overflow test at 360 px.
5. **Rate-limited or bot-blocking external hosts** (LinkedIn answers 999, GitHub rate-limits) must not fail the link check. Pinned by Task 7 (LinkedIn excluded, GitHub token passed to lychee).

---

### Task 1: Script budget

**Files:**
- Create: `tests/dist/budget.ts`, `tests/dist/budget.test.ts`

**Interfaces:**
- Consumes: `tests/dist/helpers.ts` (`page`, `distFileExists`).
- Produces: `pageScriptUrls(html: string): string[]`, `pageScriptBytes(html: string, distDir: string): number`, `BUDGETS: Record<string, number>`, `DEFAULT_BUDGET = 60_000`.

- [ ] **Step 1: Write the failing tests**

Create `tests/dist/budget.test.ts`:
```ts
import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import { BUDGETS, DEFAULT_BUDGET, pageScriptBytes, pageScriptUrls } from "./budget";
import { page } from "./helpers";

function fixtureDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "budget-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

describe("pageScriptUrls", () => {
  it("collects script src, module preloads and Astro island URLs, once each", () => {
    const html = `
      <script type="module" src="/_astro/a.js"></script>
      <link rel="modulepreload" href="/_astro/b.js">
      <astro-island component-url="/_astro/c.js" renderer-url="/_astro/a.js"></astro-island>
      <link rel="stylesheet" href="/_astro/site.css">`;
    expect(pageScriptUrls(html).sort()).toEqual(["/_astro/a.js", "/_astro/b.js", "/_astro/c.js"]);
  });
});

describe("pageScriptBytes", () => {
  it("is zero for a page with no scripts", () => {
    expect(pageScriptBytes("<p>hi</p>", fixtureDir({}))).toBe(0);
  });

  it("counts inline scripts and local script files, gzipped", () => {
    const code = "console.log('x');".repeat(50);
    const dir = fixtureDir({ "_astro/a.js": code });
    const html = `<script>${code}</script><script src="/_astro/a.js"></script>`;
    expect(pageScriptBytes(html, dir)).toBe(gzipSync(code).length * 2);
  });

  it("refuses third-party scripts", () => {
    expect(() => pageScriptBytes('<script src="https://cdn.example.com/x.js"></script>', fixtureDir({}))).toThrow(
      /third-party script/,
    );
  });
});

describe("page budgets", () => {
  const dist = join(process.cwd(), "dist");
  const pages = readdirSync(dist, { recursive: true, encoding: "utf-8" }).filter((f) => f.endsWith(".html"));

  it("keeps every page's JavaScript within its budget", () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const file of pages) {
      const path = file.replace(/\\/g, "/");
      const budget = BUDGETS[path] ?? DEFAULT_BUDGET;
      expect(pageScriptBytes(page(path).toString(), dist), path).toBeLessThanOrEqual(budget);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build && npx vitest run tests/dist/budget.test.ts --config vitest.dist.config.ts --reporter=dot`
Expected: FAIL, "Failed to resolve import "./budget"".

- [ ] **Step 3: Write the implementation**

Create `tests/dist/budget.ts`:
```ts
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
    ...doc.querySelectorAll("astro-island").flatMap((i) => [i.getAttribute("component-url"), i.getAttribute("renderer-url")]),
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dist/budget.test.ts --config vitest.dist.config.ts --reporter=dot`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/dist/budget.ts tests/dist/budget.test.ts
git commit -m "Add a per-page JavaScript budget to the build-output tests"
```

---

### Task 2: Playwright at four widths: routes and overflow

**Files:**
- Create: `playwright.config.ts`, `e2e/pages.ts`, `e2e/layout.spec.ts`
- Modify: `package.json` (devDependency, script), `tsconfig.app.json` (include `e2e`), `tsconfig.node.json` (include `playwright.config.ts`), `.gitignore`, `src/index.css` (only if the overflow test finds a real overflow)

**Interfaces:**
- Consumes: the built site via `npm run preview`.
- Produces: `PAGES: { name: string; path: string; status: number }[]` in `e2e/pages.ts`; Playwright projects `phone-360`, `phone-390`, `tablet-768`, `desktop-1280`; script `test:e2e`.

- [ ] **Step 1: Install Playwright**

Run: `npm install -D @playwright/test@1.64.1 && npx playwright install chromium`
Expected: no `ERR!`; Chromium downloaded (or already present).

- [ ] **Step 2: Write the config and the failing tests**

Create `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

const viewports = [
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

export default defineConfig({
  testDir: "e2e",
  // Visual baselines are made only in the Playwright container (Linux), so no
  // platform suffix: a baseline from another OS is never valid here.
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4321" },
  projects: viewports.map(({ name, width, height }) => ({
    name,
    use: { browserName: "chromium", viewport: { width, height } },
  })),
  webServer: {
    command: "npm run preview -- --port 4321",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
```

Create `e2e/pages.ts`:
```ts
export const PAGES = [
  { name: "home", path: "/", status: 200 },
  { name: "case-study", path: "/projects/satisfactory-dash", status: 200 },
  { name: "not-found", path: "/no-such-page", status: 404 },
];
```

Create `e2e/layout.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

for (const { name, path, status } of PAGES) {
  test(`${name} loads with status ${status}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
  });

  test(`${name} has no horizontal page scroll`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```

In `package.json` scripts add `"test:e2e": "playwright test"`. In `tsconfig.app.json` add `"e2e"` to `include`; in `tsconfig.node.json` add `"playwright.config.ts"` to `include`. In `.gitignore` add `playwright-report/`, `test-results/` and `.lighthouseci/`.

- [ ] **Step 3: Run before building to see it fail**

Run: `npx playwright test --reporter=line` with no `dist/` present (`rm -rf dist` first).
Expected: FAIL; the web server can't start because `astro preview` has no build to serve.

- [ ] **Step 4: Build and run**

Run: `npm run build && npx playwright test --reporter=line`
Expected: 24 tests (3 pages × 2 tests × 4 projects) PASS. **If an overflow test fails**, find the widest element at that viewport (`page.evaluate` over `document.querySelectorAll("*")` comparing `getBoundingClientRect().right` with `innerWidth`), fix it in `src/index.css` with the narrowest rule that contains it (for example `overflow-x: auto` on `.case-study-body pre` or `table`), and record a Ruling. Re-run until all pass.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/ package.json package-lock.json tsconfig.app.json tsconfig.node.json .gitignore src/index.css
git commit -m "Test routes and horizontal overflow at four screen widths with Playwright"
```

---

### Task 3: Accessibility and reduced motion

**Files:**
- Create: `e2e/a11y.spec.ts`
- Modify: `package.json` (devDependency), `src/` styles or markup only where axe finds a real violation

**Interfaces:**
- Consumes: `PAGES` (Task 2), Playwright projects.
- Produces: nothing new.

- [ ] **Step 1: Install axe**

Run: `npm install -D @axe-core/playwright@4.14.0`
Expected: no `ERR!`.

- [ ] **Step 2: Write the tests**

Create `e2e/a11y.spec.ts`:
```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

for (const { name, path } of PAGES) {
  test(`${name} has no serious or critical accessibility violations`, async ({ page }) => {
    // Reduced motion so the fade-in is finished before axe measures contrast.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path, { waitUntil: "networkidle" });
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test(`${name} shows every section at once with reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const opacities = await page.$$eval(".section", (sections) =>
      sections.map((s) => getComputedStyle(s).opacity),
    );
    expect(opacities.length).toBeGreaterThan(0);
    expect(new Set(opacities)).toEqual(new Set(["1"]));
  });
}
```

- [ ] **Step 3: Prove the reduced-motion test can fail**

Temporarily delete the `@media (prefers-reduced-motion: reduce)` block in `src/index.css`, then run `npm run build && npx playwright test e2e/a11y.spec.ts --project=phone-390 --reporter=line`.
Expected: the "shows every section at once" tests FAIL (opacities below 1 mid-fade). Restore the block exactly (`git checkout -- src/index.css`).

- [ ] **Step 4: Run all of it**

Run: `npm run build && npx playwright test --reporter=line`
Expected: 48 tests PASS. **If axe reports a violation**, fix the cause (for example a colour token's contrast in `src/index.css`, or a missing label), never by excluding the rule; record each fix as a Ruling. Re-run until green.

- [ ] **Step 5: Commit**

```bash
git add e2e/a11y.spec.ts package.json package-lock.json src/
git commit -m "Check accessibility with axe and reduced motion at every width"
```

---

### Task 4: Loading behaviour: reserved space, overlaps, mid-animation states

A screenshot of the finished page says nothing about the first few hundred
milliseconds. These tests freeze the page in its in-between states (media still
loading, animations half-played) and check them deterministically, without timing
guesses. Known defect they catch today: the case study's `<video>` and both diagram
`<img>` tags have no size, so each pops in and pushes the text below it down.

**Files:**
- Create: `e2e/loading.ts` (helpers), `e2e/loading.spec.ts`, `tests/dist/media.test.ts`
- Modify: `playwright.config.ts` (traces and video on failure), `src/content/projects/satisfactory-dash/index.md` (media sizes), `src/index.css` (only `height: auto` on case-study media if missing)

**Interfaces:**
- Consumes: `PAGES` (Task 2), the `page` helper (`tests/dist/helpers.ts`).
- Produces (in `e2e/loading.ts`, used again by Task 5 and by Plan 3's motion work):
  - `holdMedia(page: Page): Promise<{ release: () => Promise<void>; held: () => number }>`: holds every image and video request until released.
  - `mediaBoxes(page: Page): Promise<{ src: string; width: number; height: number }[]>`
  - `overlaps(page: Page): Promise<string[]>`: pairs of visible, non-nested content elements whose boxes intersect.
  - `scrubAnimations(page: Page, progress: number): Promise<number>`: pauses every running animation (CSS animations, transitions, Web Animations and view transitions) at `progress` (0 to 1) of its duration; returns how many it froze.

- [ ] **Step 1: Write the failing build-output test**

Create `tests/dist/media.test.ts`:
```ts
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { page } from "./helpers";

describe("media reserves its space before it loads", () => {
  const pages = readdirSync(join(process.cwd(), "dist"), { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\\/g, "/"));

  it("gives every img and video a width and height", () => {
    const missing = pages.flatMap((file) =>
      page(file)
        .querySelectorAll("img, video")
        .filter((el) => !el.getAttribute("width") || !el.getAttribute("height"))
        .map((el) => `${file}: <${el.tagName.toLowerCase()} ${el.getAttribute("src") ?? el.getAttribute("poster")}>`),
    );
    expect(missing).toEqual([]);
  });
});
```

Run: `npm run build && npx vitest run tests/dist/media.test.ts --config vitest.dist.config.ts --reporter=dot`
Expected: FAIL listing the case study's video and both diagram images.

- [ ] **Step 2: Write the loading helpers**

Create `e2e/loading.ts`:
```ts
import type { Page, Route } from "@playwright/test";

export async function holdMedia(page: Page) {
  const waiting: Route[] = [];
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    const isFavicon = route.request().url().endsWith("/favicon.svg");
    if ((type === "image" || type === "media") && !isFavicon) waiting.push(route);
    else return route.continue();
  });
  return {
    held: () => waiting.length,
    release: async () => {
      await page.unroute("**/*");
      await Promise.all(waiting.splice(0).map((r) => r.continue()));
    },
  };
}

export function mediaBoxes(page: Page) {
  return page.$$eval("img, video", (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        src: el.getAttribute("src") ?? el.getAttribute("poster") ?? "",
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    }),
  );
}

const CONTENT = "h1, h2, h3, p, li, img, video, figure, pre, table, .button, .project-card";

export function overlaps(page: Page) {
  return page.evaluate((selector) => {
    const els = [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    });
    const label = (el: Element) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
    const found: string[] = [];
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const [a, b] = [els[i], els[j]];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 1 && y > 1) found.push(`${label(a)} overlaps ${label(b)}`);
      }
    }
    return found;
  }, CONTENT);
}

export function scrubAnimations(page: Page, progress: number) {
  return page.evaluate((p) => {
    const animations = document.getAnimations();
    for (const animation of animations) {
      animation.pause();
      const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
      animation.currentTime = end * p;
    }
    return animations.length;
  }, progress);
}
```

- [ ] **Step 3: Write the failing Playwright tests**

Create `e2e/loading.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { holdMedia, mediaBoxes, overlaps, scrubAnimations } from "./loading";
import { PAGES } from "./pages";

const pages = PAGES.filter((p) => p.status === 200);

for (const { name, path } of pages) {
  test(`${name}: media keeps its size and nothing moves while it loads`, async ({ page }) => {
    const media = await holdMedia(page);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const expected = await page.$$eval("img[src], video[poster]", (els) => els.length);
    await expect.poll(media.held).toBe(expected);
    const before = { boxes: await mediaBoxes(page), height: await page.evaluate(() => document.body.scrollHeight) };

    await media.release();
    await page.waitForLoadState("networkidle");
    const after = { boxes: await mediaBoxes(page), height: await page.evaluate(() => document.body.scrollHeight) };

    expect(after).toEqual(before);
  });

  test(`${name}: no content overlaps while media is still loading`, async ({ page }) => {
    await holdMedia(page);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(await overlaps(page)).toEqual([]);
  });

  for (const progress of [0, 0.5, 1]) {
    test(`${name}: no content overlaps at ${progress * 100}% of every animation`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      await scrubAnimations(page, progress);
      expect(await overlaps(page)).toEqual([]);
    });
  }

  test(`${name}: navigating here from another page shows no overlaps mid-load`, async ({ page }) => {
    await page.goto(path === "/" ? "/projects/satisfactory-dash" : "/", { waitUntil: "networkidle" });
    await holdMedia(page);
    await page.goto(path, { waitUntil: "commit" });
    await page.waitForLoadState("domcontentloaded");
    expect(await overlaps(page)).toEqual([]);
  });
}
```

In `playwright.config.ts`, inside `use`, add `trace: "retain-on-failure", video: "retain-on-failure"`. A failing test then keeps a trace whose timeline shows the page frame by frame (`npx playwright show-trace <file>`), which is how a "weird 400 ms" is diagnosed.

Run: `npm run build && npx playwright test e2e/loading.spec.ts --reporter=line`
Expected: the case-study "media keeps its size" test FAILS at every width (the boxes grow from 0 high and the page gets taller). If any overlap test fails, read the pair it names; record a Ruling for each real overlap you fix in Step 4, and narrow `CONTENT` only if the pair is a deliberate design (never to hide a bug).

- [ ] **Step 4: Fix the media sizes**

In `src/content/projects/satisfactory-dash/index.md`:
- the deployment diagram `<img>`: add `width="5070" height="2454"`;
- the backend-modules diagram `<img>`: add `width="2663" height="2417"`;
- the `<video>`: add the video's own `width` and `height` (read them with `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 public/demo/satisfactory-dash-walkthrough.mp4`, or from `videoWidth`/`videoHeight` in the browser console); the poster is 1200×630, so if the video differs, the poster is letterboxed, which is fine.

The CSS already sets `max-width: 100%` on case-study media; add `height: auto` to the `.case-study-body img, .case-study-body video` rule in `src/index.css` if it isn't there, so the attributes set the aspect ratio rather than a fixed height.

- [ ] **Step 5: Run everything and commit**

Run: `npm run build && npx vitest run tests/dist/media.test.ts --config vitest.dist.config.ts --reporter=dot && npx playwright test --reporter=line`
Expected: the media test PASSES; all Playwright tests PASS (visual ones skipped). Compare the case study at 390 px in `npm run preview` with the live site: the page should look the same once loaded, with no jump while loading.

```bash
git add e2e/loading.ts e2e/loading.spec.ts tests/dist/media.test.ts playwright.config.ts src/content/projects/satisfactory-dash/index.md src/index.css
git commit -m "Test loading states: reserved media space, overlaps, half-played animations"
```

---

### Task 5: Visual comparisons in the Playwright container

**Files:**
- Create: `e2e/visual.spec.ts`, `e2e/__screenshots__/**` (from CI), `.github/workflows/update-screenshots.yml`
- Modify: `.github/workflows/ci.yml` (new `e2e` job)

**Interfaces:**
- Consumes: `PAGES`, Playwright projects, `snapshotPathTemplate`; `holdMedia` and `scrubAnimations` (Task 4).
- Produces: CI job `e2e`; artifact `screenshots` (the `e2e/__screenshots__` tree written by the run); artifacts `playwright-report` and `test-results` (traces and videos of failures); workflow `update-screenshots`.

- [ ] **Step 1: Write the visual test**

Create `e2e/visual.spec.ts`. Besides the finished page, it photographs two in-between states, so a pop-in or a half-faded overlap shows up as a picture in review, not just a failing assertion:
```ts
import { expect, test } from "@playwright/test";
import { holdMedia, scrubAnimations } from "./loading";
import { PAGES } from "./pages";

// Fonts render differently per OS, so baselines exist only for the Playwright
// container that CI uses. Elsewhere these tests skip.
test.skip(!process.env.PW_VISUAL, "visual comparisons run in the Playwright container (PW_VISUAL=1)");

const options = { fullPage: true, maxDiffPixelRatio: 0.002 } as const;

for (const { name, path } of PAGES) {
  test(`${name} looks the same when loaded`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot(`${name}.png`, { ...options, animations: "disabled" });
  });

  test(`${name} looks the same while its media loads`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await holdMedia(page);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveScreenshot(`${name}-loading.png`, { ...options, animations: "disabled" });
  });

  test(`${name} looks the same halfway through its animations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await scrubAnimations(page, 0.5);
    await expect(page).toHaveScreenshot(`${name}-midway.png`, { ...options, animations: "allow" });
  });
}
```

- [ ] **Step 2: Add the CI job**

In `.github/workflows/ci.yml`, add a job after `verify`:
```yaml
  e2e:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.64.1-noble
    env:
      PW_VISUAL: "1"
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: .node-version
          cache: npm

      - run: npm ci

      - run: npm run build

      # Missing baselines are written (and the test fails) so a new page's
      # screenshot is in the artifact below; changed ones fail with a diff.
      - run: npx playwright test --update-snapshots=missing

      - if: always()
        uses: actions/upload-artifact@v7.0.2
        with:
          name: screenshots
          path: e2e/__screenshots__/
          if-no-files-found: ignore

      - if: always()
        uses: actions/upload-artifact@v7.0.2
        with:
          name: playwright-report
          path: playwright-report/
          if-no-files-found: ignore

      # Traces and videos of failed tests: open with `npx playwright show-trace`.
      - if: failure()
        uses: actions/upload-artifact@v7.0.2
        with:
          name: test-results
          path: test-results/
          if-no-files-found: ignore
```

Create `.github/workflows/update-screenshots.yml`:
```yaml
name: Update screenshots

# Run from the Actions tab on a branch when a visual change is intended. It
# re-takes every screenshot in the same container CI uses and uploads them;
# download the artifact, commit it to the branch and push (a push by a person
# re-runs CI, a push by this workflow's token would not).
on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  update:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.64.1-noble
    env:
      PW_VISUAL: "1"
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: .node-version
          cache: npm

      - run: npm ci

      - run: npm run build

      - run: npx playwright test e2e/visual.spec.ts --update-snapshots=all

      - uses: actions/upload-artifact@v7.0.2
        with:
          name: screenshots
          path: e2e/__screenshots__/
```

- [ ] **Step 3: Run locally to confirm the skip**

Run: `npx playwright test e2e/visual.spec.ts --reporter=line`
Expected: 36 tests skipped (3 pages × 3 states × 4 widths, no `PW_VISUAL`), none failed.

- [ ] **Step 4: Commit, push, and watch the first CI run fail on missing baselines**

```bash
git add e2e/visual.spec.ts .github/workflows/ci.yml .github/workflows/update-screenshots.yml
git commit -m "Compare screenshots at four widths in the Playwright container"
git push -u origin HEAD
gh pr create --draft --title "Add CI quality gates" --body "Plan 2 in progress."
```
Then `gh pr checks --watch`. Expected: `e2e` FAILS with "A snapshot doesn't exist … writing actual" for 36 screenshots.

- [ ] **Step 5: Commit the baselines from the artifact**

```bash
gh run download <run id of that e2e job> --name screenshots --dir e2e/__screenshots__
git add e2e/__screenshots__
git commit -m "Add baseline screenshots from the Playwright container"
git push
```
Open four of the PNGs (home at 360 and 1280, case study at 390, case-study `-loading` at 390) and check they show the real pages, not an error or blank page; the `-loading` one should show the case study with empty, correctly sized media boxes. Expected on the new run: `e2e` PASSES.

---

### Task 6: Lighthouse CI on mobile

**Files:**
- Create: `lighthouserc.json`
- Modify: `package.json` (devDependency, script), `.github/workflows/ci.yml` (new `lighthouse` job)

**Interfaces:**
- Consumes: `npm run preview`.
- Produces: CI job `lighthouse`; artifact `lighthouse`; script `lhci`.

- [ ] **Step 1: Install and configure**

Run: `npm install -D @lhci/cli@0.15.1`

Create `lighthouserc.json`:
```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run preview -- --port 4321",
      "startServerReadyPattern": "4321",
      "url": ["http://localhost:4321/", "http://localhost:4321/projects/satisfactory-dash"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
  }
}
```
Add the script `"lhci": "lhci autorun"`.

- [ ] **Step 2: Prove the assertion can fail**

Run once with an impossible bar: temporarily set both `minScore` to `1.01`, then `npm run build && npm run lhci`.
Expected: FAIL with "expected >= 1.01". Restore `0.9`.

- [ ] **Step 3: Run it for real**

Run: `npm run lhci`
Expected: both URLs pass (scores ≥ 0.9 on the mobile profile). If performance is below 0.9 on this machine only, re-run in CI before acting: local CPU load skews it. A real CI failure is fixed in the site, not by lowering the bar.

- [ ] **Step 4: Add the CI job**

In `.github/workflows/ci.yml` add:
```yaml
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: .node-version
          cache: npm

      - run: npm ci

      - run: npm run build

      - run: npm run lhci

      - if: always()
        uses: actions/upload-artifact@v7.0.2
        with:
          name: lighthouse
          path: .lighthouseci/
          if-no-files-found: ignore
```

- [ ] **Step 5: Commit and push**

```bash
git add lighthouserc.json package.json package-lock.json .github/workflows/ci.yml
git commit -m "Hold mobile Lighthouse performance and accessibility at 90 or above"
git push
```
Expected: `lighthouse` PASSES in CI.

---

### Task 7: Link check, docs, and ready for review

**Files:**
- Create: `.github/workflows/links.yml`
- Modify: `.github/workflows/ci.yml` (new `links` job), `docs/superpowers/specs/2026-10-17-portfolio-overhaul-design.md` (Section 6), `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: the built `dist/`.
- Produces: CI job `links`; nightly workflow `links`.

- [ ] **Step 1: Add the PR link check**

In `.github/workflows/ci.yml` add:
```yaml
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: .node-version
          cache: npm

      - run: npm ci

      - run: npm run build

      # LinkedIn answers bots with 999; the token avoids GitHub rate limits.
      - uses: lycheeverse/lychee-action@v2.9.0
        with:
          args: >-
            --no-progress
            --root-dir ${{ github.workspace }}/dist
            --fallback-extensions html
            --exclude linkedin\.com
            dist/**/*.html
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Prove it can fail**

Push a temporary commit that adds `[broken](/no-such-target)` to the end of `src/content/projects/satisfactory-dash/index.md`. Expected: `links` FAILS naming `/no-such-target`. Revert it with a second commit (`git revert --no-edit HEAD`) and push; expected: `links` PASSES.

- [ ] **Step 3: Add the nightly run**

Create `.github/workflows/links.yml`:
```yaml
name: Links

# External links rot without any commit; check main's built site every night.
on:
  schedule:
    - cron: "17 6 * * *"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: .node-version
          cache: npm

      - run: npm ci

      - run: npm run build

      - uses: lycheeverse/lychee-action@v2.9.0
        with:
          args: >-
            --no-progress
            --root-dir ${{ github.workspace }}/dist
            --fallback-extensions html
            --exclude linkedin\.com
            dist/**/*.html
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 4: Update the docs**

- Spec Section 6 table: the `size` row becomes "budget | `tests/dist/budget.test.ts`: gzipped JS each page loads | over budget (60 kB default)"; the `visual` row becomes "visual | Playwright `toHaveScreenshot` in the `mcr.microsoft.com/playwright` container | any unapproved difference; baselines refreshed with the Update screenshots workflow". Add a dated note under the table recording the owner's decision (Argos and reg-suit rejected, reasons as in Global Constraints) and the size-limit ruling.
- `CLAUDE.md` Commands: add `npm run test:e2e` (needs a build; visual tests run only in CI) and `npm run lhci`. Stack: mention the `e2e`, `lighthouse` and `links` CI jobs.
- `README.md`: a "Visual changes" section: when a PR changes the look on purpose, run **Actions → Update screenshots** on the PR's branch, download its `screenshots` artifact into `e2e/__screenshots__/`, commit and push.

- [ ] **Step 5: Final local run, then ready the PR**

Run: `npm run typecheck && npm run lint && npx vitest run --reporter=dot && npm run build && npm run test:dist && npx playwright test --reporter=line`
Expected: all pass (visual tests skipped locally).

```bash
git add .github/workflows/links.yml .github/workflows/ci.yml docs/superpowers/specs/2026-10-17-portfolio-overhaul-design.md CLAUDE.md README.md
git commit -m "Check links on every PR and nightly; document the quality gates"
git push
gh pr ready
```
Expected: `verify`, `security`, `e2e`, `lighthouse`, `links`, CodeQL and Workers Builds all pass. The PR body lists the new required-check candidates (`e2e`, `lighthouse`, `links`) for the owner to add to the branch rules if they should block merges.
