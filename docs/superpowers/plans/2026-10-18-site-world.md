# The leonardonunez.dev world (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build this site's own case study.
- An interactive "Where it breaks" figure: one small page at 360, 390, 768 and 1280 px, with four real kinds of bug
  the reader can inject, each checked by the same code CI runs.
- A sourced article whose main point is "every change is proven at four widths before it ships", with a "Fast by
  default" section and a limits section that names a bug the gate missed.
- Card and link-preview stills.

**Architecture:**
- **Shared checks** in `src/design/checks/checks.ts`: self-contained functions (`labelCollisions`, `titleGap`,
  `overflowX`, `mediaBoxes`). The e2e helpers send their source into the page (`e2e/in-page.ts`); the figure imports
  them. One code path for CI and the reader.
- **A pure case model** (`src/worlds/site/model/cases.ts`): each bug's label, verdict (caught / missed / guarded),
  its guarding e2e test's exact title, and the widths it fails at.
- **Static frames** (`SiteFrame.astro`): a miniature page per width, laid out at its true width through container
  queries and scaled with CSS `zoom`. **A small view** (`site-view.ts`) sets the bug and fix state, runs the checks
  on each frame and reports. No loop: nothing moves until the reader presses something.
- **Integration:** the existing MDX case-study route, `WORLDS` map, `render:covers`, JS budget and page lists.

**Tech Stack:** Astro 7.4 (static, MDX), TypeScript, Vitest (jsdom), Playwright (Chromium), sharp.

**Spec:** `docs/superpowers/specs/2026-10-18-site-world-design.md`

## Global Constraints

- **Gate:** CI, preview deploys and owner review. Lanes is not adopted in this repo (owner, 2026-10-18).
- **Git:** work on branch `design/site-world`; never push to `main`; never commit personal information beyond the
  public branding, absolute local paths, or the workers.dev hostname.
- **Screenshot baselines** come only from the "Update screenshots" workflow.
- **JavaScript budget:** `projects/leonardonunez-dev.html` gets 15,000 gzipped bytes; satis and lanes pages stay at
  15,000; `kit.html` stays at 15,000 unless Task 6 rules otherwise; every other page stays at 0.
- **Copy:** the page addresses "interested viewers"; it never says "hiring manager" (owner, 2026-10-18).
- **Claims:** every claim links its source in `https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/` (a PR, a
  test file or a workflow) and is checked against that source before committing. Only #40 is called a catch; #38 is
  "missed, then tested"; the other two cases are "guarded". A claim that doesn't hold is cut.
- **Shared checks are self-contained:** a function in `src/design/checks/checks.ts` references nothing outside its
  own body (no imports, no module constants, no helpers), because e2e sends it as source text.
- **Mini pages use no content tags:** no `h1`–`h3`, `p`, `li`, `img`, `video`, `figure`, `pre` or `table` inside a
  frame, so the page-wide e2e checks (`overlaps`, the h1 edge test, the media test) never see the miniatures.
- **Accessibility:** each frame is `role="img"` with an `aria-label` stating its result, its contents
  `aria-hidden`; controls are labelled buttons; `aria-disabled`, never `disabled`; the caption is `aria-live="polite"`
  and changes once per reader action, never on resize. Mini-page text keeps 4.5:1 contrast.
- **Reduced motion:** nothing animates on its own; under reduced motion the result transitions are off.
- **Phones (below 40rem):** one frame at a time, chosen by a width picker that also shows each width's result.
- **CI fonts:** the fonts case uses `textLength` (140 normal, 170 for "CI's fonts") so its geometry doesn't depend on
  which fonts the machine has. Leave at least 20 units between the route and the label in every passing state.

## Review Focus

1. **Picking another bug while one is fixed:** the fix is dropped, the new bug's checks run, and Fix it is enabled
   again. Test: Task 4, "switching bugs drops the fix and re-checks".
2. **Pressing Fix it twice, or with nothing to fix:** the second press does nothing and focus stays on the button.
   Test: Task 4, "keyboard only: Tab reaches every bug and Fix it, and focus stays on Fix it".
3. **Resizing or rotating with a bug on:** the frames refit and keep their results; the caption doesn't re-announce.
   Test: Task 5, "resizing keeps the bug, its results and the caption".
4. **Turning a bug off and on again:** the same widths fail each time (the media check toggles the page's loaded
   state and must leave it loaded). Test: Task 4, "turning a bug off and on gives the same results".
5. **The page's own checks on a page full of miniatures:** the global layout, loading and axe suites pass on
   `/projects/leonardonunez-dev`, with no mini element reported. Tests: the existing suites, once Task 3 adds the
   page to `e2e/pages.ts`.

## Plan notes against the spec (each is a ruling for the ledger)

- **Overlaps stays in `e2e/loading.ts`.** The spec moves `overlaps` too, but no case uses it; case 3 is guarded by
  the loading test "media keeps its size and nothing moves while it loads", whose measuring part (`mediaBoxes`) moves
  instead. Cost if wrong: one more function moved later.
- **Case 4 is a long code line, not a URL.** A fixed-width line (340 px) fails at 360 and passes at 390 on every
  machine; a URL's width depends on fonts. Cost if wrong: the label reads "A long line" either way.
- **No responsive remount.** The frames are HTML, not two SVG drawings, so `mountResponsive` isn't needed; one mount
  survives resizing, and the state is never lost. The spec's "resize remount keeps the case" is tested as "resizing
  keeps the bug".

---

### Task 0: Start from current main

**Files:** none.

- [ ] **Step 1:** Confirm the branch and its base:

```bash
git status -sb
git log --oneline -3 origin/main
```

Expected: on `design/site-world`, containing the spec commit on top of `origin/main`. If PR #44 (About) or #45
(lanes minors) merged since, merge `origin/main` into the branch (no rebase, no force-push) and ledger it.

- [ ] **Step 2:** Re-read the kit signatures this plan consumes:

```bash
grep -n "^export" src/design/figure/*.ts
```

Expected: `whenVisible(el, load)` in `lazy.ts`. `Controls.astro` takes `speed` and `play` props (both default
true); this plan passes `speed={false} play={false}` and wires its `[data-reset]` button itself.

---

### Task 1: The shared checks

**Files:**
- Create: `src/design/checks/checks.ts`, `src/design/checks/checks.test.ts`, `e2e/in-page.ts`
- Modify: `e2e/figures.ts`, `e2e/layout.spec.ts`, `e2e/loading.ts`

**Interfaces:**
- Produces:
  - `labelCollisions(fig: ParentNode): string[]` — `"<line> x <label>"` hits in the first visible
    `svg[data-layout]` inside `fig`; `[]` when there is none.
  - `titleGap(h1: Element): number` — px from the parent's padded left edge to the h1's left edge.
  - `overflowX(el: Pick<Element, "scrollWidth" | "clientWidth">): number` — px the content is wider than the box.
  - `mediaBoxes(scope: ParentNode, selector?: string): { src: string; width: number; height: number }[]`.
  - `inPage<A extends unknown[], R>(page: Page, root: string | null, check: (scope: never, ...args: A) => R, ...args: A): Promise<R>`.

- [ ] **Step 1: Write the failing unit test**

