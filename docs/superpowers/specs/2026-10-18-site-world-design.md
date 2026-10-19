# The leonardonunez.dev world (Phase 3): design

Status: design approved by the owner in conversation on 2026-10-18 (takeaway A with B as one section, figure A,
outline below). This written spec still needs the owner's review before the plan is written.

Built directly on a branch, with CI, preview deploys and owner review as the gate, like the satis and lanes worlds.

## 1. Goal

The page should leave interested viewers believing this: **every change to this site is proven at four screen
widths before it ships.**

The CI gate leads the page. Speed ("fast by default") is one section, as supporting evidence that the same
discipline covers performance. The page pairs with the other two case studies as "the site that shows them".

Copy rule (owner, 2026-10-18): the page addresses "interested viewers"; it never says "hiring manager".

Like lanes, the page is honest about what the gate can't do. Its limits get their own section in the main read,
including a bug the gate missed.

Length and form follow the other worlds: a short main read (~700 words), deeper material in closed "More detail"
sections. Every claim links to its source in this public repository
(`https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio/...`): a PR, a test file or a workflow.

## 2. The article

Headings (the dist test pins them):

1. **The problem.** Interested viewers often open a portfolio on a phone, and much of this site's code is written
   by AI sessions that never look at one. So the site has to prove itself at every width on every change.
