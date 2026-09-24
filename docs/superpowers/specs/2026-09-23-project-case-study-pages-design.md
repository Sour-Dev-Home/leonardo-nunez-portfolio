# Project case-study pages — design

## Context and goal

The portfolio site currently shows every project as a single card with a
short blurb on the one-page home view (CLAUDE.md ground rule 1: "single-page,
plain client-side React ... no router"). Leonardo wants the site to be "more
extensive" — full per-project case-study pages, not just a blurb — starting
with `satisfactory-dash`, since that's the project meant to prove full-stack
range for his job search (see `../about-me.md`). This is an architectural
change: it introduces routing where none exists today, a markdown-based
content pipeline, and a build-time diagram-rendering step. None of those are
extensions of an existing flow.

**Success criteria:** a recruiter can click a project card and land on a real
case-study page (not just a longer blurb) with working back/forward
navigation and a working deep link; the change adds no runtime cost the site
doesn't need (no shipped markdown parser, no shipped Mermaid renderer); the
existing "single-page for projects with nothing more to say" pattern still
works unchanged for projects like Home Lab and (new) `local-worker` that
don't get a case study.

## Section 1 — Routing

A minimal hand-written router, not react-router: this site only ever needs
two route shapes (`/` and `/projects/:slug`), no nesting, no data loaders —
a library's feature surface would be unused weight against this repo's
"simple by design" rule.

- A `Router` context/provider reads `window.location.pathname` on mount.
- A `<Link>` wrapper intercepts clicks on same-origin hrefs, calls
  `history.pushState`, and updates route state — avoiding a full page
  reload for in-app navigation.
- A `popstate` listener re-syncs route state on browser back/forward.
- `App.tsx` matches the current path against the two known shapes and
  renders `<Home />` or `<ProjectDetail slug={...} />`. An unmatched
  `/projects/<unknown-slug>` renders a small "project not found" state
  with a link back home — not a hard error.
- Real anchor tags throughout (see Section 4) so keyboard tab order,
  focus-visible styling, and "open in new tab" all keep working without
  extra JS.

## Section 2 — Data model

Extend the existing `Project` interface in `src/data/projects.ts`:

```ts
interface Project {
  name: string;
  description: string;
  status: "in-progress" | "shipped";
  stack: string[];
  repoUrl?: string;
  liveUrl?: string;
  slug?: string; // present only when a full case-study page exists
  emphasis?: "primary" | "secondary"; // secondary = compact, lower-emphasis card
}
```

- A card shows a "Read case study →" link to `/projects/${slug}` only when
  `slug` is set. No `slug` means the card behaves exactly as it does today.
- `emphasis: "secondary"` renders a visually quieter, more compact card
  variant (tighter spacing, description only, still shows stack chips and
  repo link) — this is the shape `local-worker` uses today, and the shape
  any future minor project uses without needing a new component.
- This is additive only: no existing project entry's rendering changes
  unless it opts in to the new fields.

## Section 3 — Content pipeline

Case-study body content is markdown, not JSX, so `portfolio-updater` (or a
human) can update it without touching component code:

- Files live at `src/content/case-studies/<slug>.md`. No frontmatter —
  title, stack, links, and status already live in `projects.ts` keyed by
  the same slug, so the markdown file is just the case-study prose.
- A small build step (a `prebuild` npm script, run before `vite build`)
  reads each `.md` file and converts it to a static HTML string using
  `marked` (a single, small, widely-used, MIT-licensed dependency), writing
  the result to a generated, gitignored module:
  `src/content/case-studies/generated/<slug>.ts` exporting `html: string`.
- `ProjectDetail` imports the generated module for its slug and renders the
  HTML via one scoped `dangerouslySetInnerHTML` — no markdown parser ships
  to the browser; the browser only ever sees plain HTML.
- The Mermaid diagram is referenced from the markdown as a normal image
  (`![...](/diagrams/satisfactory-dash-architecture.svg)`), which `marked`
  turns into a plain `<img>` — no special-casing in the pipeline itself.
- `npm run dev` also needs the generated modules to exist (Vite dev server
  doesn't run `prebuild`), so the dev script runs the same generation step
  first, or the generation script watches `src/content/case-studies/` in
  dev mode. (Implementation detail to settle in the plan, not a design
  fork — either way, generated output is never committed.)

## Section 4 — Diagram and accessibility

- The architect's Mermaid source is rendered once, outside the build (e.g.
  mermaid.live or a one-off local `npx @mermaid-js/mermaid-cli` run — not a
  project dependency), to `public/diagrams/satisfactory-dash-architecture.svg`.
  The Mermaid source itself is kept alongside as
  `public/diagrams/satisfactory-dash-architecture.mmd` (not built, not
  shipped as an asset reference — just there so the SVG can be regenerated
  later without reverse-engineering it from the rendered output). Per the
  coordinator's note, gated/not-yet-live components render dashed in the
  diagram itself, at render time.
- The `<img>` gets descriptive `alt` text (what the diagram shows at a
  glance — the shape of the system, not "architecture diagram").
- Below the image, a `<details>`-based expandable plain-text description
  of the diagram's content (component list and how they connect) — visible
  and discoverable to everyone via a disclosure triangle, not just
  screen-reader-only text, since a text equivalent is useful for anyone
  skimming, not only assistive-tech users.
- Heading order on the detail page: `<h1>` = project name (once per page),
  `<h2>` for each case-study section, following the markdown's own `##`
  headings one-for-one. No skipped levels, no second `<h1>`.

## Section 5 — Components

- `App.tsx`: hosts the router provider and route matching.
- `ProjectDetail.tsx` (new): renders the header (name, status, stack,
  repo/live links — reusing existing presentational pieces where
  `ProjectCard` already has them) plus the generated case-study HTML body
  and the diagram block.
- `ProjectCard.tsx` (existing, updated): adds the case-study link when
  `slug` is present, and a compact rendering path when
  `emphasis === "secondary"`.
- No new state-management dependency — route state is the only new piece
  of client state, and it's small enough for plain `useState`/context.

## Section 6 — Publishing process for the first case study

The satisfactory-dash draft lives at
`../portfolio-drafts/satisfactory-dash-case-study.md` (outside every repo,
never committed there). Before it ships in this repo:

1. Verify every one of its 16 HTML-comment citations (PR/ADR/file path)
   against the actual `satisfactory-dash` repo — the same standard
   `portfolio-updater` holds itself to. A citation that doesn't check out
   gets fixed or the claim gets cut, not published anyway.
2. Re-check, at publish time (not draft time, since both are moving
   targets): the ADR count claim ("Fourteen ADRs...") against what's
   actually on `satisfactory-dash`'s `main`, and the license statement
   against whether the MIT→AGPL-3.0 PR has merged yet.
3. Strip all HTML-comment citations from the version that actually ships —
   they're a verification aid, not reader-facing content.
4. Keep the coordinator's note that the live API
   (`api.satis-manager.com`) is intentionally offline (tunnel gated on
   auth hardening + a security review) — without it, a visitor who tries
   the live link sees what looks like a broken site.
5. `local-worker` gets a short (1-2 sentence), `emphasis: "secondary"`
   entry with no case study — the facts the coordinator supplied are
   already checkable in that repo's own README, so no separate citation
   pass is needed the way the satisfactory-dash prose needs one.

## Section 7 — Testing and rollout

Standard workflow for this repo: feature branch → PR → this repo's existing
branch-protection checks (verify, security, CodeQL) → review the Cloudflare
Pages preview → merge (Leonardo's call, not automatic). Specific to this
change, verified in Chrome against the preview URL before asking for merge:

- Deep-link reload: hard-refresh `/projects/satisfactory-dash` directly
  (not just client-side navigation to it) to confirm Cloudflare Pages'
  SPA fallback actually serves `index.html` for the unknown path, rather
  than assuming it does.
- Desktop width and the narrowest width the browser-resize tooling
  actually reaches in this environment (previously floored around
  ~657px, short of true phone width — flagged as a known tooling
  limitation, not skipped silently).
- Tab through the page to confirm focus order and focus-visible styling
  on all links, including the diagram's `<details>` disclosure.
- Console clean on both `/` and `/projects/satisfactory-dash`.

## Out of scope for this change

- Any route shape beyond `/` and `/projects/:slug` (no tags/filter pages,
  no pagination).
- A CMS or markdown-authoring UI — files are edited directly.
- Automated Mermaid regeneration in CI — the SVG is committed like any
  other static asset; regenerating it is a manual step when the diagram
  changes.
- A case study for `local-worker` or any project beyond
  `satisfactory-dash` — only a compact card for `local-worker` per Section
  2/6.