`src/design/checks/checks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as checks from "./checks";

// e2e sends each check into the page as source text, so a check must work from its own source alone.
const fromSource = <F>(fn: F): F => new Function(`return (${String(fn)})`)() as F;

describe("the shared checks", () => {
  it("each compiles from its own source", () => {
    for (const fn of [checks.labelCollisions, checks.titleGap, checks.overflowX, checks.mediaBoxes]) {
      expect(typeof fromSource(fn)).toBe("function");
    }
  });

  it("overflowX: how far the content is wider than its box", () => {
    expect(fromSource(checks.overflowX)({ scrollWidth: 380, clientWidth: 360 })).toBe(20);
    expect(fromSource(checks.overflowX)({ scrollWidth: 360, clientWidth: 360 })).toBe(0);
  });

  it("labelCollisions finds nothing where there is no drawing", () => {
    expect(fromSource(checks.labelCollisions)(document.createElement("div"))).toEqual([]);
  });

  it("titleGap: the h1's distance from its box's padded left edge", () => {
    const box = document.createElement("div");
    box.style.paddingLeft = "16px";
    const h1 = document.createElement("h1");
    box.append(h1);
    document.body.append(box);
    box.getBoundingClientRect = () => ({ left: 100 }) as DOMRect;
    h1.getBoundingClientRect = () => ({ left: 116 }) as DOMRect;
    expect(fromSource(checks.titleGap)(h1)).toBe(0);
    h1.getBoundingClientRect = () => ({ left: 220 }) as DOMRect;
    expect(fromSource(checks.titleGap)(h1)).toBe(104);
    box.remove();
  });

  it("mediaBoxes: each match's rounded size and source", () => {
    const scope = document.createElement("div");
    scope.innerHTML = '<img src="/a.png"><div class="m-img"></div>';
    const [img, div] = [...scope.children];
    img.getBoundingClientRect = () => ({ width: 99.6, height: 50.2 }) as DOMRect;
    div.getBoundingClientRect = () => ({ width: 10, height: 0 }) as DOMRect;
    expect(fromSource(checks.mediaBoxes)(scope)).toEqual([{ src: "/a.png", width: 100, height: 50 }]);
    expect(fromSource(checks.mediaBoxes)(scope, ".m-img")).toEqual([{ src: "", width: 10, height: 0 }]);
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run src/design/checks --reporter=dot`
Expected: FAIL, cannot resolve `./checks`.

- [ ] **Step 3: Write the checks**

`src/design/checks/checks.ts` (the bodies are the e2e helpers' current code, lifted unchanged except for taking a
scope instead of `document`):

```ts
// The layout checks CI runs on every page, shared with the leonardonunez.dev figure. e2e/in-page.ts sends each one
// into the page as source text, so a check may reference nothing outside its own body.

/** Every drawn line in a figure's visible drawing, sampled every 2 units, tested against every text box (+2 px).
 *  Only the drawn part of a route counts (length minus its dash offset). Returns "<line> x <label>" hits. */
export function labelCollisions(fig: ParentNode): string[] {
  const svg = [...fig.querySelectorAll("svg[data-layout]")].find((s) => s.getBoundingClientRect().width > 0);
  if (!svg) return [];
  const texts = [...svg.querySelectorAll("text")].filter((t) => t.textContent).map((t) => ({ n: t.textContent ?? "", r: t.getBoundingClientRect() }));
  const out = new Set<string>();
  for (const path of svg.querySelectorAll<SVGPathElement>("path.wire, path.route, path.path-dump.on")) {
    const cs = getComputedStyle(path);
    if (cs.opacity === "0" || cs.visibility === "hidden") continue;
    const L = path.getTotalLength();
    const vis = path.classList.contains("route") ? L - (parseFloat(cs.strokeDashoffset) || 0) : L;
    const m = path.getScreenCTM()!;
    for (let d = 0; d <= vis; d += 2) {
      const p = path.getPointAtLength(d).matrixTransform(m);
      for (const { n, r } of texts) if (p.x > r.left - 2 && p.x < r.right + 2 && p.y > r.top - 2 && p.y < r.bottom + 2) out.add(`${path.dataset.path || path.getAttribute("class")} x ${n}`);
    }
  }
  return [...out];
}

/** How far a page title starts from its box's left content edge, in px. Caught on /about and /kit (#38): a grid
 *  meant for the home hero's portrait put the kicker in one column and the h1 in the other. */
export function titleGap(h1: Element): number {
  const box = h1.parentElement!;
  const left = box.getBoundingClientRect().left + parseFloat(getComputedStyle(box).paddingLeft);
  return h1.getBoundingClientRect().left - left;
}

/** How many px an element's content is wider than its box: above 0, it scrolls sideways. */
export function overflowX(el: Pick<Element, "scrollWidth" | "clientWidth">): number {
  return el.scrollWidth - el.clientWidth;
}

/** Each image and video's rounded box, to compare before and after it loads. */
export function mediaBoxes(scope: ParentNode, selector = "img, video"): { src: string; width: number; height: number }[] {
  return [...scope.querySelectorAll(selector)].map((el) => {
    const r = el.getBoundingClientRect();
    return { src: el.getAttribute("src") ?? el.getAttribute("poster") ?? "", width: Math.round(r.width), height: Math.round(r.height) };
  });
}
```

- [ ] **Step 4: Run it to watch it pass**

Run: `npx vitest run src/design/checks --reporter=dot`
Expected: 5 passed.

- [ ] **Step 5: Send the checks into the page from e2e**

`e2e/in-page.ts`:

```ts
import type { Page } from "@playwright/test";

/** Runs a check from src/design/checks in the page, on the element `root` selects (the document when null). The
 *  check travels as source text, which is why those checks reference nothing outside their own bodies. */
export function inPage<A extends unknown[], R>(page: Page, root: string | null, check: (scope: never, ...args: A) => R, ...args: A): Promise<R> {
  return page.evaluate(
    ([src, sel, rest]) => {
      const scope = sel ? document.querySelector(sel)! : document;
      return new Function(`return (${src})`)()(scope, ...rest);
    },
    [String(check), root, args] as const,
  ) as Promise<R>;
}
```

Replace `e2e/figures.ts` with:

```ts
import type { Page } from "@playwright/test";
import { labelCollisions as collisions } from "../src/design/checks/checks";
import { inPage } from "./in-page";

/** Every drawn line in the figure `root` selects, tested against every label (src/design/checks). */
export function labelCollisions(page: Page, root: string): Promise<string[]> {
  return inPage(page, root, collisions);
}
```

In `e2e/loading.ts`, replace the body of `mediaBoxes(page)` (keep its name and signature) with
`return inPage(page, null, boxes);`, importing `{ mediaBoxes as boxes } from "../src/design/checks/checks"` and
`{ inPage } from "./in-page"`.

In `e2e/layout.spec.ts`, import `{ overflowX, titleGap } from "../src/design/checks/checks"` and `{ inPage }`, and
replace the two `page.evaluate` / `locator.evaluate` blocks:

```ts
    const overflow = await inPage(page, "html", overflowX);
```

```ts
    // Caught on /about and /kit: a grid meant for the home hero's portrait put the
    // kicker in one column and the h1 in the other.
    const gap = await inPage(page, "h1", titleGap);
```

Test titles stay exactly as they are (Task 2 quotes them).

- [ ] **Step 6: Prove the e2e suites still pass on the moved checks**

Run: `npm run build` then
`npx playwright test e2e/layout.spec.ts e2e/loading.spec.ts e2e/figures.spec.ts e2e/lanes-figure.spec.ts --reporter=dot`
Expected: the same pass and skip counts as on `origin/main` (run it there first if unsure). A failure saying
`ReferenceError` means a check reached outside its body: fix the check, not the test.

- [ ] **Step 7:** `npm run lint` and `npm run typecheck`, both 0 errors. Commit:

```bash
git add src/design/checks e2e/in-page.ts e2e/figures.ts e2e/loading.ts e2e/layout.spec.ts
git commit -m "Share CI's layout checks between e2e and the page"
```

---

### Task 2: The case model

**Files:**
- Create: `src/worlds/site/model/cases.ts`, `src/worlds/site/model/cases.test.ts`

**Interfaces:**
- Produces: `WIDTHS`, `type Width`, `type CaseId = "fonts" | "hero" | "media" | "line"`,
  `type Verdict = "caught" | "missed" | "guarded"`, `interface Case`, `CASES: readonly Case[]`,
  `VERDICT_TEXT: Record<Verdict, string>`, `failureText(c: Case, widths: readonly Width[], detail: string): string`.

- [ ] **Step 1: Write the failing test**

