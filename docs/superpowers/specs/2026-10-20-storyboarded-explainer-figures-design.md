# Storyboarded explainer figures: design

Date: 2026-10-20. Status: draft for the owner's review.

## Context

The owner wants animated tech-stack and design/architecture diagrams on the portfolio, in the
interactive-explainer style of samwho.dev that the site's figures already follow. Decided
(2026-10-20): no Remotion and no video pipeline; community skills only (no paid Motion+ AI Kit). The
gap is a workflow step: a **storyboard** agreed before code.

The site already has the runtime for this. What it lacks is the process around it, so that a new
figure is agreed as a sequence of states and captions before anyone tunes an easing curve.

## Goals

1. Every new explainer figure goes script, storyboard, motion spec, build, capture and review, in
   that order, with an artifact at each step that an agent or the owner can check.
2. The storyboard is data, checked against the figure's pure model in CI, not a sketch that drifts.
3. Stills of any beat, and of moments mid-transition, can be rendered on demand, the same every run.
4. No new runtime dependency, no change to the JS budgets, Lighthouse or reduced-motion rules.
5. The first pilot is a satisfactory-dash architecture/data-flow figure built only from that repo's
   real architecture sources.

Non-goals: video export, a timeline editor, new visual-regression tests (the existing baseline flow
is unchanged), and reworking the existing figures (figure 1 gets a storyboard only as the example).

## What exists

- `src/design/figure/loop.ts`: `startLoop` (one rAF loop per figure: clamped dt (`MAX_DT` 0.05 s), a
  speed that eases to the slider, pause, off-screen suspend, sleep on a `false` frame) and
  `whileOnScreen`; `prefersReducedMotion`.
- `ease.ts`: `inOutCubic`, `inOutSine`, `outQuad`, `lerp`, `squash` (squash and stretch).
- `controls.ts` + `Controls.astro`: reset, speed slider, play/pause, a slot for figure buttons;
  `tickGoal` + `Goals.astro`. `lazy.ts` (`whenVisible`), `responsive.ts` (`mountResponsive`: desktop
  and phone drawings, state kept across a remount). `figure.css`.
- `src/design/motion.css` and the tokens `--dur-fast/--dur/--dur-slow`, `--ease-out/--ease-in-out`
  in `tokens.css` (all 0 under reduced motion).
- Worlds: `src/worlds/satis` (`model/outage.ts`, a seeded time-driven state machine with
  `seeded()` in `model/random.ts`; `model/cutover.ts`, a step-driven `viewAt(step)`; views in
  `figures/*-view.ts`; fixed coordinates in `figures/layouts.ts`), `src/worlds/lanes` (gate and path
  models, a dwell-at-stops view) and `src/worlds/site`.
- e2e: Playwright at 360/390/768/1280 px; `SPECS` and `pageTag` in `e2e/pages.ts`; visual baselines
  only from the Playwright container's **Update screenshots** workflow; `labelCollisions` checks.
- Figures render no React on the client: there are no `client:` directives; each figure is static
  Astro markup plus a lazily imported vanilla TS view. Budgets: `tests/dist/budget.ts` (15 KB gzipped
  per case study, 0 elsewhere); Lighthouse mobile ≥ 90 for performance and accessibility.

## The pipeline

Specified for agents in `.claude/skills/storyboard-motion/SKILL.md`. In short:

| Step | Artifact | Checked by |
|---|---|---|
| a. Script | the question, 3-6 beats of one idea each, sources, goals (PR or world spec) | owner |
| b. Storyboard | `figures/<name>.storyboard.ts`: `Storyboard<State>` with beats as model states + captions; `<name>.storyboard.test.ts` | Vitest (every beat `holds`), then reduced-motion stills reviewed |
| c. Motion spec | `enter: { dur, ease, reduced, moves }` on each beat, tokens and `ease.ts` names only | review of the storyboard diff |
| d. Build | model, view (`mount`/unmount), `<Name>Figure.astro`, goals/controls, e2e spec | lint, typecheck, unit, e2e, budget, Lighthouse |
| e. Capture + review | `.frames/<figure>/<viewport>/{motion,reduced}/NN-<beat>.png` | `ui-reviewer` against the approved stills |

The reduced-motion path is built first and doubles as the stills renderer: it already has to place
everything instantly, so capturing it under `reducedMotion: "reduce"` gives the storyboard's stills
before any easing is written.

## How it extends the framework

- **`src/design/figure/storyboard.ts`** (new, test-only; nothing imports it from a view): the
  `Storyboard`, `Beat`, `Input`, `Transition` types, `framesOf()` (beats and their mids as numbered
  frames in time order) and `replayFixed()` (60 Hz fixed-step replay applying inputs when due).
  Inputs carry both a DOM selector (for capture) and a model action (for the replay), so one list
  drives both.