2. **What every change must pass.** The gate: lint, typecheck, unit and build-output tests; Playwright at 360, 390,
   768 and 1280 px (routes, horizontal overflow, overlaps while media and animations load, axe in light and dark,
   screenshots compared in Playwright's official container); mobile Lighthouse at 90 or above; a link checker
   (proved by a deliberately broken link in #35); CodeQL; and a PII check. Each item links its test or workflow.
3. **Where it breaks.** The figure (section 4).
4. **What it caught, and what it missed.** The verified cases below, with PR links.
5. **Fast by default.** No JavaScript on any page without a figure; 15 KB gzipped on pages with one
   (`tests/dist/budget.ts`); a static table of each scripted page's real gzipped size; a year of caching for hashed
   files, none for pages (`public/_headers`); prerendering on hover in Chrome.
6. **Limits and trade-offs.** In the main read:
   - Screenshots are valid only from the Playwright container, so every intended visual change costs a round trip
     through the Update screenshots workflow.
   - Full-page screenshots allow 1,500 scattered pixels, a deliberate blind spot for tiny changes.
   - Linux and Windows render fonts at different widths; local runs can pass while CI fails (#40).
   - The site's smooth scrolling made position-measuring tests flaky until they scrolled instantly (#43).
   - The gate only checks what someone thought to test: the split titles in #38 passed it and were found by eye.
7. **How it was built.** Claude Code sessions, with the owner's review at each round; the figure kit shared by all
   three worlds.

### Claims and their sources

Verified before writing (2026-10-18):

| Claim | Source |
|---|---|
| CI's Linux fonts made a cutover route touch the CLOUDFLARE label on tablets; fixed after CI, with a clearance test | PR #40 body, commit "Climb the cutover's routes clear of the CLOUDFLARE label" |
| The hero's portrait grid split /about and /kit titles on tablets and desktops, from #36, found on the live site; the new h1 test failed before the fix | PR #38 body |
| The link checker failed on a deliberate broken link before it was removed | PR #35 commits |
| A scrollbar appearing must not change the layout | PR #35 commit, `e2e/layout.spec.ts` |

Any further claim is checked against its source when drafted. The per-page sizes in the table are measured from the
build when drafted, and a dist test fails if the table drifts from the build by more than 10 %.

### Sidenotes

None planned; the owner may add some at the draft read.

## 3. The cover

CSS-only, like lanes: four page outlines at their relative widths (360, 390, 768, 1280), one of them marked failing.
Rendered to `public/covers/leonardonunez-dev.png` and `public/og/leonardonunez-dev.png` by `npm run render:covers`.

## 4. The figure: where it breaks

### Frames

Four live miniature pages, side by side on desktop, for 360, 390, 768 and 1280 px. Each frame lays out a small real
page (header, hero with h1, a paragraph, an image, a figure with a route and label) at its true width, scaled down to
fit. The layout responds to the frame's width through container queries that copy the site's breakpoints, not to
the reader's window.

### Cases

One switch per case; one case on at a time. Each injects one kind of bug into all four frames:

1. **CI's wider fonts** (caught, #40). The label renders at CI's width; at 768 the route crosses it. Check:
   `labelCollisions`.
2. **A grid meant for one hero** (missed, then tested, #38). The portrait grid applies to every hero; at 768 and 1280
   the kicker and h1 split into two columns. Check: the h1 starts at the content's left edge.
3. **An image without reserved space** (guarded). While it loads, the image has no height and the text below
   overlaps it when it arrives. Check: `overlaps` with media held.
4. **A long unbroken line** (guarded). A long URL makes the 360 frame scroll sideways. Check: horizontal overflow.

"Caught", "missed, then tested" and "guarded" are shown on each case; only #40 is called a catch.

### What the reader sees

Each frame shows pass or fail. A failing frame outlines the colliding boxes and shows the check's failure text,
verbatim from the shared check. A **Fix it** action applies the real fix (the route climbs clear; the grid applies
only to a hero with a portrait; the image reserves its space; the line wraps) and the frames re-check and pass.

### Real code

The cores of `overlaps` (`e2e/loading.ts`) and `labelCollisions` (`e2e/figures.ts`) move into
`src/design/checks/`, as self-contained functions over a root element. The e2e helpers pass them to
`page.evaluate`; the figure calls them on its frames. The h1-edge and overflow checks move there too. The figure's
failure text is the checks' own output.

## 5. Architecture

- `src/worlds/site/`: `world.css` (tokens scoped to `.world-site`), `Cover.astro`, `figures/` (the figure, its
  frames, its view script), `model/cases.ts` (each case: its id, label, verdict kind, the bug and the fix as classes
  on the frames, the check to run).
- `src/design/checks/`: the shared checks, with unit tests on fixtures.
- Reuses `src/design/figure/` (loop, lazy loading, controls, goals, responsive mount).
- `src/content/projects/leonardonunez-dev/index.md` becomes `index.mdx`, with `world: true`, `cover` and `ogImage`;
  `src/worlds/index.ts` maps the slug to the world.
- JavaScript budget: `projects/leonardonunez-dev.html` gets 15 KB; every other page stays at 0. The page joins the
  e2e page list and `lighthouserc.json`.

## 6. Phones, reduced motion and accessibility

- Below 40rem, one frame at a time with a width picker (360, 390, 768, 1280); the frame scales to fit.
- The figure has no autoplay: nothing moves until the reader picks a case, so reduced motion only removes the
  transitions.
- Frames are `role="img"` with a text alternative stating the result; controls are labelled buttons outside them.
- Results are announced once per reader action, not continuously.
- axe is clean in light and dark.

## 7. Testing

- **Unit:** each shared check on pass and fail fixtures; the case model.
- **Dist:** headings; source links; "Limits and trade-offs" in the main read and naming the #38 miss; the size table
  against the build; budget and module-only scripts; stills at their sizes; og image; no "hiring manager".
- **e2e:**
  - each case fails at exactly its widths and passes after Fix it;
  - the e2e suites still pass using the moved checks;
  - keyboard only; reduced motion; the phone width picker; the resize remount keeps the case;
  - no overlap in the figure's own chrome at any width.
- Screenshot baselines come only from the Update screenshots workflow.

## 8. Colour (deferred)

A palette round once the figure exists: distinct from satis's amber and lanes' teal, with fixed roles for pass,
fail and the outline marking a collision.

## 9. The owner's part

- Review this spec, then the plan.
- Review the figure: desktop, then phones.
- The ~10-minute draft read, and any sidenotes.
- The palette pick.

## Out of scope

- A second interactive figure (the budget meter); the size table covers speed.
- Changing the gate itself, beyond moving the checks into a shared module.
