---
name: storyboard-motion
description: Use when building or reworking an interactive explainer figure (an animated diagram, simulation or architecture/data-flow figure) on this site's figure framework (src/design/figure, src/worlds/*). Runs script, storyboard, motion spec, build, then frame capture and review, so the figure is agreed as stills before any motion is written.
---

# Storyboarded explainer figures

A figure here is a samwho.dev-style explainer: a pure, seeded model; an SVG view that only draws the
model; one frame loop; goals the reader ticks off; a caption that says what is happening. The steps
below are in order. Don't write motion before the stills are approved. Design spec:
`docs/superpowers/specs/2026-10-20-storyboarded-explainer-figures-design.md`.

Worked example of every artifact: figure 1 on the satisfactory-dash case study
(`src/worlds/satis/model/outage.ts`, `figures/outage-view.ts`, `figures/OutageFigure.astro`,
`figures/outage.storyboard.ts`, `figures/outage.storyboard.test.ts`). The lanes world
(`src/worlds/lanes/`) is a second, step-and-dwell example.

## 1. Script: what the figure teaches

Write it in the PR description (or the world's spec under `docs/superpowers/specs/`), before code:

- **The one question** the figure answers, in the case study's words.
- **Beats:** 3 to 6 lines, one idea each, in reading order. If a beat needs "and", split it.
- **Sources:** every rule the model encodes cites the real repo file, ADR or runbook it comes from
  (see the headers of `outage.ts` and `cutover.ts`). Nothing invented; if a fact isn't in a source,
  it isn't in the figure. The portfolio's "don't claim what isn't verified" rule applies.
- **Goals:** what the reader does (`Goals.astro`, ticked with `tickGoal` from `controls.ts`).
  Usually one goal per beat that needs an action.

## 2. Storyboard as data

Build the model first: `src/worlds/<world>/model/<name>.ts`, pure TypeScript, no DOM. Time-driven
models are `step(state, dt, random)` with `seeded(n)` from `src/worlds/satis/model/random.ts`;
step-driven ones are `viewAt(step)` (`cutover.ts`). Unit-test the rules against their sources.

Then the storyboard: `src/worlds/<world>/figures/<name>.storyboard.ts`, exporting a
`Storyboard<State>` (types in `src/design/figure/storyboard.ts`):

```ts
interface Beat<S> {
  id: string;                    // kebab-case: the still's file name
  teaches: string;               // the beat's one idea, from the script
  caption: string;               // the figure's caption at this beat, word for word (import it from the view)
  at: number;                    // sim seconds since mount
  mids?: number[];               // sim times to capture on the way in (mid-transition stills)
  enter?: Transition;            // the motion spec into this beat (step 3)
  holds: (s: S) => true | string // the model is in this beat; a string says what's wrong
}
// Storyboard<S>: { figure (data-figure), page (built path), seed, inputs, beats, replay(at, inputs) }
// Input<S>: { at, click (selector inside the figure), apply(s) (the same action on the model) }
```

A step figure is the same thing: its inputs are clicks on its Next button, and `replay` counts them.
Use `replayFixed(init, step, at, inputs)` for time-driven models. Add
`<name>.storyboard.test.ts` that asserts every beat `holds` at its `at` (copy the outage one): the
storyboard is then checked against the model, and a model change that breaks a beat fails CI.
Only tests import a storyboard; it never ships to the browser.

**Stills before motion.** Build the static drawing (`<Name>Drawing.astro`, one per layout, desktop
and phone, fixed coordinates in `layouts.ts`) and a view whose reduced-motion path places everything
instantly (that path is required anyway). Capture the beats under reduced motion (step 5) and get the
stills approved: by the owner for a new figure, by `ui-reviewer` for a rework. Only then write motion.

## 3. Motion spec

Fill `enter` on every beat after the first: `{ dur, ease, reduced, moves }`.

- `dur`: `"fast" | "base" | "slow"` (CSS tokens `--dur-fast` 150 ms, `--dur` 250 ms, `--dur-slow`
  600 ms in `src/design/tokens.css`) for DOM/CSS changes such as a station turning red; a number
  (sim seconds, scaled by the speed slider) for movement the view computes per frame.
- `ease`: `"ease-out"` / `"ease-in-out"` (tokens) for CSS; `inOutCubic`, `inOutSine`, `outQuad` from
  `src/design/figure/ease.ts` for per-frame movement; `squash()` there for landings. No new curve
  without a reason in the spec. Things entering ease out; things travelling between places ease in
  and out; nothing bounces except a landing.
- `reduced`: `"instant"` (moves land at once, the stepper still steps) or `"hold"` (the figure opens
  paused on a meaningful frame, like `outage-view.ts` pre-running 160 steps). Never a slower or
  smaller version of the motion.
- `moves`: one line of what moves. If two things move at once in different directions, ask whether
  that's two beats.

## 4. Build: model, view, loop

- `<name>-view.ts` exports `mount(root, kept) => unmount`. It reads the model and draws; it decides
  nothing. Copy the shape of `outage-view.ts`: `startLoop(onFrame, { autoplay: kept.playing ?? !reduced })`
  and `whileOnScreen` from `loop.ts`; `wireControls(root, loop, onReset)` and `tickGoal` from
  `controls.ts`; `prefersReducedMotion()`; return a function that removes every listener.
- A frame with nothing left to move returns `false`, and the loop sleeps until `wake()`.
- `<Name>Figure.astro`: `Goals`, `<figure class="fig" data-figure="<name>">`, both drawings,
  `Controls` (figure buttons in its slot, `aria-pressed` toggles), a `.fig-caption` with
  `aria-live="polite"`, and a script that runs `whenVisible(el, () => import("./<name>-view")
  .then((m) => mountResponsive(el, m.mount)))` (`lazy.ts`, `responsive.ts`). The first paint is
  static markup at full size; the script loads only near the viewport.
- Set `data-ready` on `[data-playpause]` once mounted (frame capture and e2e wait for it).
- Seed: the view's `seeded(n)` and the storyboard's `seed` must match.
- Styles: `figure.css` and the world's `world.css`, design tokens only (no raw colours or durations).
- Budgets: gzipped JS per page in `tests/dist/budget.ts` (15 KB for a case study); Lighthouse mobile
  ≥ 90 (`lighthouserc.json`). No runtime dependency: `loop.ts` and `ease.ts` already do what an
  animation library would here.
- e2e: a figure spec like `e2e/figures.spec.ts` (renders before its script, goals tick, keyboard
  only, reduced motion opens paused or instant, `labelCollisions` from `e2e/figures.ts` on both
  layouts). List any new spec in `SPECS` in `e2e/pages.ts`; per-page loops need `{ tag: pageTag(name) }`.

## 5. Frame capture and review

Register the storyboard in `BOARDS` in `e2e/frames.spec.ts`, then, after `npm run build`:

```sh
PW_FRAMES=<figure> npx playwright test frames --project=desktop-1280 --project=phone-390
```

It installs Playwright's fake clock paused, opens `page`, waits for `[data-playpause][data-ready]`,
then advances the page clock to each frame's `at` (applying `inputs` as DOM clicks when due) and
screenshots the figure. Stills land in `.frames/<figure>/<project>/{motion,reduced}/NN-<beat>.png`
(git-ignored; mids are skipped under reduced motion). Runs repeat to within a few pixels of
antialiasing. The spec skips unless `PW_FRAMES` is set, so CI never runs it.

Review: spawn `ui-reviewer` as a fresh subagent with the storyboard file, the approved stills and the
new captures. It checks each still against its beat (the right state, the caption, nothing
overlapping, tokens only, both layouts, reduced motion matching its `reduced` rule) and reports
approve or changes requested. Attach the stills to the PR conversation, never to the repo.

Never commit captures. Visual-regression baselines in `e2e/__screenshots__/` come only from the
**Update screenshots** workflow in the Playwright container; when a figure changes the page's look,
run that workflow on the branch and commit its images.

## Checklist

- [ ] Script with sources; beats one idea each; goals.
- [ ] Model + unit tests; storyboard + `holds` test passing.
- [ ] Reduced-motion stills captured and approved before motion.
- [ ] Motion spec on every beat; tokens and `ease.ts` only.
- [ ] View, figure, e2e spec, `SPECS`; budgets and Lighthouse pass.
- [ ] Motion stills captured; `ui-reviewer` approves; baselines from the workflow.