- **`e2e/frames.spec.ts`** (new, implemented): the frame-capture helper. It skips unless `PW_FRAMES`
  names a storyboard (or `all`), so CI never runs it; it's listed in `SPECS` as `["case-study"]`.
  Method: `page.clock.install()` then `pauseAt()` before navigation, so the figure's loop gets no
  frames until `page.clock.runFor()`; wait for `[data-playpause][data-ready]`; under reduced motion
  press Play as a reader would; then for each frame, apply due inputs as DOM `click()`s (not
  `locator.click()`, whose actionability checks wait on frames the paused clock withholds) and
  screenshot the figure with CSS animations finished. 16 ms fake frames never reach `MAX_DT`, and the
  speed stays 1, so sim time equals clock time. Checked on figure 1: two runs differ by at most 9
  antialiased pixels per still; the "full" beat shows exactly 12 queued snapshots.
- **`.gitignore`**: `.frames/`. Captures are review material; never committed, never baselines.
- **Worked example**: `src/worlds/satis/figures/outage.storyboard.ts` (+ test). The only change to
  shipped code is `export` on `CAPTION` in `outage-view.ts`, so the storyboard quotes the captions.

### Is Motion needed?

No. The jobs Motion would do here are already done, smaller, by code the figures control:
`loop.ts` is the clock (pause, speed, off-screen, sleep), `ease.ts` the curves, `squash` the
character, CSS tokens the DOM transitions. Adding it would cost more than bytes:

- Motion's React API needs hydrated React on the client; the figures ship none today, and
  react-dom alone is several times the 15 KB per-page budget.
- Its vanilla `animate()` is small but runs on its own clock, outside `startLoop`: the speed slider,
  pause, off-screen suspend and the seeded, seekable sim time (which frame capture relies on) would
  stop covering it.
- Springs and FLIP layout animation, its strengths, aren't what these diagrams do: orbs move along
  fixed SVG paths at model-decided times.

Revisit only if a figure needs layout animation of real DOM content that CSS can't do; then justify
it in that figure's spec against the budget.

## First pilot: satisfactory-dash architecture and data flow

**Question:** "Where does each piece run, and which way does every connection go?" The case study
explains the outage and the cutover; it has no picture of the whole system as deployed now.

**Sources** (Sour-Dev-Home/satisfactory-dash; re-read on `main` before building, since the
architecture's source of truth is `docs-vault/workspace.dsl`, ADR-0024, and the D2 files in
`docs-vault/wiki/architecture/` predate the AWS move and the edge agent):

- `workspace.dsl`, model: web app (React, TypeScript, Vite, TanStack Query), backend API (Node.js,
  Express), edge agent (`agent/`, ADR-0031), game-adapter package, PostgreSQL database; relations
  "web app calls the API (HTTPS JSON, HttpOnly session cookie)", "API reads and writes the database
  (SQL over TCP)", "agent pushes snapshots; polls commands (HTTPS, outbound only)", "agent reads the
  game (HTTPS and HTTP, loopback)".
- `workspace.dsl`, deployment: Cloudflare Workers static assets for `satis-manager.com`; AWS VPC
  with public subnets only, no NAT gateway, no load balancer, no inbound security-group rules; one ECS
  Fargate ARM task (0.5 vCPU, 1 GB) with a `cloudflared` sidecar holding an outbound-only tunnel,
  forwarding to the API on 127.0.0.1:3001; RDS for PostgreSQL 18 (db.t4g.micro, single-AZ, port 5432
  open to the task's security group only); SSM Parameter Store injecting `/satis/prod/*` at task
  start; EventBridge Scheduler starting the nightly backup ops task (`pg_dump`, encrypted with age)
  uploading to a private Backblaze B2 bucket (Object Lock, 30 days) with an upload-only key; the
  owner's gaming PC running only the game (FRM on loopback) and the agent (Scheduled Task, DPAPI
  secrets), no inbound ports.
- ADR-0031 (edge agent), ADR-0034 (backend on AWS), ADR-0035 (backups off AWS), and the case study's
  own sourced copy (`src/content/projects/satisfactory-dash/index.mdx`).

**Draft script** (owner to approve or cut):

1. *Load.* The browser gets the dashboard from Cloudflare Workers; nothing else is involved.
2. *Ask.* The dashboard calls `api.satis-manager.com`; Cloudflare carries the request down a tunnel
   that the AWS task opened outwards, to the backend on its own loopback.
3. *Store.* The backend reads and writes PostgreSQL in RDS, reachable only from the task.
4. *Report.* On the gaming PC, the agent reads the game over loopback and pushes a snapshot out the
   same way in; it also picks up any command waiting for it.
