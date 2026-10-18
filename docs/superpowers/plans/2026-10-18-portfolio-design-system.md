# Portfolio Design System Implementation Plan (Plan 3 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site its Editorial identity (Fraunces headlines, Public Sans body, paper and vermilion, light and dark), the shared components a project world builds on (work cards, prose, asides, callouts, sticky-note sidenotes, figures), a motion kit, an About page and a kit page, while still shipping no JavaScript.

**Architecture:** Design decisions live in CSS custom properties (`src/design/tokens.css`) and a few CSS files by concern, imported once by `Shell.astro`. Fonts are files in `public/fonts/`, preloaded and declared with `font-display: optional`. Everything interactive is CSS-only: hover colour on work cards, a checkbox-driven sidenote toggle on phones, a load-time reveal, and cross-document view transitions (`@view-transition`). New components are `.astro` files under `src/design/components/`; the existing React components are restyled, not rewritten.

**Tech Stack:** Astro 7.4, CSS (custom properties, `clamp()`, `@view-transition`, `@media (hover)`), Fontsource 5.3.0 font files, Playwright 1.64 and Vitest (existing).

**Spec:** `docs/superpowers/specs/2026-10-17-portfolio-overhaul-design.md`, Sections 3 and 4, including "Font round, decided 2026-10-18".

## Global Constraints