`src/worlds/site/model/cases.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CASES, failureText, WIDTHS } from "./cases";

describe("the figure's cases", () => {
  it("are the four from the spec, in order", () => {
    expect(CASES.map((c) => c.id)).toEqual(["fonts", "hero", "media", "line"]);
    expect(WIDTHS).toEqual([360, 390, 768, 1280]);
  });

  it("call only #40 a catch, and #38 a miss", () => {
    expect(CASES.filter((c) => c.verdict === "caught").map((c) => c.pr)).toEqual([40]);
    expect(CASES.filter((c) => c.verdict === "missed").map((c) => c.pr)).toEqual([38]);
  });

  it("fail at the widths the spec names", () => {
    expect(Object.fromEntries(CASES.map((c) => [c.id, c.failsAt]))).toEqual({
      fonts: [768],
      hero: [768, 1280],
      media: [360, 390, 768, 1280],
      line: [360],
    });
  });

  it("quote each guarding e2e test by its exact title", () => {
    for (const c of CASES) expect(readFileSync(c.test.file, "utf-8"), c.id).toContain(c.test.title);
  });

  it("word a failure with its widths and the test's title", () => {
    const hero = CASES[1];
    expect(failureText(hero, [768, 1280], "the title doesn't start at the content's left edge")).toBe(
      "Fails at 768 and 1280 px. CI's test “the page title starts at the left edge of the content”: the title doesn't start at the content's left edge.",
    );
    expect(failureText(hero, [360, 390, 768], "x")).toBe(
      "Fails at 360, 390 and 768 px. CI's test “the page title starts at the left edge of the content”: x.",
    );
  });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run src/worlds/site --reporter=dot`
Expected: FAIL, cannot resolve `./cases`.

- [ ] **Step 3: Write the model**

`src/worlds/site/model/cases.ts`:

```ts
// The bugs the "Where it breaks" figure can inject. Each names the e2e test that guards against it, by its exact
// title, and whether the gate caught it (#40), missed it and then gained a test (#38), or guarded it from the start.

export const WIDTHS = [360, 390, 768, 1280] as const;
export type Width = (typeof WIDTHS)[number];
export type CaseId = "fonts" | "hero" | "media" | "line";
export type Verdict = "caught" | "missed" | "guarded";

export interface Case {
  id: CaseId;
  /** The switch's text. */
  label: string;
  verdict: Verdict;
  pr?: number;
  test: { file: string; title: string };
  failsAt: readonly Width[];
  /** The caption while it fails, and after Fix it. */
  bug: string;
  fix: string;
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  caught: "caught by CI",
  missed: "missed, then tested",
  guarded: "guarded",
};

export const CASES: readonly Case[] = [
  {
    id: "fonts",
    label: "CI's wider fonts",
    verdict: "caught",
    pr: 40,
    test: { file: "e2e/figures.spec.ts", title: "no line crosses a label at any step or mid-switch" },
    failsAt: [768],
    bug: "CI's fonts set the label wider, and on tablets the route crosses it.",
    fix: "The route climbs clear of the label, as in #40.",
  },
  {
    id: "hero",
    label: "A grid for one hero",
    verdict: "missed",
    pr: 38,
    test: { file: "e2e/layout.spec.ts", title: "the page title starts at the left edge of the content" },
    failsAt: [768, 1280],
    bug: "A grid meant for the home page's portrait splits the kicker and the title into two columns.",
    fix: "The grid applies only to a header with a portrait, as in #38.",
  },
  {
    id: "media",
    label: "No reserved space",
    verdict: "guarded",
    test: { file: "e2e/loading.spec.ts", title: "media keeps its size and nothing moves while it loads" },
    failsAt: [360, 390, 768, 1280],
    bug: "The picture has no height until it loads, then pushes the text down.",
    fix: "The picture reserves its space before it loads.",
  },
  {
    id: "line",
    label: "A long line",
    verdict: "guarded",
    test: { file: "e2e/layout.spec.ts", title: "has no horizontal page scroll" },
    failsAt: [360],
    bug: "A code line is wider than a 360 px screen, so the whole page scrolls sideways.",
    fix: "The code line scrolls inside its own box.",
  },
];

/** "Fails at 768 and 1280 px. CI's test “…”: <detail>." */
export function failureText(c: Case, widths: readonly Width[], detail: string): string {
  const list = widths.length > 1 ? `${widths.slice(0, -1).join(", ")} and ${widths.at(-1)}` : String(widths[0]);
  return `Fails at ${list} px. CI's test “${c.test.title}”: ${detail}.`;
}
```

- [ ] **Step 4: Run it to watch it pass**

Run: `npx vitest run src/worlds/site --reporter=dot`
Expected: 5 passed.

- [ ] **Step 5:** Commit:

```bash
git add src/worlds/site/model
git commit -m "Model the site figure's four bugs and the tests that guard them"
```

---

### Task 3: The frames, the world and the page

**Files:**
- Create: `src/worlds/site/world.css`, `src/worlds/site/figures/SiteFrame.astro`,
  `src/worlds/site/figures/SiteFigure.astro`, `e2e/site-figure.spec.ts`
- Rename: `src/content/projects/leonardonunez-dev/index.md` → `index.mdx` (frontmatter kept; body added)
- Modify: `src/worlds/index.ts`, `tests/dist/budget.ts`, `e2e/pages.ts`, `lighthouserc.json`,
  `tests/dist/home.test.ts`

**Interfaces:**
- Consumes: `CASES`, `VERDICT_TEXT`, `WIDTHS` (Task 2).
- Produces (markup the view and tests rely on):
  - `figure.fig[data-figure="site"][data-show="360"]`; optional `data-case="<CaseId>"` and `data-fixed`.
  - `.sf[data-w][data-result]` frames (`role="img"`), each with `.sf-view > .m-page.loaded` and `.sf-out`.
  - Inside `.m-page`: `.m-hero > .m-kicker + .m-h1`, `.m-img`, `.m-code > span`, `.m-fig` with three
    `svg.m-svg[data-layout="phone|tablet|desktop"]`, each holding `path.wire[data-path="route"]` and
    `text.m-label`; the tablet drawing also holds `path.wire.m-climb[data-path="climb"]`.
  - `[data-pick="<w>"]` width buttons, `[data-bug="<CaseId>"]` switches, `[data-fix]`, `[data-reset]`,
    `.fig-caption`.

- [ ] **Step 1: Write the failing e2e test**

`e2e/site-figure.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const URL = "/projects/leonardonunez-dev";
const FIG = 'figure[data-figure="site"]';

async function frameDrawings(page: Page) {
  return page.locator(`${FIG} .sf`).evaluateAll((frames) =>
    frames.map((f) => [Number((f as HTMLElement).dataset.w), [...f.querySelectorAll<SVGSVGElement>("svg.m-svg")].find((s) => s.getBoundingClientRect().width > 0)?.dataset.layout]),
  );
}

test.describe("where it breaks: the frames", () => {
  test("renders its full size before its script runs", async ({ page }) => {
    await page.goto(URL);
    const before = await page.locator(FIG).boundingBox();
    await page.locator(FIG).evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" }));
    await expect(page.locator(`${FIG} [data-fix]`)).toHaveAttribute("data-ready", "");
    const after = await page.locator(FIG).boundingBox();
    expect(after?.height).toBeCloseTo(before!.height, 0);
  });

  test("lays each frame out at its own width, not the window's", async ({ page }) => {
    await page.goto(URL);
    expect(await frameDrawings(page)).toEqual([
      [360, "phone"],
      [390, "phone"],
      [768, "tablet"],
      [1280, "desktop"],
    ]);
  });
});
```

The `data-ready` test fails until Task 4; mark it `test.fixme` in this task and remove the `fixme` in Task 4
(ledger nothing: the plan says so).

- [ ] **Step 2: Run it to watch it fail**

Run: `npm run build` then `npx playwright test e2e/site-figure.spec.ts --reporter=dot`
Expected: FAIL, the page returns 404 / the figure doesn't exist.

- [ ] **Step 3: The world's colours and the frames' CSS**

`src/worlds/site/world.css`:

```css
/* The leonardonunez.dev world. Placeholder colours until the palette round; the roles are fixed: pass, fail, and
   the outline marking what failed. The miniature pages keep the site's own paper and ink. */
