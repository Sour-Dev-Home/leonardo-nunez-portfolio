# Portfolio overhaul — design

Status: approved in brainstorming with Leonardo, 2026-10-17. Phase 1 of a larger
overhaul; Phase 2 items are listed so they aren't lost, but each gets its own
task issue later.

## Context and goal

The site is a Vite + React single-page app with a hand-written two-route router,
one markdown case study (`satisfactory-dash`) rendered at build time with
`marked`, and project data in `src/data/projects.ts`. Since it was built,
satis-manager moved its production backend to AWS and lanes became the delivery
process for satisfactory-dash; the site describes neither. The lanes card still
calls lanes a pilot.

Two structural problems sit under the content gap:

- **Link previews don't work.** Titles and descriptions are set by JavaScript
  after load (`useDocumentMeta`) and there are no Open Graph tags, so a case-study
  link shared on LinkedIn or Slack shows the generic site title.
- **Case studies can't hold interactive figures.** `marked` output is static HTML;
  there's nowhere to put an animated architecture diagram or a figure the reader
  controls.

**Audience:** recruiters and engineering managers hiring for software engineering
roles. **Success** means they understand, in about 60 seconds, that Leonardo
builds products *and* the delivery systems that ship them, and they get in touch.

**Headline story:** satis-manager is the product, lanes is the delivery system that
ships it; the two case studies cross-link. The role of AI agents is stated upfront
as part of the skill: Leonardo sets direction, writes specs, makes the
architecture calls and reviews every PR; agents implement under lanes' gates.

**Success criteria for Phase 1:**

1. Every case-study page is pre-rendered HTML with its own title, description and
   Open Graph image, and a shared link previews correctly.