5. *Nothing connects in.* Every arrow starts on the inside: no open port on the PC, no inbound rule
   on AWS. (A goal: "find an inbound connection"; the figure shows there is none.)
6. *Night.* The scheduler starts the backup task: an encrypted dump leaves AWS for B2, through a
   key that can write but not delete.

Interaction (proposal): three toggles, *Request*, *Snapshot*, *Backup*, each sending one token
along its path, with beats 1-4 and 6 as the paths and beat 5 as a "show direction" view that lights
every connection at its origin. Step-driven (like the cutover), so the storyboard's inputs are button
presses. Desktop and phone layouts as in `layouts.ts`. It reuses the satis world's tokens
(`--satis-snapshot`, `--satis-backup`, `--satis-route`) so the same thing is the same colour as in
figures 1 and 2.

## Performance, Lighthouse, reduced motion

- First paint is static, full-size SVG markup (no layout shift); the view loads via `whenVisible`.
- The case-study page stays within its 15 KB gzipped budget with all three figures; if the pilot
  pushes it over, the figure is cut down, the budget isn't raised without the owner.
- Lighthouse mobile ≥ 90 performance and accessibility on every page, unchanged.
- One loop per figure, suspended off-screen, asleep when nothing moves. Animate SVG `transform` and
  `opacity` only.
- Reduced motion: each beat's `reduced` is `instant` (moves land at once, steppers still step) or
  `hold` (opens paused on a meaningful frame). Never a slowed-down version. The e2e figure spec
  checks it, and capture produces a reduced set of stills for review.
- The loading-state rules in `docs/STYLE.md` (nothing overlaps at 0/50/100 % of an animation) and
  `labelCollisions` apply on both layouts.

## Review flow

1. Script approved by the owner (in the issue or PR).
2. Storyboard PR: model, storyboard + `holds` test, drawings, reduced-motion view, reduced stills
   attached to the PR conversation. Owner approves the stills.
3. Motion PR: motion spec filled, motion and reduced stills attached; `ui-reviewer` (fresh subagent)
   compares them with the approved stills and the storyboard; `test-hunter` on the model.
4. If the page's look changed: **Update screenshots** workflow on the branch, check the artifact,
   commit its baselines. Then the usual CI and deploy-preview review before merging.

## Community skills

All three are third-party content: read in full and reviewed before any install, and none is
installed by this change.

| Skill | What it is | Verdict | Borrow |
|---|---|---|---|
| jezweb/claude-skills `motion` | The Motion React library's API (gestures, scroll, layout, `AnimatePresence`) and its gotchas. The listing installs it with `npx skills add jezweb/claude-skills --skill motion`. The SKILL.md is no longer on the repo's `main` (its plugin folders have no `motion` skill), so only the listing could be read. | Don't adopt: it teaches the library this design rejects. | Nothing specific; its "useAnimate is 2.3 KB" figure is the honest size of the vanilla path, noted above. |
| nexu-io/open-design `emilkowalski-motion` (`skills/emilkowalski-motion/SKILL.md`) | A restrained motion polish pass: transform and opacity only, about 140-220 ms for controls, one motion language, no decorative loops, reduced-motion fallbacks, clean up observers and timers. No curves given; depends on its repo's other craft skills. | Don't install (it assumes its own design-system skills); borrow its rules. | "One consistent motion language", "no endless loops unless they show status", "stagger only small groups", "clean up every observer and timer": all now in the skill's step 3/4. |
| daffy0208/ai-dev-standards `animation-designer` | Framer Motion recipes plus CSS keyframes; 200-400 ms for UI, under 100 ms abrupt, over 500 ms sluggish; ease-out by default; `useReducedMotion` to zero durations; transform/opacity only. Installs `framer-motion`. | Don't adopt (library-specific, and "zero the durations" is weaker than this site's rule, which also removes stagger delays). | The duration bands as a sanity check on `--dur` (250 ms) and `--dur-slow` (600 ms, used only for page reveals). |

## Open questions for the owner

1. Pilot placement: a new section near the top of the satisfactory-dash case study ("How it fits
   together", before "How data gets in"), or replace the long description's architecture sentences?
2. Pilot scope: all six beats, or drop *Night* (backups) since figure 2 already shows B2?
3. Who approves stills for a rework of an existing figure: the owner, or `ui-reviewer` alone?
4. `ui-reviewer` needs a Playwright MCP that today is configured for satisfactory-dash only; should
   this repo get the same project-scoped config, or does it review the captured PNGs only?
5. Should storyboard `holds` tests also run against the other existing figures (cutover, lanes),
   as retroactive storyboards, or only for new figures?
