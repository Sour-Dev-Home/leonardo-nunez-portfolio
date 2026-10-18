# The lanes world (Phase 2): design

Status: design approved by the owner in conversation on 2026-10-18 (takeaway A, figure A, outline below). This
written spec still needs the owner's review before the plan is written.

Built directly on a branch, with CI, preview deploys and owner review as the gate. The owner decided on 2026-10-18
not to adopt lanes in this repository.

## 1. Goal

The page should leave a hiring manager believing this: **Leonardo built a delivery system that lets AI sessions ship
to `main` unattended, without breaking it.**

The pipeline leads the page. The trial lessons are supporting evidence: what failed, and what changed because of it.
The page pairs with the satisfactory-dash case study, as "the system that built that".

The page is equally clear that lanes is not a perfect tool (owner, 2026-10-18: "employers like seeing you consider
it"). Its limits and design trade-offs get their own section, with Conway's law as the central example. That
section is written as engineering judgment: what each cost, what was measured, what changed, and when not to use
lanes at all.

Length and form follow the satis world: a short main read, with deeper material in closed "More detail" sections.
Every claim links to its source in the public lanes repository
(`https://github.com/Sour-Dev-Home/lanes/blob/main/<path>`) or in satisfactory-dash.

## 2. The article

Headings (the dist test pins them):

1. **The problem.** One developer and many parallel AI sessions. `main` deploys, so it must never break, and nobody
   is watching at night. Required checks are the only gatekeeper: no session can merge by being persuasive.
2. **How a lane ships.** One fresh session per GitHub issue, in its own worktree. Then fresh reviewer agents, then
   `lanes/gate`, then the merge queue. Followed by the figure.
3. **What it refuses.**
   - Fail-closed by default: an unread input, an unknown permission or a truncated file list are all treated as "no".
   - The honest limit, stated plainly: the gate stops honest mistakes and strangers, not a lane that turns hostile
     (`docs/SECURITY.md`, "What lanes does not protect against").
4. **Results.** The numbers listed under "Claims and their sources".
5. **Limits and trade-offs.** A main section, not a footnote. Each point names the cost, the evidence, and what
   changed or stayed:
   - **Conway's law.** Lanes communicate only through issues, and each sees only its own files. So the system was
     built in file-sized slices: holistic changes were split, then queued in series by the overlap check anyway, and
     the owner had to merge issues back together by hand. The tool's own structure shaped the structure of the work.
     - Measured: one ~200-line change became four serial lanes (#525–#528), at about 15M tokens and three merge
       waits, against about 6–8M for a single lane.
     - The response: split issues by size, not by module. A floor of about 100 changed lines, a ceiling of 300.
       Contracts are still split out when other work consumes them.
     - The same pattern came back when a planned restructure added machinery instead of removing it. That phase was
       deferred.
   - **Fixed start-up cost.** Every lane pays to read its own context and run its own reviewers. A lane under 50
     changed lines costs four to five times more per line than one of 150 or more. Small or tightly coupled work is
     cheaper in one session.
   - **Guards are a patch chain.** A text filter guarding a shell can always be dodged, so each fix (#308, #378, #404,
     #424, #441) closed the gap the previous review found, and the chain has no natural end. That is why the real
     gatekeeper is the required checks on GitHub, which judge results, not intent.
   - **It depends on one machine.** The queue and every lane run on the owner's computer. When it sleeps, nothing
     launches or gets fixed, though GitHub's side keeps moving. This was recorded and deliberately deferred.
   - **Not hands-off.** Approvals, launches and upgrades stay with the owner by design. An early "solo" mode that let
     lanes act as the owner was retired because it introduced bugs (ADR 0025).
   - **Security limits, stated.** It does not protect against a compromised owner, vulnerabilities in the code lanes
     write, prompt injection outside the gates, or personal data the scan isn't told about.
   - **When not to use it.** This portfolio: one person, a small static site, a few PRs a week. The owner decided on
     2026-10-18 that lanes isn't worth adopting here, and this site's own CI and review are enough.
6. **How it was built.** lanes was built with lanes: its own PRs went through its own gate. The section ends on
   what's next. The owner reviews the draft.

### Claims and their sources

Each claim is checked against its source before the article is committed. Any claim that doesn't hold is cut.

| Claim | Source |
|---|---|
| 365 lane PRs merged into lanes itself, 2026-09-27 to 2026-10-18 | `gh pr list -R Sour-Dev-Home/lanes --state merged --search head:issue-` (re-count before publishing) |
| 22 lane PRs merged into satisfactory-dash, 2026-10-14 to 2026-10-17 | the same query on satisfactory-dash (re-count) |
| Median tokens per lane by size, from 2.4M (0–50 lines) to 17.1M (500–1,000 lines), and important or critical review findings per 100 changed lines around 0.2 | `docs/history/2026-09-30-lane-size-and-cost.md` (76 lanes measured) |
| Reviewers chosen by tier and by the files touched | `scripts/lanes/lib.mjs` `requiredReviewers` |
| The gate's stages and its fail-closed reads | `scripts/lanes/lib.mjs` `gateDecision`; `scripts/lanes/gate.mjs` `decideForPr` |
| The merge queue re-decides from live inputs, never from a status already on the head | `gate.mjs` (comment on `decideForPr`, R3) |
| A trial lane stopped because the issue's Scope didn't name every file | satisfactory-dash lane #386 (confirm the link) |
| 34 decision records | `docs/adr/` (re-count) |
| Conway's law: file-sized slices, split then serialized, issues merged back by hand | `docs/history/2026-09-29-lanes-v0.1.0-snapshot.md`; `docs/history/2026-09-30-phase-2-deferred.md` |
| #525–#528: ~15M tokens and three merge waits, against ~6–8M as one lane; split by size with a floor of ~100 and a ceiling of 300 lines | `docs/history/2026-09-30-lane-size-and-cost.md` ("What the numbers say", "Decision") |
| Lanes under 50 lines cost four to five times more per line | the same note |
| Guards as a patch chain (#308, #378, #404, #424, #441) | `docs/history/2026-09-29-lanes-v0.1.0-snapshot.md` |
| The queue stops when the owner's machine sleeps; deferred | `docs/history/2026-10-02-lanes-depends-on-the-owners-machine.md` |
| Solo profile retired because it introduced bugs | `docs/history/2026-10-01-retire-solo-profile.md`, ADR 0025 |
| What lanes does not protect against | `docs/SECURITY.md` |
| Not adopted in this portfolio | the owner's decision, 2026-10-18; closed PR #41 in this repository |

### Sidenotes

Optional. Each needs the owner's approval and is written in the owner's words. None are chosen yet.

## 3. The cover

Same pattern as satis:
- a CSS-only `Cover.astro` in `src/worlds/lanes/`, rendered by `scripts/render-covers.mjs` into
  `public/covers/lanes.png` (1600 × 900) and `public/og/lanes.png` (1200 × 630);
- shown on the work card and in link previews, never on the page itself (the owner's ruling on satis);
- its drawing: an issue, a lane and a merged PR, with the gate between them.

`render-covers.mjs` gains a list of covers, so it no longer hard-codes satis.

## 4. The figure: one lane's path

### Stations

Task issue → contract check → lane (a fresh session in a worktree) → PR → reviewers → `lanes/gate` → merge queue →
`main`.

- Icons, not boxes, with labels below them.
- A PR token travels along the path, using the same motion standard as the satis figures: easing, a dt clamp, and
  orbs that spawn behind stations.
- The caption shows the gate's real status text, for example "waiting for review/test-hunter",
  "waiting for a code-owner review in GitHub", "unattended-eligible (tier:quick), reviews in".

### Switches

Toggle buttons in the control bar. Stations are not focusable; the toggles are the keyboard path, as on satis.

1. **Sloppy task form.** The contract check refuses the issue: it never gets the `ready` label, so the queue
   launches nothing. The token stops at the contract station, and the caption names the missing field.
2. **A reviewer finds a bug.** `test-hunter` posts a failing verdict. The lane fixes it and pushes a new commit, and
   the reviews run again, because a verdict covers only the commit it names.
3. **Touches the rules.** The change touches an owner path such as `.github/` or `lanes.config.json`.
   `security-reviewer` joins the reviewers, and the PR waits at the gate for the owner's code-owner review. A
   "You approve" action releases it.
4. **Another PR merges first.** In the merge queue the gate decides again on the merged commit, from live inputs. A
   still-valid PR passes; a PR whose base conflicts goes back to the lane.

Each switch adds one goal to the goals list, as on satis.

### Model

`src/worlds/lanes/model/gate.ts` is a pure function that mirrors `gateDecision` for the subset the figure shows:
- the tier and contract checks;
- required reviewers by tier and path class;
- verdicts tied to the head commit;
- the owner path;
- the ready state.

Its tests cite the lanes source by file and function, and reproduce the status strings verbatim. Where the figure
simplifies (one reviewer failing at a time, no blockers, no handover stage), a comment says so.

## 5. Architecture

- `src/worlds/lanes/`: `world.css` (tokens scoped to `.world-lanes`), `Cover.astro`, `figures/` (drawing, figure,
  view, layouts), `model/`.
- Reuses `src/design/figure/` (the loop, lazy loading, controls, goals, responsive) and the satis `Station` pattern.
  Shared station icons move to `src/design/figure/` only if a second world needs them; otherwise lanes gets its own.
- `src/content/projects/lanes/index.md` becomes `index.mdx`, with a body, `world: true` and `cover`/`ogImage`. The
  case-study route and layout already handle worlds.
- JavaScript budget: `projects/lanes.html` gets 15 KB in `tests/dist/budget.ts`; every other page stays at 0.
- The layout's `world` prop takes the world's name from the frontmatter, not the hard-coded "satis".

## 6. Phones, reduced motion and accessibility

- A vertical phone composition below 40rem, with labels to the right, as on the satis outage figure.
- Reduced motion: no autoplay, and a meaningful paused frame.
- The figure is `role="img"`, with labelled controls outside it.
- Focus stays on stepper buttons at the ends (`aria-disabled`, the satis fix).
- axe is clean in light and dark.

## 7. Testing

- **Unit:** the model, one test per gate rule it mirrors.
- **Dist:**
  - headings, links to sources and closed "More detail" sections;
  - "Limits and trade-offs" sits in the main read, not inside a closed section, and names Conway's law;
  - the budget and module-only scripts;
  - the stills at their sizes;
  - the og image.
- **e2e** (the satis suite, adapted):
  - each switch reaches its stop and ticks its goal;
  - keyboard only, including Tab to the controls;
  - reduced motion;
  - no line crosses a label, at every step and on phones, with a generous allowance for CI's wider fonts;
  - the resize remount.
- Screenshot baselines come only from the Update screenshots workflow.

## 8. Colour (deferred)

A palette round once the figure exists. The world needs its own colours, distinct from satis's amber, and the same
fixed roles: the token, pass, fail, wait-on-owner, and one tint per stage group.

## 9. The owner's part

- Review this spec, then the plan.
- Review the figure in the companion: desktop, then phones.
- The ~10-minute draft read.
- The palette pick.
- Any sidenotes.

## Out of scope

- Figure B (a night of parallel lanes from real data). A possible follow-up static chart.
- Adopting lanes in this repository (the owner's decision, 2026-10-18).
- Changes to lanes itself.