.world-site {
  --site-bg: #1c1d22;
  --site-ink: #e9e7e1;
  --site-dim: #a7a7b1;
  --site-pass: #6fd49a;
  --site-fail: #ef5350;
  --site-paper: #f4f1ea;
  --site-text: #1d1f24;
  --site-muted: #50535b;
  --fig-bg: var(--site-bg);
  --fig-ink: var(--site-ink);
  --fig-dim: var(--site-dim);
  --fig-rule: #55575f;
  --fig-bar: #23242a;
  --fig-btn: #34363d;
  --fig-btn-hover: #43454d;
  --fig-accent: #8fb3ff;
  --fig-on-accent: #10131a;
  --fig-done: var(--site-pass);
  --fig-on: var(--site-pass);
  --fig-off: var(--site-fail);
  --fig-off-bg: #4a2628;
}

/* Four frames side by side, each as wide as its screen relative to the others. */
[data-figure="site"] .sf-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 1rem;
}
[data-figure="site"] .sf {
  flex: var(--w) 1 0;
  min-width: 0;
}
[data-figure="site"] .sf-view {
  aspect-ratio: var(--w) / 640;
  overflow: hidden;
  border-radius: 6px;
  outline: 1px solid var(--fig-rule);
  background: var(--site-paper);
  transition: outline-color 0.2s;
}
[data-figure="site"] .sf[data-result="fail"] .sf-view {
  outline: 2px solid var(--site-fail);
}
[data-figure="site"] .sf-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0 0.4rem;
  margin-top: 0.4rem;
  font: 600 0.75rem/1.3 var(--font-sans);
  color: var(--fig-dim);
}
[data-figure="site"] .sf-out {
  color: var(--site-pass);
}
[data-figure="site"] .sf[data-result="fail"] .sf-out {
  color: var(--site-fail);
}
[data-figure="site"] .sf-verdict {
  font-weight: 400;
  opacity: 0.8;
}
[data-figure="site"] .sf-pick {
  display: none;
}

/* Phones: one frame at a time. The others stay laid out (the checks measure them) but unseen. */
@media (max-width: 40rem) {
  [data-figure="site"] .sf-pick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 1rem 1rem 0;
  }
  [data-figure="site"] [data-pick][data-result="fail"]::after {
    content: " · fails";
  }
  [data-figure="site"] .sf-row {
    display: block;
    position: relative;
  }
  [data-figure="site"] .sf {
    position: absolute;
    inset: 1rem 1rem auto;
    opacity: 0;
    pointer-events: none;
  }
  [data-figure="site"][data-show="360"] .sf[data-w="360"],
  [data-figure="site"][data-show="390"] .sf[data-w="390"],
  [data-figure="site"][data-show="768"] .sf[data-w="768"],
  [data-figure="site"][data-show="1280"] .sf[data-w="1280"] {
    position: relative;
    inset: auto;
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-figure="site"] .sf-view {
    transition: none;
  }
}

/* The miniature page: laid out at its real width (--w px), scaled down by the view's `zoom`. Its breakpoints are
   the site's (40rem, 64rem), read from its own width through container queries. */