- Fonts: Fraunces (headlines; variable with `SOFT` 50 and `WONK` 1), Public Sans (body; variable), Gochi Hand (sidenotes only). Self-hosted from `public/fonts/`, `font-display: optional`, Fraunces and Public Sans regular preloaded. No request to any font CDN.
- Palette (light / dark): paper `#f3efe6` / `#17150f`; raised `#faf7f0` / `#211e17`; ink `#141414` / `#f3efe6`; ink-soft `#26241f` / `#ddd6c8`; muted `#5c574f` / `#a59d8f`; accent `#b83a14` / `#f2794a`; rule `#141414` / `#f3efe6`; rule-soft `#d8d1c2` / `#3a352b`; sticky `#ffe066` with ink `#141414` in both themes.
- No JavaScript shipped (the existing "ships no JavaScript" dist tests stay). Motion is CSS only.
- Anti-AI rules (spec Section 3): no gradients, glass, blobs or card shadows; no icon on every bullet; hairline rules instead of boxes.
- Copy is unchanged in this plan (the hero, about and project text stay as they are); new copy comes with Plan 4.
- Every page passes the Plan 2 gates at all four widths, in light **and dark** mode: no overflow, no overlaps, axe clean, reduced motion, JS budget, Lighthouse ≥ 90.
- **Ruling (deviation from spec):** on touch devices (`hover: none`) the work-card still is shown in colour, instead of colouring on scroll with a scroll-driven animation. Scroll-driven animations can't be frozen by the loading-state tests, and the effect needs a real device to judge; revisit in Plan 4 if wanted.
- **Ruling:** "Reveal" is a load-time staggered fade-and-rise, not scroll-triggered, for the same testability reason. `ScrollFigure` and the Motion library arrive with the first animated figure in Plan 4 (YAGNI).
- **Ruling:** typographic quotes are turned on (`markdown.smartypants` removed, so Astro's default applies); this also clears Astro 7's deprecation warning.
- No PII or local paths in committed files.

## Review Focus

1. **A late font reflowing the page** (the font version of pop-in): pinned by Task 1's font-hold test.
2. **Dark mode contrast and legibility**, never tested before: pinned by Task 1 (axe in dark) and Task 8 (dark screenshots).
3. **A sidenote overlapping the article text** at a desktop width, or being unreachable on a phone: pinned by Task 5's placement and toggle tests and the overlap selector.
4. **A work card's colour change only working with a mouse** (keyboard users get nothing): pinned by Task 4's focus test.
5. **Flaky screenshots from `font-display: optional`** if a font misses its 100 ms window in CI: pinned by Task 8's warm-up visit before each screenshot.

---

### Task 1: Fonts, tokens, base styles and dark mode

**Files:**
- Create: `public/fonts/fraunces-latin-full-normal.woff2`, `public/fonts/public-sans-latin-wght-normal.woff2`, `public/fonts/public-sans-latin-wght-italic.woff2`, `public/fonts/gochi-hand-latin-400-normal.woff2`, `public/fonts/LICENSE-fraunces.txt`, `public/fonts/LICENSE-public-sans.txt`, `public/fonts/LICENSE-gochi-hand.txt`, `src/design/fonts.css`, `src/design/tokens.css`, `src/design/base.css`, `tests/dist/fonts.test.ts`, `e2e/fonts.spec.ts`
- Modify: `src/layouts/Shell.astro`, `src/pages/404.astro`, `astro.config.ts`, `e2e/a11y.spec.ts`, `tests/dist/case-study.test.ts`, `tests/dist/helpers.ts` (`builtCss()`)
- Delete: `src/index.css`

**Interfaces:**
- Produces: CSS custom properties `--paper --raised --ink --ink-soft --muted --accent --rule --rule-soft --sticky --sticky-ink`, `--font-display --font-text --font-note`, type steps `--step--1` … `--step-4`, `--space-1` … `--space-8`, `--measure --page --gutter`, motion `--dur-fast --dur --dur-slow --ease-out --ease-in-out`; `Shell.astro` prop `noindex?: boolean`.

- [ ] **Step 1: Add the font files and licences**

```bash
mkdir -p public/fonts
B=https://cdn.jsdelivr.net/npm
curl -sfo public/fonts/fraunces-latin-full-normal.woff2 $B/@fontsource-variable/fraunces@5.3.0/files/fraunces-latin-full-normal.woff2
curl -sfo public/fonts/public-sans-latin-wght-normal.woff2 $B/@fontsource-variable/public-sans@5.3.0/files/public-sans-latin-wght-normal.woff2
curl -sfo public/fonts/public-sans-latin-wght-italic.woff2 $B/@fontsource-variable/public-sans@5.3.0/files/public-sans-latin-wght-italic.woff2
curl -sfo public/fonts/gochi-hand-latin-400-normal.woff2 $B/@fontsource/gochi-hand@5.3.0/files/gochi-hand-latin-400-normal.woff2
curl -sfo public/fonts/LICENSE-fraunces.txt $B/@fontsource-variable/fraunces@5.3.0/LICENSE
curl -sfo public/fonts/LICENSE-public-sans.txt $B/@fontsource-variable/public-sans@5.3.0/LICENSE
curl -sfo public/fonts/LICENSE-gochi-hand.txt $B/@fontsource/gochi-hand@5.3.0/LICENSE
ls -l public/fonts
```
Expected: seven files; the woff2 sizes are 121016, 26832, 28292 and 19908 bytes.

- [ ] **Step 2: Write the failing tests**

Add to `tests/dist/helpers.ts` (Astro inlines stylesheets under 4 kB as `<style>` tags, so CSS has to be read from both places):
```ts
import { readdirSync } from "node:fs";

/** All CSS the build ships: stylesheet files plus <style> blocks inlined into pages. */
export function builtCss(): string {
  const astroDir = join(DIST, "_astro");
  const files = existsSync(astroDir)
    ? readdirSync(astroDir).filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(astroDir, f), "utf-8"))
    : [];
  const inline = readdirSync(DIST, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".html"))
    .flatMap((f) => page(f.replace(/\\/g, "/")).querySelectorAll("style").map((s) => s.text));
  return [...files, ...inline].join("\n");
}
```
(merge the `readdirSync` import into the existing `node:fs` import).

Create `tests/dist/fonts.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { builtCss, distFileExists, page } from "./helpers";

const css = builtCss();

describe("fonts", () => {
  it("are self-hosted, with no font CDN anywhere", () => {
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com|jsdelivr|unpkg/);
    for (const file of [
      "fonts/fraunces-latin-full-normal.woff2",
      "fonts/public-sans-latin-wght-normal.woff2",
      "fonts/gochi-hand-latin-400-normal.woff2",
    ]) {
      expect(distFileExists(file), file).toBe(true);
    }
  });

  it("never swap in late (font-display: optional on every face)", () => {
    // Inlined CSS repeats per page, so count distinct faces.
    const faces = [...new Set(css.match(/@font-face\s*{[^}]*}/g) ?? [])];
    expect(faces.length).toBe(4);
    for (const face of faces) expect(face).toMatch(/font-display:\s*optional/);
  });

  it("preloads the two faces every page uses", () => {
    const preloads = page("index.html")
      .querySelectorAll('link[rel="preload"][as="font"]')
      .map((l) => l.getAttribute("href"));
    expect(preloads.sort()).toEqual([
      "/fonts/fraunces-latin-full-normal.woff2",
      "/fonts/public-sans-latin-wght-normal.woff2",
    ]);
  });
});

describe("the 404 page", () => {
  it("asks search engines not to index it", () => {
    expect(page("404.html").querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
  });
});
```

Create `e2e/fonts.spec.ts`:
```ts
import { expect, test, type Route } from "@playwright/test";
import { PAGES } from "./pages";

// font-display: optional means a font that arrives late is not swapped in, so
// holding the fonts back must not change the layout once they are released.
for (const { name, path } of PAGES.filter((p) => p.status === 200)) {
  test(`${name}: a late font doesn't reflow the page`, async ({ page }) => {
    const held: Route[] = [];
    let released = false;
    await page.route("**/fonts/*.woff2", (route) => (released ? route.continue() : void held.push(route)));
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const before = await page.evaluate(() => document.querySelector("main")!.getBoundingClientRect().height);
    released = true;
    await Promise.all(held.splice(0).map((r) => r.continue()));
    await page.waitForLoadState("networkidle");
    const after = await page.evaluate(() => document.querySelector("main")!.getBoundingClientRect().height);
    expect(after).toBeCloseTo(before, 0);
  });
}
```

In `e2e/a11y.spec.ts`, wrap the axe test in a loop over colour schemes so it runs in light and dark:
```ts
for (const colorScheme of ["light", "dark"] as const) {
  test(`${name} has no serious or critical accessibility violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
    await page.goto(path, { waitUntil: "networkidle" });
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}
```

In `tests/dist/case-study.test.ts`, change the expected headings `"How it's built"` and `"What's next"` to `"How it’s built"` and `"What’s next"` (typographic apostrophes).

Run: `npm run build && npx vitest run tests/dist/fonts.test.ts tests/dist/case-study.test.ts --config vitest.dist.config.ts --reporter=dot`
Expected: FAIL (no `@font-face`, no preloads, no robots meta, straight apostrophes).

- [ ] **Step 3: Write fonts.css**

Create `src/design/fonts.css`:
```css
/* Self-hosted (public/fonts, OFL; from Fontsource 5.3.0). font-display: optional:
   a font that misses the first ~100 ms is not swapped in, so text never reflows. */
@font-face {
  font-family: "Fraunces";
  src: url("/fonts/fraunces-latin-full-normal.woff2") format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: optional;
}
@font-face {
  font-family: "Public Sans";
  src: url("/fonts/public-sans-latin-wght-normal.woff2") format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: optional;
}
@font-face {
  font-family: "Public Sans";
  src: url("/fonts/public-sans-latin-wght-italic.woff2") format("woff2-variations");
  font-weight: 100 900;
  font-style: italic;
  font-display: optional;
}
@font-face {
  font-family: "Gochi Hand";
  src: url("/fonts/gochi-hand-latin-400-normal.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: optional;
}
```

- [ ] **Step 4: Write tokens.css**

Create `src/design/tokens.css`:
```css
:root {
  color-scheme: light dark;

  --paper: #f3efe6;
  --raised: #faf7f0;
  --ink: #141414;
  --ink-soft: #26241f;
  --muted: #5c574f;
  --accent: #b83a14;
  --rule: #141414;
  --rule-soft: #d8d1c2;
  --sticky: #ffe066;
  --sticky-ink: #141414;

  --font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --font-text: "Public Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-note: "Gochi Hand", "Comic Sans MS", cursive;
  --display-axes: "SOFT" 50, "WONK" 1;

  /* Fluid type: 360 px phones to 1280 px desktops. */
  --step--1: clamp(0.83rem, 0.8rem + 0.15vw, 0.9rem);
  --step-0: clamp(1.0625rem, 1rem + 0.3vw, 1.125rem);
  --step-1: clamp(1.3rem, 1.2rem + 0.5vw, 1.5rem);
  --step-2: clamp(1.7rem, 1.4rem + 1.4vw, 2.4rem);
  --step-3: clamp(2.3rem, 1.6rem + 3.4vw, 4.25rem);
  --step-4: clamp(2.9rem, 1.5rem + 6.6vw, 7rem);

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2.5rem;
  --space-7: 4rem;
  --space-8: 6.5rem;

  --measure: 64ch;
  --page: 76rem;
  --gutter: clamp(1rem, 4vw, 2.5rem);

  --dur-fast: 150ms;
  --dur: 250ms;
  --dur-slow: 600ms;
  --ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #17150f;
    --raised: #211e17;
    --ink: #f3efe6;
    --ink-soft: #ddd6c8;
    --muted: #a59d8f;
    --accent: #f2794a;
    --rule: #f3efe6;
    --rule-soft: #3a352b;
  }
}

/* No motion for people who ask for less of it. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-fast: 0ms;
    --dur: 0ms;
    --dur-slow: 0ms;
  }
}
```

- [ ] **Step 5: Write base.css**

Create `src/design/base.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink-soft);
  font-family: var(--font-text);
  font-size: var(--step-0);
  line-height: 1.6;
  text-rendering: optimizeLegibility;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-variation-settings: var(--display-axes);
  font-weight: 500;
  color: var(--ink);
  line-height: 1.02;
  letter-spacing: -0.015em;
  margin: 0 0 var(--space-4);
  text-wrap: balance;
}
h1 {
  font-size: var(--step-4);
}
h2 {
  font-size: var(--step-3);
}
h3 {
  font-size: var(--step-1);
  line-height: 1.15;
}

p,
ul,
ol {
  margin: 0 0 var(--space-4);
}
p {
  text-wrap: pretty;
}

a {
  color: var(--accent);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
  transition: text-decoration-thickness var(--dur-fast) var(--ease-out);
}
a:hover {
  text-decoration-thickness: 2px;
}
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

img,
video {
  display: block;
  max-width: 100%;
  height: auto;
}

code {
  font-family: ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: var(--raised);
  padding: 0.1em 0.3em;
}

hr,
.rule {
  border: 0;
  border-top: 1px solid var(--rule);
  margin: var(--space-6) 0;
}

.kicker {
  font-family: var(--font-text);
  font-size: var(--step--1);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.page {
  max-width: var(--page);
  margin: 0 auto;
  padding: 0 var(--gutter);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 6: Wire it into Shell, the 404 page and the config**

`src/layouts/Shell.astro`: replace `import "../index.css";` with
```astro
import "../design/fonts.css";
import "../design/tokens.css";
import "../design/base.css";
```
add `noindex?: boolean;` to `Props`, destructure it, and in `<head>` after the viewport meta add:
```astro
<link rel="preload" href="/fonts/fraunces-latin-full-normal.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
{noindex && <meta name="robots" content="noindex" />}
```
`src/pages/404.astro`: pass `noindex` to `<Shell>`.
`astro.config.ts`: delete the `markdown: { smartypants: false }` line and its two comment lines.
Delete `src/index.css` (`git rm src/index.css`).

- [ ] **Step 7: Run and commit**

Run: `npm run build && npm run test:dist && npx playwright test e2e/fonts.spec.ts e2e/a11y.spec.ts --reporter=line`
Expected: all PASS. If axe reports contrast in dark mode, fix the token (the measured values above all pass; a failure means a hard-coded colour somewhere). Unstyled components are expected until Task 2.

```bash
git add public/fonts src/design src/layouts/Shell.astro src/pages/404.astro astro.config.ts tests/dist/fonts.test.ts tests/dist/case-study.test.ts e2e/fonts.spec.ts e2e/a11y.spec.ts
git rm -q src/index.css
git commit -m "Add the Editorial tokens, self-hosted fonts and dark mode"
```

---

### Task 2: The Editorial shell and home page

**Files:**
- Create: `src/design/shell.css`
- Modify: `src/components/Header.tsx`, `src/components/Header.test.tsx`, `src/components/Hero.tsx`, `src/components/Projects.tsx`, `src/components/Contact.tsx`, `src/components/Footer.tsx`, `src/pages/index.astro`, `src/layouts/Shell.astro` (import), `tests/dist/home.test.ts`

**Interfaces:**
- Consumes: tokens (Task 1).
- Produces: nav links Work `/#work`, About `/about`, Contact `/#contact`; home anchors `top`, `work`, `contact`; class `.site-header .site-nav .site-footer .hero .hero-lede .hero-links .section .section-head`.

- [ ] **Step 1: Update the tests first**

`src/components/Header.test.tsx`, replace the first test:
```tsx
it("links to the work and contact sections from any page, and to the About page", () => {
  render(<Header />);
  expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("href", "/#work");
  expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/#contact");
});
```
`tests/dist/home.test.ts`: change the anchors test's list to `["top", "work", "contact"]`.

Run: `npx vitest run src/components/Header.test.tsx --reporter=dot`
Expected: FAIL (the header still links About/Projects/Skills to `/#…`).

- [ ] **Step 2: Restyle the components**

`src/components/Header.tsx`:
```tsx
const NAV = [
  { label: "Work", href: "/#work" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/#contact" },
];

export function Header() {
  return (
    <header className="site-header page">
      <a className="brand" href="/#top">
        Leonardo Nunez
      </a>
      <nav className="site-nav" aria-label="Main">
        {NAV.map(({ label, href }) => (
          <a key={label} href={href}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
```

`src/components/Hero.tsx` (copy unchanged):
```tsx
export function Hero() {
  return (
    <section id="top" className="hero page reveal">
      <p className="kicker">Full-stack developer</p>
      <h1>Leonardo Nunez</h1>
      <p className="hero-lede">
        Full-stack developer with a background in electrical &amp; computer
        engineering from Rice University. I build web applications with the same
        rigor I bring to embedded systems and infrastructure — real tests, real
        deployment, no shortcuts.
      </p>
      <p className="hero-links">
        <a href="#work">See the work ↓</a>
        <a href="#contact">Get in touch →</a>
      </p>
    </section>
  );
}
```

`src/components/Projects.tsx`: change the section to `<section id="work" className="section page reveal">`, the heading to `<div className="section-head"><p className="kicker">Selected work</p><h2>Work</h2></div>`, and the grid class to `work-list`.

`src/components/Contact.tsx`: change the section to `<section id="contact" className="section page reveal">` and wrap its heading as `<div className="section-head"><p className="kicker">Say hello</p><h2>Contact</h2></div>`; keep the list and copy.

`src/components/Footer.tsx`: change to `<footer className="site-footer page">`; keep the content.

`src/pages/index.astro`: remove `About` and `Skills` (they move to `/about` in Task 3) so `<main>` holds `<Hero /> <Projects projects={projects} /> <Contact />`.

- [ ] **Step 3: Write shell.css and import it**

Create `src/design/shell.css`:
```css
.site-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--rule);
}
.brand {
  font-family: var(--font-display);
  font-variation-settings: var(--display-axes);
  font-size: var(--step-1);
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
}
.site-nav {
  display: flex;
  gap: var(--space-5);
  font-size: var(--step--1);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.site-nav a {
  color: var(--ink);
  text-decoration: none;
  padding: var(--space-2) 0;
}
.site-nav a:hover {
  color: var(--accent);
}

.hero {
  padding-top: var(--space-8);
  padding-bottom: var(--space-7);
}
.hero h1 {
  margin-top: var(--space-3);
  max-width: 12ch;
}
.hero-lede {
  font-size: var(--step-1);
  line-height: 1.45;
  max-width: 34ch;
  color: var(--ink-soft);
}
.hero-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  margin-top: var(--space-6);
  font-weight: 600;
}

.section {
  padding-top: var(--space-7);
  padding-bottom: var(--space-7);
  border-top: 1px solid var(--rule);
}
.section-head {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}
.section-head h2 {
  margin: 0;
}

.contact-list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: var(--space-3);
  font-size: var(--step-1);
}

.site-footer {
  padding-top: var(--space-5);
  padding-bottom: var(--space-6);
  border-top: 1px solid var(--rule);
  font-size: var(--step--1);
  color: var(--muted);
}

/* Desktop: the asymmetric grid. Headings sit in a narrow left column. */
@media (min-width: 64rem) {
  .section {
    display: grid;
    grid-template-columns: 4fr 8fr;
    gap: var(--space-6);
  }
  .section-head {
    position: sticky;
    top: var(--space-5);
    align-self: start;
  }
}
```
Import it in `Shell.astro` after `base.css`.

- [ ] **Step 4: Run and commit**

Run: `npx vitest run --reporter=dot && npm run build && npm run test:dist && npx playwright test --reporter=line`
Expected: all PASS (visual tests skipped locally). Open `npm run preview` at 390 and 1280 px: the hero name is huge in Fraunces, sections are separated by hairlines, headings sit left of their content on desktop.

```bash
git add src/design/shell.css src/components src/pages/index.astro src/layouts/Shell.astro tests/dist/home.test.ts
git commit -m "Build the Editorial shell and home page"
```

---

### Task 3: The About page

**Files:**
- Create: `src/pages/about.astro`, `tests/dist/about.test.ts`
- Modify: `src/components/About.tsx`, `src/components/Skills.tsx`, `e2e/pages.ts`, `lighthouserc.json`

**Interfaces:**
- Consumes: Shell, shell.css.
- Produces: route `/about`; `PAGES` entry `{ name: "about", path: "/about", status: 200 }`.

- [ ] **Step 1: Write the failing test**

Create `tests/dist/about.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SITE, metaContent, page } from "./helpers";

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
    expect(doc.querySelectorAll("script")).toHaveLength(0);
  });
});
```
Run: `npm run build && npx vitest run tests/dist/about.test.ts --config vitest.dist.config.ts --reporter=dot`
Expected: FAIL ("dist/about.html doesn't exist").

- [ ] **Step 2: Build the page**

`src/components/About.tsx`: change the root to `<section className="section page reveal">` with `<div className="section-head"><p className="kicker">Background</p><h2>Where I come from</h2></div>` and the three paragraphs unchanged inside `<div className="about-content">`.
`src/components/Skills.tsx`: change the root to `<section className="section page reveal">` with `<div className="section-head"><p className="kicker">Toolbox</p><h2>Skills</h2></div>`; keep `skills-grid`, `skill-group` and the data.

Create `src/pages/about.astro`:
```astro
---
import Shell from "../layouts/Shell.astro";
import { About } from "../components/About";
import { Skills } from "../components/Skills";
---

<Shell
  title="About | Leonardo Nunez"
  description="Background, education and skills: electrical and computer engineering at Rice, now full-stack web."
  path="/about"
>
  <main>
    <header class="hero page reveal">
      <p class="kicker">Leonardo Nunez</p>
      <h1>About</h1>
    </header>
    <About />
    <Skills />
  </main>
</Shell>
```
Append to `src/design/shell.css`:
```css
.skills-grid {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}
.skill-group ul {
  list-style: none;
  padding: 0;
  border-top: 1px solid var(--rule-soft);
}
.skill-group li {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--rule-soft);
}
```
Add `{ name: "about", path: "/about", status: 200 }` to `e2e/pages.ts` and `"http://127.0.0.1:4321/about"` to `lighthouserc.json`'s `url` list.

- [ ] **Step 3: Run and commit**

Run: `npm run build && npm run test:dist && npx playwright test --reporter=line`
Expected: all PASS, including `coverage.test.ts` (the new page is listed).

```bash
git add src/pages/about.astro src/components/About.tsx src/components/Skills.tsx src/design/shell.css tests/dist/about.test.ts e2e/pages.ts lighthouserc.json
git commit -m "Move background and skills to an About page"
```

---

### Task 4: Work cards that colour on hover and focus

**Files:**
- Create: `src/design/work.css`, `e2e/work.spec.ts`
- Modify: `src/components/ProjectCard.tsx`, `src/components/ProjectCard.test.tsx`, `src/layouts/Shell.astro` (import)

**Interfaces:**
- Consumes: `Project` (`ogImage` is the still until Plan 4 adds world covers).
- Produces: classes `.work-card .work-card-still .work-card-body`; a card with no image gets `.work-card-type` (typographic still).

- [ ] **Step 1: Write the failing tests**

Add to `src/components/ProjectCard.test.tsx`:
```tsx
it("shows the project's still when it has one, with empty alt text (decorative)", () => {
  const { container } = renderCard({ ...baseProject, ogImage: "/demo/poster.png" });
  const img = container.querySelector(".work-card-still img");
  expect(img).toHaveAttribute("src", "/demo/poster.png");
  expect(img).toHaveAttribute("alt", "");
  expect(img).toHaveAttribute("width");
});

it("falls back to a typographic still without an image", () => {
  const { container } = renderCard(baseProject);
  expect(container.querySelector(".work-card-type")?.textContent).toBe("Test Project");
});
```
Create `e2e/work.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

const still = ".work-card:has(.work-card-still img) .work-card-still img";
const filter = (page: import("@playwright/test").Page) =>
  page.locator(still).first().evaluate((el) => getComputedStyle(el).filter);

test.use({ reducedMotion: "reduce" }); // no transition: the end state is immediate

test("a work card's still is grayscale until hovered", async ({ page }) => {
  await page.goto("/");
  expect(await filter(page)).toBe("grayscale(1)");
  await page.locator(".work-card").first().hover();
  expect(await filter(page)).toBe("none");
});

test("keyboard focus colours it too", async ({ page }) => {
  await page.goto("/");
  await page.locator(".work-card a").first().focus();
  expect(await filter(page)).toBe("none");
});
```
Run: `npx vitest run src/components/ProjectCard.test.tsx --reporter=dot` and `npm run build && npx playwright test e2e/work.spec.ts --project=desktop-1280 --reporter=line`
Expected: FAIL (no still, no `.work-card`).

- [ ] **Step 2: Restyle the card**

`src/components/ProjectCard.tsx`:
```tsx
import type { Project } from "../lib/projects";
import { StackList } from "./StackList";
import { ProjectLinks } from "./ProjectLinks";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const isCompact = project.emphasis === "secondary";
  const classes = ["work-card", "project-card", isCompact && "project-card-compact"].filter(Boolean).join(" ");

  return (
    <article className={classes}>
      <div className="work-card-still" aria-hidden="true">
        {project.ogImage ? (
          <img src={project.ogImage} alt="" width={1200} height={630} decoding="async" />
        ) : (
          <span className="work-card-type">{project.name}</span>
        )}
      </div>
      <div className="work-card-body">
        <div className="project-card-header">
          <h3>{project.name}</h3>
          {project.status === "in-progress" && <span className="badge">In progress</span>}
        </div>
        <p>{project.description}</p>
        <StackList stack={project.stack} />
        <ProjectLinks project={project} showCaseStudyLink />
      </div>
    </article>
  );
}
```

Create `src/design/work.css`:
```css
.work-list {
  display: grid;
  gap: 0;
  border-top: 1px solid var(--rule);
}
.work-card {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6) 0;
  border-bottom: 1px solid var(--rule);
}
.work-card-still {
  aspect-ratio: 1200 / 630;
  overflow: hidden;
  background: var(--raised);
  border: 1px solid var(--rule-soft);
}
.work-card-still img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1);
  transition: filter var(--dur-fast) var(--ease-out);
}
.work-card:hover .work-card-still img,
.work-card:focus-within .work-card-still img {
  filter: none;
}
/* Touch screens can't hover: show the colour (see the plan's ruling). */
@media (hover: none) {
  .work-card-still img {
    filter: none;
  }
}
.work-card-type {
  display: grid;
  place-items: center;
  height: 100%;
  padding: var(--space-4);
  font-family: var(--font-display);
  font-variation-settings: var(--display-axes);
  font-size: var(--step-3);
  color: var(--muted);
  text-align: center;
}
.project-card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-3);
}
.project-card-header h3 {
  margin: 0;
  font-size: var(--step-2);
}
.badge {
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--accent);
  border: 1px solid currentColor;
  padding: 0 var(--space-2);
}
.stack-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  font-size: var(--step--1);
  color: var(--muted);
}
.project-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  font-weight: 600;
}
.project-card-compact .work-card-still {
  display: none;
}
@media (min-width: 48rem) {
  .work-card {
    grid-template-columns: 5fr 7fr;
    align-items: start;
  }
  .project-card-compact {
    grid-template-columns: 1fr;
  }
}
```
Import `work.css` in `Shell.astro`.

- [ ] **Step 3: Run and commit**

Run: `npx vitest run --reporter=dot && npm run build && npm run test:dist && npx playwright test --reporter=line`
Expected: all PASS, including `media.test.ts` (the still has width and height) and the loading tests (the still is not lazy-loaded, so `holdMedia` sees its request and it must keep its size while held).

```bash
git add src/design/work.css src/components/ProjectCard.tsx src/components/ProjectCard.test.tsx src/layouts/Shell.astro e2e/work.spec.ts
git commit -m "Add work cards whose stills colour on hover and focus"
```

---

### Task 5: Prose, asides, callouts, figures and sticky-note sidenotes

**Files:**
- Create: `src/design/prose.css`, `src/design/components/Aside.astro`, `src/design/components/Callout.astro`, `src/design/components/Figure.astro`, `src/design/components/Sidenote.astro`, `src/layouts/CaseStudy.astro`, `e2e/sidenote.spec.ts`
- Modify: `src/pages/projects/[slug].astro`, `src/layouts/Shell.astro` (import), `e2e/loading.ts` (overlap selector)

**Interfaces:**
- Produces:
  - `<Sidenote id="unique-id" lead="don't do what I did">text</Sidenote>`
  - `<Aside title="…">…</Aside>`, `<Callout kind="note" | "warning">…</Callout>`, `<Figure caption="…">…</Figure>`
  - `CaseStudy.astro` props `{ project: Project; slug: string }`, default slot = article body.
  - Class `.prose` for long-form text; `.sidenote-note` added to the overlap selector.

- [ ] **Step 1: Write the failing tests**

Create `e2e/sidenote.spec.ts`. The kit page (Task 7) is where sidenotes first appear, so this spec targets `/kit` and is written now but expected to fail until Task 7:
```ts
import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("on a wide screen the sidenote sits in the margin, beside its paragraph", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1280", "margin layout is desktop only");
  await page.goto("/kit");
  const note = page.locator(".sidenote-note").first();
  await expect(note).toBeVisible();
  const prose = await page.locator(".prose").first().boundingBox();
  const box = await note.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(prose!.x + prose!.width - 1);
  expect(box!.x - (prose!.x + prose!.width)).toBeLessThanOrEqual(48); // close to the text
});

test("on a phone the sidenote hides behind a psst toggle that opens it", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("phone"), "toggle is for narrow screens");
  await page.goto("/kit");
  const note = page.locator(".sidenote-note").first();
  await expect(note).toBeHidden();
  await page.getByText("psst", { exact: true }).first().click();
  await expect(note).toBeVisible();
});
```
In `e2e/loading.ts`, add `.sidenote-note` to `CONTENT`:
```ts
const CONTENT = "h1, h2, h3, p, li, img, video, figure, pre, table, .button, .project-card, .sidenote-note";
```

- [ ] **Step 2: Write the components**

`src/design/components/Sidenote.astro`:
```astro
---
// A playful aside in the author's own voice (spec Section 3). Desktop: a sticky
// note in the margin beside the paragraph. Narrow screens: a "psst" toggle.
// CSS only: the checkbox drives the toggle, so no JavaScript ships.
interface Props {
  id: string;
  lead?: string;
}
const { id, lead } = Astro.props;
---

<span class="sidenote">
  <label for={`sn-${id}`} class="sidenote-toggle">psst</label>
  <input type="checkbox" id={`sn-${id}`} class="sidenote-checkbox visually-hidden" />
  <span class="sidenote-note" role="note">
    {lead && <span class="sidenote-lead">↙ {lead}</span>}
    <slot />
  </span>
</span>
```
`src/design/components/Aside.astro`:
```astro
---
interface Props {
  title?: string;
}
const { title } = Astro.props;
---

<aside class="aside">
  {title && <p class="kicker">{title}</p>}
  <slot />
</aside>
```
`src/design/components/Callout.astro`:
```astro
---
interface Props {
  kind?: "note" | "warning";
}
const { kind = "note" } = Astro.props;
---

<div class={`callout callout-${kind}`} role="note">
  <p class="kicker">{kind === "warning" ? "Watch out" : "Note"}</p>
  <slot />
</div>
```
`src/design/components/Figure.astro`:
```astro
---
interface Props {
  caption: string;
}
const { caption } = Astro.props;
---

<figure class="figure">
  <slot />
  <figcaption>{caption}</figcaption>
</figure>
```

`src/layouts/CaseStudy.astro`:
```astro
---
import Shell from "./Shell.astro";
import { StackList } from "../components/StackList";
import { ProjectLinks } from "../components/ProjectLinks";
import type { Project } from "../lib/projects";

interface Props {
  project: Project;
  slug: string;
}
const { project, slug } = Astro.props;
---

<Shell
  title={`${project.name} — Case Study | Leonardo Nunez`}
  description={project.summary}
  path={`/projects/${slug}`}
  image={project.ogImage}
>
  <main>
    <article class="case-study page">
      <header class="case-study-head reveal">
        <p class="case-study-back"><a href="/">← Back to all projects</a></p>
        <p class="kicker">Case study</p>
        <h1>{project.name}</h1>
        <StackList stack={project.stack} />
        <ProjectLinks project={project} />
      </header>
      <div class="case-study-body prose reveal"><slot /></div>
    </article>
  </main>
</Shell>
```
`src/pages/projects/[slug].astro`: keep `getStaticPaths` and `render`; replace the markup with
```astro
<CaseStudy project={project} slug={entry.id}><Content /></CaseStudy>
```
(import `CaseStudy` from `../../layouts/CaseStudy.astro`; remove the now-unused imports).

- [ ] **Step 3: Write prose.css and import it**

Create `src/design/prose.css`:
```css
.case-study-head {
  padding-top: var(--space-7);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--rule);
}
.case-study-back {
  font-size: var(--step--1);
}
.prose {
  max-width: var(--measure);
  padding-top: var(--space-6);
  padding-bottom: var(--space-7);
}
.prose h2 {
  font-size: var(--step-2);
  margin-top: var(--space-7);
}
.prose h3 {
  margin-top: var(--space-6);
}
.prose li + li {
  margin-top: var(--space-2);
}
.prose strong {
  color: var(--ink);
}
.prose .tradeoff {
  display: block;
  margin-top: var(--space-2);
  padding-left: var(--space-3);
  border-left: 2px solid var(--rule-soft);
  color: var(--muted);
  font-size: var(--step--1);
}
.prose .tradeoff-label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-right: var(--space-2);
}
.prose .link-list {
  list-style: none;
  padding: 0;
  border-top: 1px solid var(--rule);
}
.prose .link-list li {
  margin: 0;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--rule-soft);
}
.prose details {
  border-top: 1px solid var(--rule-soft);
  border-bottom: 1px solid var(--rule-soft);
  padding: var(--space-3) 0;
  margin: var(--space-4) 0;
}
.prose summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--ink);
}

.figure,
.prose .diagram-frame {
  margin: var(--space-6) 0;
  padding: 0;
}
.prose .diagram-frame video {
  width: 100%;
  background: #000;
}
.prose .diagram-frame img {
  background: #fff; /* diagrams are drawn for a light background */
  padding: var(--space-3);
}
figcaption {
  margin-top: var(--space-3);
  font-size: var(--step--1);
  color: var(--muted);
}

.aside {
  margin: var(--space-6) 0;
  padding: var(--space-4) 0 var(--space-4) var(--space-5);
  border-left: 1px solid var(--rule);
}
.callout {
  margin: var(--space-6) 0;
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--rule);
}
.callout-warning {
  border-color: var(--accent);
}

/* Sidenotes: a deliberate break from the system (spec Section 3). */
.sidenote-note {
  display: block;
  font-family: var(--font-note);
  font-size: var(--step-0);
  line-height: 1.25;
  color: var(--sticky-ink);
  background: var(--sticky);
  padding: var(--space-2) var(--space-3);
  transform: rotate(2deg);
  box-shadow: 0 1px 0 #d6b84a;
}
.sidenote-lead {
  display: block;
  font-size: var(--step--1);
  opacity: 0.75;
}
.sidenote-toggle {
  font-family: var(--font-note);
  font-size: var(--step--1);
  background: var(--sticky);
  color: var(--sticky-ink);
  padding: 0 var(--space-2);
  cursor: pointer;
}
@media (max-width: 79.99rem) {
  .sidenote-note {
    display: none;
    margin: var(--space-3) 0;
  }
  .sidenote-checkbox:checked + .sidenote-note {
    display: block;
  }
}
@media (min-width: 80rem) {
  .sidenote-toggle {
    display: none;
  }
  .sidenote-note {
    float: right;
    clear: right;
    width: 15rem;
    margin-right: calc(-15rem - var(--space-5));
    margin-top: var(--space-1);
  }
}
```
Import `prose.css` in `Shell.astro`.

- [ ] **Step 4: Run and commit**

Run: `npm run build && npm run test:dist && npx playwright test --reporter=line`
Expected: all PASS except `e2e/sidenote.spec.ts` (no `/kit` yet; it passes after Task 7). Check the case study at 390 and 1280 px in `npm run preview`: prose sits at a reading width, trade-offs read as quiet notes under each decision, the diagrams keep a white background in dark mode.

```bash
git add src/design src/layouts/CaseStudy.astro src/pages/projects src/layouts/Shell.astro e2e/sidenote.spec.ts e2e/loading.ts
git commit -m "Add prose, asides, callouts, figures and sticky-note sidenotes"
```

---

### Task 6: Motion kit: reveal and page transitions

**Files:**
- Create: `src/design/motion.css`, `tests/dist/motion.test.ts`
- Modify: `src/layouts/Shell.astro` (import)

**Interfaces:**
- Produces: class `.reveal` (staggered fade-and-rise on load; children of a page reveal in order via `--reveal-index`), cross-document view transitions on every page, both off under reduced motion.

- [ ] **Step 1: Write the failing test**

Create `tests/dist/motion.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { builtCss } from "./helpers";

const css = builtCss();

describe("motion", () => {
  it("animates page-to-page with cross-document view transitions", () => {
    expect(css).toMatch(/@view-transition\s*{\s*navigation:\s*auto/);
  });

  it("turns page transitions off for reduced motion", () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*{\s*@view-transition\s*{\s*navigation:\s*none/);
  });

  it("defines the reveal animation", () => {
    expect(css).toMatch(/\.reveal\s*{[^}]*animation:\s*reveal/);
  });
});
```
Run: `npm run build && npx vitest run tests/dist/motion.test.ts --config vitest.dist.config.ts --reporter=dot`
Expected: FAIL.

- [ ] **Step 2: Write motion.css and import it**

Create `src/design/motion.css`:
```css
@keyframes reveal {
  from {
    opacity: 0;
    translate: 0 0.75rem;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
.reveal {
  animation: reveal var(--dur-slow) var(--ease-out) both;
  animation-delay: calc(var(--reveal-index, 0) * 80ms);
}
main > :nth-child(2) {
  --reveal-index: 1;
}
main > :nth-child(3) {
  --reveal-index: 2;
}
main > :nth-child(n + 4) {
  --reveal-index: 3;
}

@view-transition {
  navigation: auto;
}
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--dur);
  animation-timing-function: var(--ease-in-out);
}
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: none;
  }
}
```
Import `motion.css` in `Shell.astro`. The tokens already zero `--dur-slow` under reduced motion, so `.reveal` finishes instantly there.

- [ ] **Step 3: Run and commit**

Run: `npm run build && npm run test:dist && npx playwright test --reporter=line`
Expected: all PASS: the 0/50/100% overlap tests still freeze at least one animation per page; the reduced-motion test finds no animation time.

```bash
git add src/design/motion.css src/layouts/Shell.astro tests/dist/motion.test.ts
git commit -m "Add the reveal and page-transition motion kit"
```

---

### Task 7: The kit page

**Files:**
- Create: `src/pages/kit.astro`, `src/design/kit.css`
- Modify: `e2e/pages.ts`, `lighthouserc.json`, `src/layouts/Shell.astro` (import)

**Interfaces:**
- Consumes: every component above.
- Produces: route `/kit` (noindex): one page showing the type scale, palette, a work card, prose with a sidenote, an aside, both callouts and a figure, so the screenshot tests see every shared component.

- [ ] **Step 1: Write the page**

`src/pages/kit.astro`:
```astro
---
import Shell from "../layouts/Shell.astro";
import { ProjectCard } from "../components/ProjectCard";
import Aside from "../design/components/Aside.astro";
import Callout from "../design/components/Callout.astro";
import Figure from "../design/components/Figure.astro";
import Sidenote from "../design/components/Sidenote.astro";

const sample = {
  name: "Sample project",
  summary: "A sample card for the kit page.",
  description: "Shows how a project card looks with a still that colours on hover.",
  status: "in-progress" as const,
  stack: ["Astro", "TypeScript"],
  order: 0,
  world: false,
  ogImage: "/demo/satisfactory-dash-walkthrough-poster.png",
};
const swatches = ["paper", "raised", "ink", "ink-soft", "muted", "accent", "rule-soft", "sticky"];
---

<Shell title="Kit | Leonardo Nunez" description="Every shared component in one place, for visual checks." path="/kit" noindex>
  <main>
    <header class="hero page reveal">
      <p class="kicker">Design system</p>
      <h1>Kit</h1>
    </header>

    <section class="section page reveal">
      <div class="section-head"><p class="kicker">Type</p><h2>Scale</h2></div>
      <div class="kit-type">
        <p style="font-family:var(--font-display);font-variation-settings:var(--display-axes);font-size:var(--step-4);line-height:1">Step 4</p>
        <p style="font-family:var(--font-display);font-variation-settings:var(--display-axes);font-size:var(--step-3);line-height:1">Step 3</p>
        <p style="font-family:var(--font-display);font-variation-settings:var(--display-axes);font-size:var(--step-2);line-height:1">Step 2</p>
        <p style="font-size:var(--step-1)">Step 1, body large</p>
        <p>Step 0, body text in Public Sans.</p>
        <p style="font-size:var(--step--1)">Step −1, small print</p>
      </div>
    </section>

    <section class="section page reveal">
      <div class="section-head"><p class="kicker">Colour</p><h2>Palette</h2></div>
      <ul class="kit-swatches">
        {swatches.map((s) => <li><span style={`background:var(--${s})`}></span>{s}</li>)}
      </ul>
    </section>

    <section class="section page reveal">
      <div class="section-head"><p class="kicker">Work</p><h2>Card</h2></div>
      <div class="work-list"><ProjectCard project={sample} /></div>
    </section>

    <section class="section page reveal">
      <div class="section-head"><p class="kicker">Writing</p><h2>Prose</h2></div>
      <div class="prose">
        <p>
          The last step moved the API from the tunnel on the home PC to the one on AWS. In
          Cloudflare's dashboard that means editing one route on one tunnel.
        </p>
        <Sidenote id="kit-tunnel" lead="don't do what I did">
          I deleted the whole production tunnel instead of the route. Read the button twice.
        </Sidenote>
        <p>
          The rollback for every step was written down before the window opened, which is why the
          next part was only a scare.
        </p>
        <Aside title="Aside">An aside holds context that's useful but not essential.</Aside>
        <Callout>A note callout, for something the reader should know.</Callout>
        <Callout kind="warning">A warning callout, for something that can go wrong.</Callout>
        <Figure caption="A figure with its caption.">
          <img src="/diagrams/satisfactory-dash-deployment.svg" width="5070" height="2454" alt="Deployment diagram" />
        </Figure>
      </div>
    </section>
  </main>
</Shell>
```
`src/design/kit.css`:
```css
.kit-type p {
  margin: 0 0 var(--space-3);
  color: var(--ink);
}
.kit-swatches {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: var(--space-4);
  font-size: var(--step--1);
}
.kit-swatches span {
  display: block;
  height: 3rem;
  border: 1px solid var(--rule-soft);
  margin-bottom: var(--space-2);
}
```
Import `kit.css` in `Shell.astro`. Add `{ name: "kit", path: "/kit", status: 200 }` to `e2e/pages.ts` and `"http://127.0.0.1:4321/kit"` to `lighthouserc.json`.

- [ ] **Step 2: Run and commit**

Run: `npm run build && npm run test:dist && npx playwright test --reporter=line && npm run lhci`
Expected: all PASS, including `e2e/sidenote.spec.ts` (margin placement at 1280; psst toggle on phones) and every overlap test on `/kit` (the sticky note must not overlap the prose). Lighthouse ≥ 0.9 on all four URLs.

```bash
git add src/pages/kit.astro src/design/kit.css src/layouts/Shell.astro e2e/pages.ts lighthouserc.json
git commit -m "Add a kit page showing every shared component"
```

---

### Task 8: Dark screenshots, style guide, baselines and the PR

**Files:**
- Create: `docs/STYLE.md`
- Modify: `e2e/visual.spec.ts`, `CLAUDE.md`, `e2e/__screenshots__/**` (regenerated)

- [ ] **Step 1: Warm fonts and add dark screenshots**

In `e2e/visual.spec.ts`, add a warm-up helper and use it before every `goto` in the three existing tests, then add a dark-mode test:
```ts
// font-display: optional can skip a font that misses its first ~100 ms; a first
// visit fills the cache so the screenshot always has the real fonts.
async function warm(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
}
```
(import `type Page` from `@playwright/test`). Add:
```ts
test(`${name} looks the same in dark mode`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await warm(page, path);
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page).toHaveScreenshot(`${name}-dark.png`, { ...firstScreen, animations: "disabled" });
});
```

- [ ] **Step 2: Write the style guide**

Create `docs/STYLE.md` with these sections, each short and concrete:
- **Direction:** Editorial; bold through type, not effects.
- **Tokens:** what each colour, type step, space and motion token is for (from `tokens.css`), with the measured contrast ratios from the spec.
- **Type:** Fraunces for headings only, with `SOFT 50, WONK 1`; Public Sans for everything else; Gochi Hand only inside sidenotes.
- **Anti-AI rules:** no gradients, glass, blobs or card shadows; no icon on every bullet; no three-card feature grids; hairline rules instead of boxes; every visual shows something real.
- **Voice:** plain, first person, specific; the banned phrases ("leverage", "seamless", "cutting-edge", "passionate", "delve", "robust solution", "in today's fast-paced world").
- **Sidenotes:** about three per article; each traces to something that really happened and is approved by Leonardo; keep them short.
- **Motion:** what `.reveal` and the page transitions do; reduced motion turns both off; anything new must pass the loading-state tests.
- **References:** Josh W. Comeau (interactive articles, warm voice, asides) and Lynn Fisher's archive (colour on hover).
- **Components:** one line each for `ProjectCard`, `Aside`, `Callout`, `Figure`, `Sidenote`, `CaseStudy`, with their props; the `/kit` page shows them all.

In `CLAUDE.md`, add under "Ground rules" a line: "6. **Design changes follow `docs/STYLE.md`.** Check new visuals against it and the `/kit` page."

- [ ] **Step 3: Push, regenerate baselines and open the PR**

```bash
git add e2e/visual.spec.ts docs/STYLE.md CLAUDE.md
git commit -m "Add dark screenshots and the style guide"
git push -u origin HEAD
gh pr create --draft --title "Editorial design system" --body-file <body file>
```
Expected: `e2e` fails. Every existing screenshot differs (the redesign) and the new pages and dark shots have no baseline. Then, because the redesign is intended:
1. Run **Actions → Update screenshots** on the branch (`gh workflow run "Update screenshots" --ref design/system`).
2. `gh run download <that run id> --name screenshots --dir e2e/__screenshots__` (after `git rm -rq e2e/__screenshots__` to drop stale files).
3. Open at least: home at 360 and 1280 (light and dark), the case study at 390, `/about` at 768, `/kit` at 1280. Check fonts are Fraunces/Public Sans (not fallbacks), the sticky note sits beside the prose, and nothing looks broken.
4. Commit (`Add baseline screenshots for the Editorial design`), push, and confirm all checks pass, then `gh pr ready`.

The PR body lists what changed, the four plan rulings, the screenshots to look at, and asks Leonardo to review the preview URL on phone and desktop in both light and dark mode before merging.