2. The site has a distinctive Editorial identity that a reviewer doesn't read as
   template- or AI-generated (checked against `STYLE.md`'s rules and references).
3. The satis-manager case study is a full "world": cover scene, rewritten article,
   at least two animated figures, one of them reader-controlled.
4. It works well on phones: built mobile-first, no horizontal scroll at 360 px,
   Lighthouse mobile performance and accessibility at 90 or above.
5. Without motion (`prefers-reduced-motion`) every page still carries all its
   content.
6. No current page, project or link is lost; current URLs keep working.

## Section 1 — Scope and phases

**Phase 1 (this spec), built directly, not through lanes:**

1. Migrate to Astro with React islands, keeping all current content.
2. The Editorial design system: tokens plus a written `STYLE.md`.
3. The motion kit: shared timing tokens and primitives.
4. The world framework: the cover-plus-article template and project-folder
   conventions.
5. The reference world: the satis-manager case study.
6. CI additions (Section 6).
7. The custom domain.

**Phase 2, through lanes**, one task issue each, starting once Phase 1 is merged
and live (the "design system frozen" point):

- the lanes case study and its world;
- worlds or plain case studies for the other projects;
- README and documentation refreshes in the lanes and satisfactory-dash repos (task
  issues in those repos);
- Remotion demo videos;
- adopting lanes in this repo: `lanes.config.json`, ruleset, labels, the same
  reviewer set as satisfactory-dash, and `ui-reviewer` Playwright access to this
  repo.

**Why the split (decided 2026-10-17):** by Conway's law, the site's structure
follows the structure of whoever builds it. Fresh lanes sessions that share no
context, each building one piece of the shell, would produce a patchwork that
agrees only where a contract forced it, which is the AI-generated look this
overhaul is meant to avoid. So the parts that must feel like one hand (the design
system, the motion language, the voice) are made in one place first and frozen as
the contract. Worlds are independent modules on that contract, which is what lanes
builds well.

## Section 2 — Architecture

**Framework:** Astro, static output, with `@astrojs/mdx` and `@astrojs/react`.
Interactive pieces are React islands hydrated only where used. Hosting stays on
Cloudflare Pages (build `npm run build`, output `dist`).

**Why Astro over keeping Vite (decided 2026-10-17):** pre-rendered HTML per page
fixes link previews; MDX and content collections are native; view transitions are
built in; file-based routing replaces the hand-written router and
`useDocumentMeta`. That is less custom code than today, which keeps ground rule 1
("simple by design"). React is still the component language inside islands. A
Vite + MDX + pre-render-plugin build was considered and rejected: it bolts on what
Astro provides and ships the whole page as JavaScript, which works against the
mobile performance budget.

**Structure:**

```
src/
  content.config.ts          projects collection, glob() loader, zod schema
  content/projects/
    satisfactory-dash/       index.mdx, Cover.tsx, figures/*.tsx, world.css, cover-still.webp
    lanes/                   index.mdx (plain article until its world lands)
    local-worker/            index.mdx with frontmatter only (no case study yet)
    home-lab/                same
  pages/
    index.astro              home
    about.astro
    projects/[slug].astro    getStaticPaths over the collection; case study or data-only page
  layouts/
    Shell.astro              nav, footer, fonts, tokens, view transitions, meta/OG tags
    CaseStudy.astro          cover slot + article column + margin
  design/
    tokens.css
    motion/                  timing tokens and primitives (Section 4)
    components/              Figure, Aside, Callout, Sidenote, Stat, WorkCard
docs/
  STYLE.md                   the design and voice rules, linked from CLAUDE.md
```

**Projects stay data (ground rule 2):** each project's frontmatter carries today's
`Project` fields (`name`, `description`, `status`, `stack`, `repoUrl`, `liveUrl`,
`emphasis`) plus `order`, `world` (bool) and `ogImage`. The schema enforces them,
so a missing or invalid field fails `astro check`. The portfolio-updater agent
edits frontmatter instead of `projects.ts`. `CLAUDE.md` and the agent's
instructions are updated to say so.

**World isolation:** a world's code lives only in its folder and is imported only
by its own page, so one world's weight (Rive, a 3D scene) never reaches the home
page or another project. Each world has its own size budget (Section 6).

**Routes:** `/`, `/about`, `/projects/:slug`. `/about` is a third route shape; the
justification is that About is a page in the new nav and now that routing is
file-based it costs no router code. `CLAUDE.md` rule 1 is rewritten to describe
the Astro routes and keep the spirit: no route shape without a page that needs it.

**Meta:** `Shell.astro` renders `<title>`, description, canonical URL and Open
Graph and Twitter tags from page props at build time. Each project has an OG image
(the cover still, 1200×630).

## Section 3 — Design system

**Direction (chosen 2026-10-17): Editorial.** Magazine feel, bold through
typography rather than effects.

- **Type:** one characterful display serif for headlines, one plain text face for
  body. The final pair is picked by Leonardo from a shortlist of three in a visual
  round during the build. Fonts are self-hosted (no third-party font requests).
  Sizes are fluid with `clamp()`, so headlines stay huge on desktop and fit 360 px.
- **Colour:** warm paper, ink, one accent (vermilion to start). Dark mode is
  designed deliberately, not inverted.
- **Layout:** an asymmetric 12-column grid on desktop, a single column on phones,
  hairline rules instead of cards.
- **Work cards (reference: Lynn Fisher's archive list):** on the home page each
  project shows a grayscale still of its world's cover that floods into the
  world's colours on hover or keyboard focus (about 150 ms). On touch devices the
  card colours as it reaches the middle of the viewport (a CSS scroll-driven
  animation) and on tap. With reduced motion the change is instant.
- **Sidenote, a sanctioned exception:** small playful notes that deliberately break
  the system with their own quirky font (chosen in its own round), a small bright
  "sticker" palette, a slight tilt and optional doodled arrow. They hold personal
  anecdotes and advice. On desktop they sit in the margin beside their paragraph;
  on phones they collapse to an inline "psst" tab that opens on tap. Rules: about
  three per article at most; every one traces to something that really happened
  and is approved by Leonardo; each is an `<aside>` announced as a note; text meets
  WCAG AA contrast whatever the font.

**`STYLE.md` contents:**

- tokens and when to use each;
- **the human references** the design is checked against: Josh W. Comeau's site
  (interactive in-article demos, spring-timed interactions, warm voice, asides) and
  Lynn Fisher's archive list (colour on hover); more can be added;
- **anti-AI rules:** no gradients, glass, blobs or card shadows; no icon on every
  bullet; no three-card feature grids; every visual shows something real (a
  screenshot, a real diagram, a real number);
- **voice:** plain, first person, specific; a banned-phrase list ("leverage",
  "seamless", "cutting-edge", "passionate", "delve", "robust solution",
  "in today's fast-paced world" and similar);
- the Sidenote exception and its rules.

## Section 4 — Motion

**Stack:**

- **Motion** (the `motion` package) inside React islands, for figures and
  spring-timed small interactions;
- **Rive** for world covers authored in the Rive editor (`@rive-app/react-canvas`
  or the lighter web runtime, chosen on bundle size);
- **CSS view transitions** (Astro's `<ClientRouter />`) for page-to-page motion and
  CSS scroll-driven animations for the shell, with no JavaScript;
- GSAP is held in reserve if Motion's timelines prove limiting; a 3D library only if
  a specific world needs it, loaded only on that page.

**Motion kit (`design/motion/`):**

- timing tokens: durations, easings and spring presets, shared by every world;
- `Reveal`: text and section entrance;
- `ScrollFigure`: a figure that plays as it scrolls into view, with a poster frame;
- `useReducedMotion` handling inside every primitive: under
  `prefers-reduced-motion` each shows its final state, figures show their poster
  frame, and controllable figures still work by stepping without animation.

**Covers on phones:** each Rive cover has a portrait layout for phones, not a
shrunk desktop scene. A static poster renders first; the animation loads after
(idle or on visibility) and never on `Save-Data`.

## Section 5 — The satis-manager world (reference)

**World:** industrial (steel, safety orange, conveyors), in `world.css` and the
cover. It must not copy Satisfactory's art or logos.

**Article outline:**

1. Cover scene.
2. The problem: a dashboard for Satisfactory servers, with production on a home PC
   that was out of RAM.
3. The system: the agent on the game PC, the API, PostgreSQL, multi-server.
   *Figure: interactive architecture.*
4. The move to AWS: Free-plan constraints, the $35 budget guard, Fargate with the
   tunnel sidecar, RDS, nightly backups to B2. *Figure: the cutover, stepped
   through by the reader (freeze, backup, restore, verify, switch), each step
   with its rollback.*
5. What I'd do differently, and what's next (the planned exit from the AWS
   Free plan and its trade-offs).
6. How it was built: lanes, linking to the lanes case study.

**Claims are sourced:** every number or factual claim links to its source (PR,
ADR, commit, live URL). Nothing unmeasured, such as uptime percentages.

**Authorship (decided 2026-10-17; Leonardo has little time to write):** Claude
drafts the full case study from the repos and from what happened in sessions.
Candidate sidenotes are drawn from real moments (for example deleting the
production tunnel instead of its route during the cutover) and phrased in
Leonardo's voice. Leonardo's part is about ten minutes per case study: read the
preview, optionally answer up to three short prompts, approve, tweak or veto each
sidenote, and flag anything wrong or off-voice.

## Section 6 — CI/CD and quality gates

**Hosting:** Cloudflare Pages: a preview URL per PR, production on merge to
`main`, the new custom domain, and `*.pages.dev` redirecting to it.

**CI on every PR (`.github/workflows/ci.yml`, extended):**

| Job | Checks | Fails when |
|---|---|---|
| verify | oxlint, `astro sync && tsc -b` (types and content schema), Vitest, build, build-output tests including the JS budget (`tests/dist/budget.test.ts`) | any error; invalid project frontmatter; a page's gzipped JS over budget (60 kB default; a world sets its own) |
| e2e | Playwright at 360, 390, 768 and 1280 px in the `mcr.microsoft.com/playwright` container: status codes, no horizontal overflow, layout unchanged by scrollbars, axe, no motion under reduced motion, loading states (media held back, animations paused at 0/50/100%, mid-navigation) checked by geometry | any overflow, overlap or pop-in; any serious or critical axe violation |
| visual | Playwright `toHaveScreenshot` in the same job: each page loaded (full page), while media loads and halfway through animations (first screen) | any difference from the committed baselines, or a screenshot with no baseline; baselines refreshed with the Update screenshots workflow |
| lighthouse | Lighthouse CI (`npx @lhci/cli`), mobile profile, on the built site | performance or accessibility below 90 |
| links | `lychee` over the built HTML, also nightly | broken links |
| security | the existing org-wide PII scan and `npm audit` | unchanged |

Dependabot stays. Budgets start at the values above and are tuned once the first
world exists; a budget is never raised to make a PR pass without a note in the PR.

**Changes from the first version of this table (2026-10-17, Plan 2):**
- *Argos replaced by Playwright's built-in visual comparison (owner's decision).*
  Argos's free plan targets personal repositories and this one is
  organisation-owned; reg-suit was also weighed and rejected, since it needs a
  storage bucket and a GitHub app for a few dozen screenshots. Baselines live in the
  repo and are only valid from the Playwright container, where fonts are identical.
- *`size-limit` replaced by a build-output budget test.* It measures what each page
  actually loads (inline scripts, script files, module preloads, Astro island
  bundles) with no extra dependency.
- *Loading states added (owner's request).* A finished-page screenshot says nothing
  about the first few hundred milliseconds, so in-between states are frozen and
  checked deterministically.
- *Lighthouse CI runs through `npx` at a pinned version,* not as a dependency: its
  own dependencies carry advisories that would fail `npm audit`.

## Section 7 — Migration and testing

- **Parity:** an e2e test asserts every current project and every external link
  appears on the new site, and `/` and `/projects/satisfactory-dash` return 200.
- **Unit tests:** the content schema, meta/OG rendering, and the motion primitives'
  reduced-motion behaviour.
- **Visual:** Argos baselines are taken on the first Astro PR; later PRs diff
  against them.
- **Rollout:** small PRs on feature branches, each reviewed on its preview URL on
  phone and desktop before merge (ground rule 5). The cutover to Astro is one PR
  that keeps today's look as closely as practical, so the redesign PRs that follow
  diff cleanly.

## Owner steps (Leonardo)

1. Choose and buy the domain at Cloudflare Registrar; Claude wires it to Pages.
2. Create a free Argos account for the public repo and add its token as a repo
   secret.
3. Delete the old Netlify site if it still exists in the Netlify account.
4. Visual rounds in the companion: the font pair, the Sidenote font, the
   satis-manager cover.
5. About ten minutes per case study (Section 5).

## Out of scope

- A CMS, a backend, comments, analytics beyond Cloudflare's built-in.
- 3D in Phase 1.
- Remotion videos and the lanes world (Phase 2).
- Any change to satisfactory-dash or lanes code.