[data-figure="site"] .m-page {
  width: calc(var(--w) * 1px);
  box-sizing: border-box;
  container: mini / inline-size;
  overflow: auto hidden;
  padding: 12px 16px 16px;
  background: var(--site-paper);
  color: var(--site-text);
  font: 14px/1.4 var(--font-sans);
}
.m-head {
  display: flex;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid #c9c4b8;
  font-weight: 700;
}
.m-hero {
  margin: 20px 0 14px;
}
.m-kicker {
  color: var(--site-muted);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.m-h1 {
  font: 700 30px/1.1 var(--font-serif);
}
.m-img {
  aspect-ratio: 16 / 7;
  border-radius: 4px;
  background: linear-gradient(135deg, #9db4c0, #5c7d8a);
}
.m-text {
  margin: 12px 0;
}
.m-code {
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
  padding: 4px 6px;
  background: #e6e1d6;
  font: 12px/1.6 var(--font-mono, monospace);
  white-space: nowrap;
}
.m-code span {
  display: inline-block;
  width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: top;
}
.m-svg {
  display: none;
  width: 100%;
  height: 64px;
  margin-top: 12px;
}
.m-svg[data-layout="phone"] {
  display: block;
}
@container mini (min-width: 40rem) {
  .m-svg[data-layout="phone"] {
    display: none;
  }
  .m-svg[data-layout="tablet"] {
    display: block;
  }
}
@container mini (min-width: 64rem) {
  .m-svg[data-layout="tablet"] {
    display: none;
  }
  .m-svg[data-layout="desktop"] {
    display: block;
  }
}
.m-svg .wire {
  fill: none;
  stroke: #2f6f8f;
  stroke-width: 3;
}
.m-svg .m-climb {
  visibility: hidden;
}
.m-label {
  fill: var(--site-text);
  font: 600 13px var(--font-sans);
}

/* The bugs (on while the figure carries data-case and not data-fixed) and their fixes. */
[data-figure="site"][data-case="fonts"][data-fixed] .m-svg[data-layout="tablet"] [data-path="route"] {
  visibility: hidden;
}
[data-figure="site"][data-case="fonts"][data-fixed] .m-climb {
  visibility: visible;
}
@container mini (min-width: 40rem) {
  [data-figure="site"][data-case="hero"]:not([data-fixed]) .m-hero,
  .m-hero:has(.m-portrait) {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: 1rem;
    align-items: end;
  }
}
[data-figure="site"][data-case="media"]:not([data-fixed]) .m-page:not(.loaded) .m-img {
  aspect-ratio: auto;
  height: 0;
}
[data-figure="site"][data-case="line"]:not([data-fixed]) .m-code {
  max-width: none;
  width: max-content;
  overflow: visible;
}

/* What failed, outlined in the failing frames. */
[data-figure="site"][data-case="fonts"] .sf[data-result="fail"] .m-label {
  fill: #b3261e;
}
[data-figure="site"][data-case="hero"] .sf[data-result="fail"] .m-h1,
[data-figure="site"][data-case="media"] .sf[data-result="fail"] .m-img,
[data-figure="site"][data-case="line"] .sf[data-result="fail"] .m-code {
  outline: 3px solid var(--site-fail);
  outline-offset: 2px;
}
```

- [ ] **Step 4: The frame and the figure**

`src/worlds/site/figures/SiteFrame.astro`:

```astro
---
// One miniature page at a real screen width. Its contents use no content tags (no h1, p, img…), so the page-wide
// e2e checks never mistake it for the article.
interface Props {
  w: number;
}
const { w } = Astro.props;
---

<div class="sf" data-w={w} data-result="pass" role="img" aria-label={`The page at ${w} px: passes`} style={`--w: ${w}`}>
  <div class="sf-view">
    <div class="m-page loaded" aria-hidden="true">
      <div class="m-head"><span>LN</span><span>Work · About</span></div>
      <div class="m-hero"><div class="m-kicker">Case study</div><div class="m-h1">satis-manager</div></div>
      <div class="m-img"></div>
      <div class="m-text">A dashboard for a factory game, moved from a home PC to AWS.</div>
      <div class="m-code"><span>curl https://api.satis-manager.com/v1/health</span></div>
      <div class="m-fig">
        <svg class="m-svg" data-layout="phone">
          <path class="wire" data-path="route" d="M260 8 V56"></path>
          <text class="m-label" x="40" y="38" textLength="140" lengthAdjust="spacingAndGlyphs">CLOUDFLARE</text>
        </svg>
        <svg class="m-svg" data-layout="tablet">
          <path class="wire" data-path="route" d="M200 8 V56"></path>
          <path class="wire m-climb" data-path="climb" d="M200 8 V14 H240 V56"></path>
          <text class="m-label" x="40" y="38" textLength="140" lengthAdjust="spacingAndGlyphs">CLOUDFLARE</text>
        </svg>
        <svg class="m-svg" data-layout="desktop">
          <path class="wire" data-path="route" d="M260 8 V56"></path>
          <text class="m-label" x="40" y="38" textLength="140" lengthAdjust="spacingAndGlyphs">CLOUDFLARE</text>
        </svg>
      </div>
    </div>
  </div>
  <div class="sf-foot"><span>{w} px</span><span class="sf-out">passes</span></div>
</div>
```

Geometry: the label spans x 40–180 normally (20 clear of the tablet route at 200) and 40–210 with CI's
`textLength` 170 (crossing it); the climb runs at 240, 30 clear. Phone and desktop routes at 260 stay clear of both.

`src/worlds/site/figures/SiteFigure.astro`:

```astro
---
// Where it breaks: one small page at four real widths, checked with the code CI runs (src/design/checks). The
// frames are static markup; site-view.ts injects the reader's bug and runs the checks once the figure is in view.
import SiteFrame from "./SiteFrame.astro";
import Controls from "../../../design/figure/Controls.astro";
import { CASES, VERDICT_TEXT, WIDTHS } from "../model/cases";
import "../../../design/figure/figure.css";
import "../world.css";
---

<figure class="fig" data-figure="site" data-show="360">
  <div class="sf-pick" role="group" aria-label="Screen width">
    {WIDTHS.map((w, i) => <button class="fig-tbtn" type="button" data-pick={w} aria-pressed={String(i === 0)}>{w} px</button>)}
  </div>
  <div class="sf-row">{WIDTHS.map((w) => <SiteFrame w={w} />)}</div>
  <Controls label="Figure controls" speed={false} play={false}>
    {
      CASES.map((c) => (
        <button class="fig-tbtn" type="button" data-bug={c.id} aria-pressed="false">
          {c.label} <span class="sf-verdict">· {VERDICT_TEXT[c.verdict]}</span>
        </button>
      ))
    }
    <button class="fig-tbtn primary" type="button" data-fix aria-disabled="true">Fix it</button>
  </Controls>
  <p class="fig-caption" aria-live="polite">Pick a bug to inject. Each frame then runs the check CI runs on every page.</p>
</figure>

<script>
  import { whenVisible } from "../../../design/figure/lazy";
  for (const el of document.querySelectorAll<HTMLElement>('figure[data-figure="site"]')) {
    whenVisible(el, () => {
      void import("./site-view").then((m) => m.mount(el));
    });
  }
</script>
```

Create `src/worlds/site/figures/site-view.ts` as a stub for now, so the build resolves the import:

```ts
export function mount(_root: HTMLElement): () => void {
  return () => {};
}
```

- [ ] **Step 5: The page**

Rename the content file (`git mv src/content/projects/leonardonunez-dev/index.md src/content/projects/leonardonunez-dev/index.mdx`).
Add `world: true` to its frontmatter (no `cover`/`ogImage` yet: Task 6 adds the stills) and this body:

```mdx
import SiteFigure from "../../../worlds/site/figures/SiteFigure.astro";

## Where it breaks

<SiteFigure />
```

`src/worlds/index.ts`: `{ "satisfactory-dash": "satis", lanes: "lanes", "leonardonunez-dev": "site" }`.
`tests/dist/budget.ts`: add `"projects/leonardonunez-dev.html": 15_000,` after lanes.
`e2e/pages.ts`: add `{ name: "site", path: "/projects/leonardonunez-dev", status: 200 },` after lanes.
`lighthouserc.json`: add `"http://127.0.0.1:4321/projects/leonardonunez-dev"` after the lanes URL.
`tests/dist/home.test.ts`: the case links become
`["/projects/satisfactory-dash", "/projects/lanes", "/projects/leonardonunez-dev"]`.

- [ ] **Step 6: Run it to watch it pass**

Run: `npm run build`, `npm run test:dist`, then `npx playwright test e2e/site-figure.spec.ts --reporter=dot`.
Expected: dist all pass; the layout test passes in all four viewports (the `data-ready` test is `fixme`).

If the 768 or 1280 frame shows the phone drawing, the container query isn't seeing the frame's own width (it is
measured before the view's `zoom`, which the stub doesn't set yet, so this should pass). If it still fails, replace
the three `@container mini` blocks with `[data-w="768"]` / `[data-w="1280"]` selectors and ledger the ruling.

- [ ] **Step 7: The whole page's checks**

Run: `npx playwright test e2e/layout.spec.ts e2e/loading.spec.ts e2e/a11y.spec.ts --grep "site" --reporter=dot`
Expected: all pass (Review Focus 5). An overlap naming an `.m-` element means a content tag slipped into a frame.

- [ ] **Step 8:** lint and typecheck clean. Commit:

```bash
git add -A src/worlds/site src/worlds/index.ts src/content/projects/leonardonunez-dev tests/dist/budget.ts tests/dist/home.test.ts e2e/pages.ts e2e/site-figure.spec.ts lighthouserc.json
git commit -m "Add the site figure's frames: one page at four real widths"
```

---

### Task 4: Injecting a bug, checking it, fixing it

**Files:**
- Modify: `src/worlds/site/figures/site-view.ts` (replace the stub), `e2e/site-figure.spec.ts`

**Interfaces:**
- Consumes: Task 1's checks, Task 2's model, Task 3's markup.
- Produces: `mount(root: HTMLElement): () => void`.

- [ ] **Step 1: Write the failing tests**

Remove the `fixme` from "renders its full size before its script runs", and add to `e2e/site-figure.spec.ts`:

```ts
import { CASES } from "../src/worlds/site/model/cases";

async function open(page: Page) {
  await page.goto(URL);
  const fig = page.locator(FIG);
  await fig.evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" }));
  await expect(fig.locator("[data-fix]")).toHaveAttribute("data-ready", "");
  return fig;
}

function results(page: Page) {
  return page.locator(`${FIG} .sf`).evaluateAll((els) => els.map((e) => [Number((e as HTMLElement).dataset.w), (e as HTMLElement).dataset.result]));
}

const expected = (fails: readonly number[]) => [360, 390, 768, 1280].map((w) => [w, fails.includes(w) ? "fail" : "pass"]);

test.describe("where it breaks: the bugs", () => {
  test("every frame passes before a bug is injected", async ({ page }) => {
    await open(page);
    expect(await results(page)).toEqual(expected([]));
  });

  for (const c of CASES) {
    test(`${c.id}: fails at exactly ${c.failsAt.join(", ")} px, and passes after Fix it`, async ({ page }) => {
      const fig = await open(page);
      await fig.locator(`[data-bug="${c.id}"]`).click();
      expect(await results(page)).toEqual(expected(c.failsAt));
      await expect(fig.locator(".fig-caption")).toContainText(c.test.title);
      await expect(fig.locator("[data-fix]")).toHaveAttribute("aria-disabled", "false");
      await fig.locator("[data-fix]").click();
      expect(await results(page)).toEqual(expected([]));
      await expect(fig.locator(".fig-caption")).toContainText(c.fix);
      await expect(fig.locator("[data-fix]")).toHaveAttribute("aria-disabled", "true");
    });
  }

  test("switching bugs drops the fix and re-checks (Review Focus 1)", async ({ page }) => {
    const fig = await open(page);
    await fig.locator('[data-bug="hero"]').click();
    await fig.locator("[data-fix]").click();
    await fig.locator('[data-bug="line"]').click();
    expect(await results(page)).toEqual(expected([360]));
    await expect(fig).not.toHaveAttribute("data-fixed", "");
    await expect(fig.locator("[data-fix]")).toHaveAttribute("aria-disabled", "false");
    await expect(fig.locator('[data-bug="hero"]')).toHaveAttribute("aria-pressed", "false");
  });

  test("turning a bug off and on gives the same results (Review Focus 4)", async ({ page }) => {
    const fig = await open(page);
    for (let i = 0; i < 2; i++) {
      await fig.locator('[data-bug="media"]').click();
      expect(await results(page)).toEqual(expected([360, 390, 768, 1280]));
      await fig.locator('[data-bug="media"]').click();
      expect(await results(page)).toEqual(expected([]));
    }
    expect(await page.locator(`${FIG} .m-page:not(.loaded)`).count()).toBe(0);
  });

  test("Reset clears the bug", async ({ page }) => {
    const fig = await open(page);
    await fig.locator('[data-bug="fonts"]').click();
    await fig.locator("[data-reset]").click();
    expect(await results(page)).toEqual(expected([]));
    await expect(fig).not.toHaveAttribute("data-case", /.+/);
  });

  test("keyboard only: Tab reaches every bug and Fix it, and focus stays on Fix it (Review Focus 2)", async ({ page }) => {
    const fig = await open(page);
    await fig.locator('[data-bug="fonts"]').focus();
    await page.keyboard.press("Enter");
    for (let i = 0; i < CASES.length - 1; i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(fig.locator("[data-fix]")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(fig.locator("[data-fix]")).toBeFocused();
    expect(await results(page)).toEqual(expected([]));
  });

  test("announces once per press, never on its own", async ({ page }) => {
    const fig = await open(page);
    await fig.locator(".fig-caption").evaluate((el) => {
      (window as unknown as { changes: number }).changes = 0;
      new MutationObserver(() => (window as unknown as { changes: number }).changes++).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await fig.locator('[data-bug="fonts"]').click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { changes: number }).changes)).toBe(1);
  });

  test("works under reduced motion, with no transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fig = await open(page);
    await fig.locator('[data-bug="hero"]').click();
    expect(await results(page)).toEqual(expected([768, 1280]));
    expect(await fig.locator(".sf-view").first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  });
});
```

(Move `import { CASES }` to the top of the file with the other imports.)

- [ ] **Step 2: Run them to watch them fail**

Run: `npx playwright test e2e/site-figure.spec.ts --reporter=dot`
Expected: FAIL, `data-ready` never appears (the stub).

- [ ] **Step 3: Write the view**

`src/worlds/site/figures/site-view.ts`:

```ts
// Injects the bug the reader picks into four miniature pages, each laid out at its real width, and checks each
// with the code CI runs (src/design/checks). Nothing moves on its own: every change follows a press.
import { CASES, failureText, type Case, type Width } from "../model/cases";
import { labelCollisions, mediaBoxes, overflowX, titleGap } from "../../../design/checks/checks";

// The label's width under the machine's fonts and under CI's wider ones (#40), fixed so the geometry is exact.
const LABEL = { normal: "140", ci: "170" };

/** The case's check on one frame: why it fails, or null when it passes. */
function failure(c: Case, frame: HTMLElement): string | null {
  const page = frame.querySelector<HTMLElement>(".m-page")!;
  switch (c.id) {
    case "fonts": {
      const hits = labelCollisions(frame);
      return hits.length ? hits.join(", ") : null;
    }
    case "hero": {
      const zoom = Number(page.style.zoom) || 1;
      return Math.abs(titleGap(page.querySelector(".m-h1")!)) / zoom < 1 ? null : "the title doesn't start at the content's left edge";
    }
    case "media": {
      // Measure the page as it would be while the picture loads, then loaded, as the e2e test does.
      const measure = () => JSON.stringify([mediaBoxes(page, ".m-img"), page.scrollHeight]);
      page.classList.remove("loaded");
      const before = measure();
      page.classList.add("loaded");
      return before === measure() ? null : "the picture's box changed when it loaded";
    }
    case "line":
      return overflowX(page) > 0 ? "the page scrolls sideways" : null;
  }
}

export function mount(root: HTMLElement): () => void {
  const frames = [...root.querySelectorAll<HTMLElement>(".sf")];
  const bugs = [...root.querySelectorAll<HTMLButtonElement>("[data-bug]")];
  const picks = [...root.querySelectorAll<HTMLButtonElement>("[data-pick]")];
  const fix = root.querySelector<HTMLButtonElement>("[data-fix]")!;
  const reset = root.querySelector<HTMLButtonElement>("[data-reset]")!;
  const caption = root.querySelector<HTMLElement>(".fig-caption")!;
  const idle = caption.textContent ?? "";
  let current: Case | null = null;
  let fixed = false;

  // Scale each page to its view; the page keeps laying itself out at its real width.
  function fit() {
    for (const f of frames) {
      const view = f.querySelector<HTMLElement>(".sf-view")!;
      f.querySelector<HTMLElement>(".m-page")!.style.zoom = String(view.clientWidth / Number(f.dataset.w));
    }
  }

  /** Applies the state, checks every frame, and (after a press) says what happened. */
  function run(announce: boolean) {
    if (current) root.dataset.case = current.id;
    else delete root.dataset.case;
    root.toggleAttribute("data-fixed", fixed);
    for (const t of root.querySelectorAll(".m-label")) t.setAttribute("textLength", current?.id === "fonts" ? LABEL.ci : LABEL.normal);
    const failing: Width[] = [];
    let detail = "";
    for (const f of frames) {
      const w = Number(f.dataset.w) as Width;
      const why = current ? failure(current, f) : null;
      f.dataset.result = why ? "fail" : "pass";
      f.setAttribute("aria-label", `The page at ${w} px: ${why ? `fails, ${why}` : "passes"}`);
      f.querySelector(".sf-out")!.textContent = why ? "fails" : "passes";
      root.querySelector(`[data-pick="${w}"]`)?.setAttribute("data-result", f.dataset.result);
      if (why) {
        failing.push(w);
        detail = why;
      }
    }
    for (const b of bugs) b.setAttribute("aria-pressed", String(b.dataset.bug === current?.id));
    fix.setAttribute("aria-disabled", String(!current || fixed || failing.length === 0));
    if (!announce) return;
    if (!current) caption.textContent = idle;
    else if (failing.length) caption.textContent = `${current.bug} ${failureText(current, failing, detail)}`;
    else caption.textContent = `${fixed ? current.fix : current.bug} Passes at all four widths.`;
  }

  const offs = bugs.map((b) => {
    const fn = () => {
      const c = CASES.find((x) => x.id === b.dataset.bug)!;
      current = current?.id === c.id ? null : c;
      fixed = false;
      run(true);
    };
    b.addEventListener("click", fn);
    return () => b.removeEventListener("click", fn);
  });
  const onFix = () => {
    if (fix.getAttribute("aria-disabled") === "true") return; // nothing to fix, or already fixed
    fixed = true;
    run(true);
  };
  const onReset = () => {
    current = null;
    fixed = false;
    run(true);
  };
  const pickOffs = picks.map((b) => {
    const fn = () => {
      for (const p of picks) p.setAttribute("aria-pressed", String(p === b));
      root.dataset.show = b.dataset.pick!;
      fit();
    };
    b.addEventListener("click", fn);
    return () => b.removeEventListener("click", fn);
  });
  fix.addEventListener("click", onFix);
  reset.addEventListener("click", onReset);
  // A resize refits and re-checks, but says nothing: the reader didn't do anything.
  const ro = new ResizeObserver(() => {
    fit();
    run(false);
  });
  for (const f of frames) ro.observe(f.querySelector(".sf-view")!);

  fit();
  run(false);
  fix.setAttribute("data-ready", "");
  return () => {
    ro.disconnect();
    offs.forEach((f) => f());
    pickOffs.forEach((f) => f());
    fix.removeEventListener("click", onFix);
    reset.removeEventListener("click", onReset);
  };
}
```

- [ ] **Step 4: Run them to watch them pass**

Run: `npm run build` then `npx playwright test e2e/site-figure.spec.ts --reporter=dot`
Expected: all pass in all four viewports. If a case fails at the wrong widths, fix the frame geometry or CSS in
`SiteFrame.astro` / `world.css`, never the expected widths (they are the spec's).

- [ ] **Step 5: Check the budget**

Run: `npm run test:dist`
Expected: all pass, `projects/leonardonunez-dev.html` within 15,000 bytes.

- [ ] **Step 6:** lint and typecheck clean. Commit:

```bash
git add src/worlds/site/figures/site-view.ts e2e/site-figure.spec.ts
git commit -m "Inject a bug into the site figure, check it with CI's code, fix it"
```

---

### Task 5: Phones and resizing

**Files:**
- Modify: `e2e/site-figure.spec.ts` (and `world.css` only if a test fails)

- [ ] **Step 1: Write the tests**

```ts
test.describe("where it breaks: on phones", () => {
  test.beforeEach(({ viewport }) => test.skip(viewport!.width > 640, "phone layout only"));

  test("shows one frame at a time, picked by width", async ({ page }) => {
    const fig = await open(page);
    const shown = () => page.locator(`${FIG} .sf`).evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity === "1").map((e) => Number((e as HTMLElement).dataset.w)));
    expect(await shown()).toEqual([360]);
    await fig.locator('[data-pick="768"]').click();
    expect(await shown()).toEqual([768]);
    await expect(fig.locator('[data-pick="768"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("the width picker shows each width's result", async ({ page }) => {
    const fig = await open(page);
    await fig.locator('[data-bug="hero"]').click();
    for (const [w, r] of expected([768, 1280])) await expect(fig.locator(`[data-pick="${w}"]`)).toHaveAttribute("data-result", r as string);
  });

  test("the shown frame fits the figure", async ({ page }) => {
    const fig = await open(page);
    for (const w of [360, 1280]) {
      await fig.locator(`[data-pick="${w}"]`).click();
      const f = await fig.locator(`.sf[data-w="${w}"]`).boundingBox();
      const box = await fig.boundingBox();
      expect(f!.x).toBeGreaterThanOrEqual(box!.x);
      expect(f!.x + f!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
    }
  });
});

test("resizing keeps the bug, its results and the caption (Review Focus 3)", async ({ page, viewport }) => {
  const fig = await open(page);
  await fig.locator('[data-bug="hero"]').click();
  const caption = await fig.locator(".fig-caption").textContent();
  await page.setViewportSize(viewport!.width > 640 ? { width: 390, height: 844 } : { width: 1280, height: 800 });
  await expect.poll(() => results(page)).toEqual(expected([768, 1280]));
  await expect(fig).toHaveAttribute("data-case", "hero");
  await expect(fig.locator(".fig-caption")).toHaveText(caption!);
});
```

- [ ] **Step 2: Run them**

Run: `npx playwright test e2e/site-figure.spec.ts --reporter=dot`
Expected: pass on the phone viewports, skips elsewhere for the phone block; the resize test passes everywhere. These
cover behaviour Task 3's CSS and Task 4's view already have, so they may pass first time (as lanes' Task 6 did);
if one fails, fix `world.css` or the view, not the test.

- [ ] **Step 3: Owner review of the figure (GATE)**

Publish screenshots of the figure (desktop, then phones, each case failing and fixed) to the companion and ask
the owner for the figure review. Apply requested changes test-first; ledger each.

- [ ] **Step 4:** Commit:

```bash
git add e2e/site-figure.spec.ts src/worlds/site
git commit -m "Test the site figure on phones and across a resize"
```

---

### Task 6: The article, the cover and the stills

**Files:**
- Create: `src/worlds/site/Cover.astro`, `tests/dist/site.test.ts`, `public/covers/leonardonunez-dev.png`,
  `public/og/leonardonunez-dev.png`
- Modify: `src/content/projects/leonardonunez-dev/index.mdx`, `src/pages/kit.astro`, `scripts/render-covers.mjs`,
  `tests/dist/media.test.ts`

- [ ] **Step 1: Write the failing dist tests**

`tests/dist/site.test.ts`:

```ts
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
      "blob/main/.github/workflows/ci.yml",
      "blob/main/e2e/layout.spec.ts",
      "blob/main/e2e/loading.spec.ts",
      "blob/main/e2e/a11y.spec.ts",
      "blob/main/e2e/visual.spec.ts",
      "blob/main/lighthouserc.json",
      "blob/main/tests/dist/budget.ts",
      "blob/main/public/_headers",
      "tree/main/src/design/checks",
    ]) {
      expect(links.some((h) => h.startsWith(GH + path)), path).toBe(true);
    }
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
```

Append to `tests/dist/media.test.ts`, inside its `describe`:

```ts
  it("ships the leonardonunez.dev cover stills at their sizes", async () => {
    const card = await sharp(join(process.cwd(), "dist/covers/leonardonunez-dev.png")).metadata();
    const og = await sharp(join(process.cwd(), "dist/og/leonardonunez-dev.png")).metadata();
    expect([card.width, card.height, og.width, og.height]).toEqual([1600, 900, 1200, 630]);
  });
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npm run build` then `npx vitest run --config vitest.dist.config.ts tests/dist/site.test.ts tests/dist/media.test.ts --reporter=dot`
Expected: FAIL on headings, links, the table, the og image and the stills.

- [ ] **Step 3: Measure the scripted pages**

Run: `npm run build`, then for `/`, `/about`, `/projects/satisfactory-dash`, `/projects/lanes` and
`/projects/leonardonunez-dev`, compute `pageScriptBytes` (a throwaway script in `$CLAUDE_JOB_DIR/tmp` or a
temporary `it.only` that logs them; delete it after). Round each to one decimal of a KB (1 KB = 1,000 bytes) for the
table below.

- [ ] **Step 4: Check every claim against its source**

Before writing, confirm each of these holds (read the file or PR; cut any that doesn't):
- `ci.yml` runs lint, typecheck, test, build, test:dist, e2e, lighthouse, links, security (PII) and audit jobs;
  CodeQL runs on PRs (GitHub's default setup; check the PR #43 checks list names it).
- `a11y.spec.ts` checks light and dark; `visual.spec.ts` compares screenshots; Lighthouse thresholds are 0.9 for
  performance and accessibility in `lighthouserc.json`.
- #35's commits include the deliberate broken link and its removal.
- #36's commit "Allow 1,500 scattered pixels on full-page screenshots" and the value in `visual.spec.ts`.
- #43's ledger/commit for the smooth-scroll flake ("Task 7: Ruling: the token on top e2e centres the token…" and
  the instant-scroll change in `e2e/lanes-figure.spec.ts`).
- `public/_headers` (a year for `/_astro/*`, pages uncached) and the prerender-on-hover from #37.

- [ ] **Step 5: Write the article**

Replace the body of `index.mdx` (keep the frontmatter; add `ogImage` and `cover`, below) with this, filling the
table from Step 3:

```mdx
import SiteFigure from "../../../worlds/site/figures/SiteFigure.astro";
import Aside from "../../../design/components/Aside.astro";

## The problem

Interested viewers often open a portfolio on a phone, in a spare minute. Much of this site's code is written by
Claude Code sessions, and none of them has ever looked at a phone. So nobody can be relied on to notice a broken
layout: every change has to prove itself at every width before it reaches the live site.

## What every change must pass

Every pull request runs the same gate ([ci.yml](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/blob/main/.github/workflows/ci.yml)), and nothing merges until it is green:

- lint, typecheck, unit tests, and tests on the built pages: meta tags, links, picture sizes and the JavaScript budget;
- Playwright at 360, 390, 768 and 1280 px: every page loads, nothing scrolls sideways
  ([layout](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/blob/main/e2e/layout.spec.ts)), nothing overlaps
  while pictures and animations are still loading
  ([loading](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/blob/main/e2e/loading.spec.ts)), axe finds no
  accessibility problems in light or dark mode
  ([a11y](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/blob/main/e2e/a11y.spec.ts)), and screenshots
  match their baselines ([visual](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/blob/main/e2e/visual.spec.ts));
- Lighthouse on a simulated phone, at 90 or above for performance and accessibility
  ([lighthouserc.json](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/blob/main/lighthouserc.json));
- a link checker, proved by a deliberately broken link before it went live
  ([#35](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/pull/35)); CodeQL; and a check that no personal
  details or local paths are committed.

## Where it breaks

Each frame below is one small page, laid out at a real screen width. Pick a bug to inject: every frame then runs the
check CI runs, from the same code ([src/design/checks](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/tree/main/src/design/checks)),
and shows where it fails. Then fix it.

<SiteFigure />

## What it caught, and what it missed

The gate earns its keep on bugs nobody sees on their own screen. In
[#40](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/pull/40) the satis-manager figures looked right on
my Windows machine, but CI's Linux fonts set a label wider, and on tablets a route crossed "CLOUDFLARE". The check
failed, the route was redrawn to climb clear, and a unit test now keeps the clearance.

It misses things too. A grid meant for the home page's portrait applied to every page header, so on tablets and
desktops the titles of two pages split into two columns. It passed every check, because no check asked where a
title starts. I found it on the live site, and
[#38](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/pull/38) fixed it and added that check, which failed
before the fix.

The figure's other two bugs never shipped: their checks were there first.

## Fast by default

A page runs no JavaScript unless it has an interactive figure, and a page with one gets 15 KB, gzipped
([budget.ts](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/blob/main/tests/dist/budget.ts)). The build
tests fail any page over its budget, and a figure's script loads only when it scrolls into view.

| Page | JavaScript, gzipped |
| --- | --- |
| `/` | 0 KB |
| `/about` | 0 KB |
| `/projects/satisfactory-dash` | X.X KB |
| `/projects/lanes` | X.X KB |
| `/projects/leonardonunez-dev` | X.X KB |

Built files with hashed names are cached for a year and pages not at all, so a deploy shows on the next visit
([_headers](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/blob/main/public/_headers)). In Chrome, a page
starts loading when you hover its link.

## Limits and trade-offs

- **Screenshots are valid from one machine only.** Fonts render differently on Windows, macOS and Linux, so
  baselines come only from Playwright's container on CI. Every intended visual change costs a round trip: run the
  workflow, check its images, commit them.
- **A tolerance is a blind spot.** Full-page screenshots allow 1,500 scattered pixels so that anti-aliasing noise
  doesn't fail them, which means a change that small passes too.
- **Local isn't CI.** A figure can pass on my machine and fail in CI on font widths alone
  ([#40](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/pull/40)). Figures now leave generous clearance.
- **Tests can be wrong too.** The site's smooth scrolling made a test measure a figure mid-scroll, and it failed on
  tablets until it scrolled instantly ([#43](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/pull/43)).
- **It only checks what someone thought of.** The split titles passed everything
  ([#38](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/pull/38)). Checks grow from misses, and my own
  review of each preview is still part of the gate.

<details>
<summary>More detail: how the figure checks a page it scaled down</summary>
<Aside>
- Each frame's page is laid out at its real width and scaled with CSS `zoom`; its breakpoints read its own width
  through container queries, not the window's.
- The checks measure boxes on screen, so they hold at any scale; the title check divides by the zoom.
- The label's width is fixed with `textLength`, so "CI's wider fonts" fails at 768 px on every machine.
</Aside>
</details>

## How it was built

Built with Claude Code sessions, each change reviewed by me on its preview before it merged. All three case studies
share one small figure kit, and the site is open source on
[GitHub](https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio).
```

Frontmatter additions:

```yaml
ogImage: /og/leonardonunez-dev.png
cover:
  src: /covers/leonardonunez-dev.png
```

- [ ] **Step 6: The cover**

`src/worlds/site/Cover.astro`:

```astro
---
// The leonardonunez.dev world's cover: one page at four widths, one failing. CSS only, no script.
// `still` renders the fixed-size version that scripts/render-covers.mjs photographs.
import "./world.css";

interface Props {
  still?: boolean;
}
const { still = false } = Astro.props;
const frames = [
  { w: 360, fail: false },
  { w: 390, fail: false },
  { w: 768, fail: true },
  { w: 1280, fail: false },
];
---

<header class:list={["site-cover", "world-site", { still }]} id={still ? "site-cover-still" : undefined}>
  <div class="site-cover-text">
    <p class="site-kick">Case study · this site</p>
    <p class="site-title">leonardonunez.dev</p>
    <p class="site-sub">Every change proven at four screen widths before it ships.</p>
  </div>
  <div class="site-frames" aria-hidden="true">
    {
      frames.map(({ w, fail }) => (
        <div class:list={["site-frame", { fail }]} style={`--w: ${w}`}>
          <span class="bar" />
          <span class="line" />
          <span class="line short" />
          <span class="w">{w}</span>
        </div>
      ))
    }
  </div>
</header>

<style>
  .site-cover {
    display: grid;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    padding: var(--space-6) var(--space-5);
    border-radius: 12px;
    overflow: hidden;
    background: var(--site-bg);
    color: var(--site-ink);
  }
  .site-cover.still {
    box-sizing: border-box;
    margin: 0;
    align-content: space-between;
  }
  .site-kick {
    margin: 0;
    color: var(--site-dim);
    font: 600 0.8rem/1.2 var(--font-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .site-title {
    margin: 0.3rem 0;
    font: 700 clamp(2rem, 6vw, 3.4rem) / 1 var(--font-serif);
  }
  .site-sub {
    margin: 0;
    max-width: 32ch;
    color: var(--site-dim);
  }
  .site-frames {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
  }
  .site-frame {
    position: relative;
    flex: var(--w) 1 0;
    aspect-ratio: var(--w) / 640;
    max-height: 9rem;
    box-sizing: border-box;
    padding: 6%;
    border-radius: 4px;
    background: var(--site-paper);
    outline: 1px solid #55575f;
  }
  .site-frame.fail {
    outline: 2px solid var(--site-fail);
  }
  .site-frame .bar,
  .site-frame .line {
    display: block;
    height: 6%;
    margin-bottom: 6%;
    border-radius: 2px;
    background: #c9c4b8;
  }
  .site-frame .bar {
    background: #5c7d8a;
    height: 18%;
  }
  .site-frame .short {
    width: 60%;
  }
  .site-frame .w {
    position: absolute;
    right: 6%;
    bottom: 4%;
    color: var(--site-muted);
    font: 600 0.7rem var(--font-sans);
  }
  .site-frame.fail .w {
    color: var(--site-fail);
  }
</style>
```

In `src/pages/kit.astro`, import `SiteFigure` and `SiteCover from "../worlds/site/Cover.astro"`, and add after the
lanes section:

```astro
    <section class="kit-writing page reveal world-site">
      <div class="section-head"><p class="kicker">World · leonardonunez.dev</p><h2>Figure</h2></div>
      <div class="kit-still"><SiteCover still /></div>
      <SiteFigure />
    </section>
```

In `scripts/render-covers.mjs`, add `{ id: "site-cover-still", name: "leonardonunez-dev" }` to `covers`.

- [ ] **Step 7: Render the stills, build and test**

Run: `npm run build`, start `npm run preview` (background), `npm run render:covers`, stop the preview, then
`npm run build` and `npm run test:dist`.
Expected: all pass. If `kit.html` is over 15,000 bytes, ledger a ruling raising `kit.html` to the measured size
rounded up to the next 5,000 (the kit isn't a reader's page; it shows every figure at once) — cost if wrong: the
kit's budget stops catching growth below the new number.

- [ ] **Step 8: Full suite**

Run: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:dist`, `npx playwright test --reporter=dot`.
Expected: all pass (screenshot tests skip locally).

- [ ] **Step 9:** Commit:

```bash
git add src/content/projects/leonardonunez-dev src/worlds/site/Cover.astro src/pages/kit.astro scripts/render-covers.mjs tests/dist/site.test.ts tests/dist/media.test.ts public/covers/leonardonunez-dev.png public/og/leonardonunez-dev.png
git commit -m "Write the leonardonunez.dev case study, with its cover and stills"
```

---

### Task 7: Owner rounds: the draft, the palette, the sidenotes

- [ ] **Step 1:** Open a draft PR from `design/site-world` (body: what changed, the rulings, the checks). Ask the
  owner for the ~10-minute draft read on the preview deploy, and any sidenotes.
- [ ] **Step 2:** Prepare three palettes for the world (companion page), distinct from satis's amber and lanes'
  teal, each with the roles pass, fail and the failure outline; the owner picks one. Swap the `--site-*` tokens and
  re-render the stills (`npm run render:covers`).
- [ ] **Step 3:** Apply the owner's draft changes; re-check every changed claim against its source; keep the dist
  tests green. Commit each round separately.

---

### Task 8: Baselines, review and ready

- [ ] **Step 1:** Push, run the "Update screenshots" workflow on the branch, download its `screenshots` artifact,
  check the images, copy only the four viewport folders into `e2e/__screenshots__/`, and commit them.
- [ ] **Step 2:** Final whole-branch review by a fresh reviewer (most capable model) with this plan, the spec and
  the ledger's rulings. Fix Critical and Important findings test-first; ledger minors as deferred.
- [ ] **Step 3:** CI green (`gh pr checks --watch`); mark the PR ready with the rulings and deferred minors in its
  body. The owner merges.
