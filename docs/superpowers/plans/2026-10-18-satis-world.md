# The satis-manager world (Plan 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/projects/satisfactory-dash` as a short, sourced case study with a CSS-animated cover and two interactive, code-faithful figures (a backend outage, the AWS cutover).

**Architecture:** The figures are Astro components that render their first frame as static SVG and HTML at build time, plus a small TypeScript module each, loaded when the figure scrolls into view. Behaviour lives in pure, unit-tested model files that mirror the agent's real code (`queue.ts`, `pusher.ts`, `backoff.ts`) and the AWS runbook; the view code only draws model state. The cover is CSS-only. React stays a build-time renderer; no framework or animation library ships to the browser.

**Tech Stack:** Astro 7.4 (static, MDX), TypeScript, plain DOM and SVG, CSS custom properties, Vitest, Playwright, sharp.

**Spec:** `docs/superpowers/specs/2026-10-18-satis-world-design.md` (approved by the owner 2026-10-18). Approved prototypes: `docs/superpowers/specs/2026-10-18-satis-world/{cover,figure-outage,figure-cutover}.html`; when a step says "as the prototype", read that file.

## Global Constraints

- Only the case-study page may run JavaScript; its budget is **15 KB gzipped** (`tests/dist/budget.ts`). Every other page stays at zero runnable JavaScript (existing tests).
- No React, Lit, Motion or other runtime library in the browser. React is used at build time only.
- A figure's first frame is static markup with its final size: no layout shift when its script runs.
- Figures model the real system; only time is scaled. Every rule in a model file cites its source path in `Sour-Dev-Home/satisfactory-dash`.
- One meaning per mark; marks are named in the prose before the figure (coloured inline words), never in a legend. Red means failure only; something stopped on purpose dims.
- A station's disc keeps its panel colour when the station dims; dim the icon and labels, never the disc.
- No line, path or icon may cross any text label, in any state, including mid-animation (tested).
- No numbers on screen in figure 1 (no queue counts). No step numbers anywhere in figure 2.
- Reduced motion: no autoplay, figures open paused on a deterministic frame, tweens run in zero time, every control still works; the cover is a still.
- Phones (360 and 390 px) are a hard requirement: figures switch to vertical compositions below 40rem.
- Colours are placeholders in world-scoped tokens (`--satis-*`) until the owner's palette round (Task 11).
- Copy: plain, first person, specific; no "leverage", "seamless", "robust solution" (docs/STYLE.md). Every factual claim links to its source; the summary frontmatter stays ≤ 125 characters.
- Never commit screenshots made outside the Playwright container; baselines come from the "Update screenshots" workflow.
- No personal data or local paths in commits (the site's public name, email, GitHub and LinkedIn are the deliberate exception).

## Review Focus

1. **A reader who leaves a figure running in a background tab and comes back:** the frame loop must clamp `dt` (≤ 0.05 s per frame), so it doesn't fast-forward or pile up orbs. Test owned by Task 4 (`loop.test.ts`: a 10 s gap advances by at most 0.05 s).
2. **Toggling the backend or database many times very fast:** the model must stay consistent (at most one flight, the queue never above capacity, no duplicate snapshots). Test owned by Task 2 (a randomised toggle storm keeps the invariants).
3. **Pressing Next or Roll back while a backup or restore animation is still running:** the stepper must ignore the press, never land in a mixed state. Test owned by Task 8 (e2e: Next pressed during the dump leaves the view equal to `viewAt(2)`).
4. **Resizing across 40rem (rotating a phone) while a figure runs:** the view must remount on the other layout without duplicate loops or leftover dots. Test owned by Task 9 (e2e: resize 1280 → 390 → 1280, no dots left in the hidden SVG, no more than capacity + 1 in the visible one).
5. **Keyboard-only use:** every control and every clickable station reachable and operable with Tab/Enter/Space, with visible focus. Test owned by Task 7 and Task 8 (e2e keyboard walkthroughs).

---

## File structure

| Path | Responsibility |
|---|---|
| `src/worlds/satis/model/backoff.ts` | `backoffDelay`, mirroring `agent/src/backoff.ts` |
| `src/worlds/satis/model/outage.ts` | Figure 1's model: queue, push, retry, failures |
| `src/worlds/satis/model/cutover.ts` | Figure 2's model: the runbook's states and copy |
| `src/worlds/satis/model/random.ts` | `seeded(seed)`: deterministic random for paused frames and tests |
| `src/design/figure/ease.ts` | Easing functions and the squash-and-stretch transform |
| `src/design/figure/loop.ts` | Frame loop: dt clamp, pause, visibility, reduced motion |
| `src/design/figure/lazy.ts` | `whenVisible(el, load)` |
| `src/design/figure/Controls.astro` | Control bar markup (reset, slider, actions, play/pause) |
| `src/design/figure/Goals.astro` | Goals checklist markup |
| `src/design/figure/controls.ts` | Wiring for the slider, play/pause and goals |
| `src/design/figure/figure.css` | Shared figure styles |
| `src/worlds/satis/world.css` | `--satis-*` tokens (placeholders) and world styles |
| `src/worlds/satis/Station.astro` | One station: disc, icon, label, sub-label |
| `src/worlds/satis/figures/OutageFigure.astro` + `outage-view.ts` | Figure 1 markup and view |
| `src/worlds/satis/figures/CutoverFigure.astro` + `cutover-view.ts` | Figure 2 markup and view |
| `src/worlds/satis/figures/layouts.ts` | Station coordinates for desktop and phone compositions |
| `src/worlds/satis/Cover.astro` | The cover (CSS-only motion) |
| `src/worlds/index.ts` | `covers` registry: slug → cover component |
| `scripts/render-covers.ts` | Renders the cover stills from `/kit` with Playwright |
| `src/content/projects/satisfactory-dash/index.mdx` | The article (replaces `index.md`) |
| `e2e/figures.ts` | Shared e2e helpers: `labelCollisions(page)` |
| `e2e/figures.spec.ts` | Figure behaviour, keyboard, reduced motion, collisions |

---

### Task 1: Backoff and seeded random

**Files:**
- Create: `src/worlds/satis/model/backoff.ts`, `src/worlds/satis/model/random.ts`
- Test: `src/worlds/satis/model/backoff.test.ts`

**Interfaces:**
- Produces: `backoffDelay(attempt: number, base: number, max: number, random: () => number): number`; `seeded(seed: number): () => number` (mulberry32, values in [0, 1)).

- [ ] **Step 1: Write the failing test**

```ts
// src/worlds/satis/model/backoff.test.ts
import { describe, it, expect } from "vitest";
import { backoffDelay } from "./backoff";
import { seeded } from "./random";

describe("backoffDelay (mirrors agent/src/backoff.ts)", () => {
  it("is exponential from the base with equal jitter: half fixed, half random", () => {
    expect(backoffDelay(0, 1, 60, () => 0)).toBe(0.5);
    expect(backoffDelay(0, 1, 60, () => 0.999999)).toBeCloseTo(1, 4);
    expect(backoffDelay(3, 1, 60, () => 0)).toBe(4); // ceiling 8, half fixed
  });
  it("is capped at the maximum", () => {
    expect(backoffDelay(10, 1, 60, () => 0.999999)).toBeCloseTo(60, 3);
    expect(backoffDelay(1000, 1, 60, () => 0)).toBe(30);
  });
  it("treats a negative or non-finite attempt as the first", () => {
    expect(backoffDelay(-4, 1, 60, () => 0)).toBe(0.5);
    expect(backoffDelay(Number.NaN, 1, 60, () => 0)).toBe(0.5);
  });
});

describe("seeded", () => {
  it("repeats the same sequence for the same seed, in [0, 1)", () => {
    const a = seeded(7), b = seeded(7);
    const xs = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/worlds/satis/model/backoff.test.ts --reporter=dot`
Expected: FAIL, cannot resolve `./backoff`.

- [ ] **Step 3: Implement**

```ts
// src/worlds/satis/model/backoff.ts
/**
 * Retry waits, as the agent computes them (agent/src/backoff.ts in Sour-Dev-Home/satisfactory-dash):
 * exponential from `base`, capped at `max`, then "equal jitter" — half the ceiling fixed, half random —
 * so agents that lost the backend together don't come back together. Units are the caller's (the figure
 * uses scaled seconds; the agent uses 1 s → 60 s).
 */
export function backoffDelay(attempt: number, base: number, max: number, random: () => number): number {
  const exponent = Number.isFinite(attempt) ? Math.min(Math.max(0, Math.floor(attempt)), 30) : 0;
  const ceiling = Math.min(max, base * 2 ** exponent);
  return ceiling / 2 + random() * (ceiling / 2);
}
```

```ts
// src/worlds/satis/model/random.ts
/** mulberry32: a small deterministic generator, so a paused frame and every test are repeatable. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/worlds/satis/model/backoff.test.ts --reporter=dot`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/worlds/satis/model
git commit -m "Add the agent's backoff and a seeded random for the satis figures"
```

### Task 2: The outage model (figure 1)

**Files:**
- Create: `src/worlds/satis/model/outage.ts`
- Test: `src/worlds/satis/model/outage.test.ts`

**Interfaces:**
- Consumes: `backoffDelay`, `seeded` (Task 1).
- Produces:

```ts
export type Target = "tunnel" | "backend" | "db";
export interface OutageTiming { sampleEvery: number; arrive: number; minDwell: number; trip: Record<Target, number>; drainFactor: number; backoffBase: number; backoffMax: number; }
export const SCALED: OutageTiming;
export const CAPACITY = 12;
export interface Snapshot { id: number; takenAt: number; seatedAt: number | null }
export interface Flight { id: number; target: Target; ok: boolean; phase: "out" | "back"; startedAt: number; duration: number; dropped: boolean }
export type OutageEvent =
  | { kind: "sampled"; id: number } | { kind: "dropped"; id: number; inFlight: boolean }
  | { kind: "sent"; id: number; target: Target } | { kind: "stored"; id: number }
  | { kind: "error"; id: number; at: Target } | { kind: "requeued"; id: number } | { kind: "discarded"; id: number };
export interface OutageState { t: number; nextSample: number; nextTry: number; failures: number; nextId: number; queue: Snapshot[]; flight: Flight | null; backendUp: boolean; dbUp: boolean; events: OutageEvent[] }
export function initialOutage(): OutageState;
export function stepOutage(s: OutageState, dt: number, random: () => number, timing?: OutageTiming): OutageState; // mutates and returns s; s.events holds this step's events only
export function setBackendUp(s: OutageState, up: boolean): void;
export function setDbUp(s: OutageState, up: boolean): void;
```

- [ ] **Step 1: Write the failing tests**

```ts
// src/worlds/satis/model/outage.test.ts
import { describe, it, expect } from "vitest";
import { CAPACITY, SCALED, initialOutage, setBackendUp, setDbUp, stepOutage, type OutageEvent, type OutageState } from "./outage";
import { seeded } from "./random";

function run(s: OutageState, seconds: number, random = seeded(1)): OutageEvent[] {
  const all: OutageEvent[] = [];
  for (let t = 0; t < seconds; t += 0.02) all.push(...stepOutage(s, 0.02, random).events);
  return all;
}
const kinds = (es: OutageEvent[], k: OutageEvent["kind"]) => es.filter((e) => e.kind === k);

describe("outage model (agent/src/queue.ts, pusher.ts, backoff.ts)", () => {
  it("with everything up, every snapshot is stored and the queue stays short", () => {
    const s = initialOutage();
    const es = run(s, 30);
    expect(kinds(es, "stored").length).toBeGreaterThanOrEqual(kinds(es, "sampled").length - 2);
    expect(s.queue.length).toBeLessThanOrEqual(2);
  });

  it("every snapshot rests in the queue at least minDwell before it is sent", () => {
    const s = initialOutage();
    const seatedAt = new Map<number, number>();
    for (let i = 0; i < 1500; i++) {
      const before = s.t;
      stepOutage(s, 0.02, seeded(i));
      for (const q of s.queue) if (q.seatedAt !== null && !seatedAt.has(q.id)) seatedAt.set(q.id, q.seatedAt);
      for (const e of s.events) if (e.kind === "sent") expect(before + 0.02 - seatedAt.get(e.id)!).toBeGreaterThanOrEqual(SCALED.minDwell - 1e-9);
    }
  });

  it("backend down: the error comes back from the tunnel and the snapshot stays at the head", () => {
    const s = initialOutage(); run(s, 3); setBackendUp(s, false);
    const es = run(s, 6);
    expect(kinds(es, "error").every((e) => e.kind === "error" && e.at === "tunnel")).toBe(true);
    expect(kinds(es, "requeued").length).toBeGreaterThan(0);
    expect(kinds(es, "stored")).toEqual([]);
  });

  it("database down: the error comes back from the backend", () => {
    const s = initialOutage(); run(s, 3); setDbUp(s, false);
    const es = run(s, 6);
    expect(kinds(es, "error").length).toBeGreaterThan(0);
    expect(kinds(es, "error").every((e) => e.kind === "error" && e.at === "backend")).toBe(true);
  });

  it("each retry waits longer than the last (until the cap), and success resets the waits", () => {
    const s = initialOutage(); run(s, 2); setBackendUp(s, false);
    const sentAt: number[] = [];
    for (let i = 0; i < 2500; i++) { stepOutage(s, 0.02, () => 0); if (s.events.some((e) => e.kind === "sent")) sentAt.push(s.t); }
    const gaps = sentAt.slice(1).map((t, i) => t - sentAt[i]);
    for (let i = 1; i < Math.min(gaps.length, 4); i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    setBackendUp(s, true); run(s, 3);
    expect(s.failures).toBe(0);
  });

  it("a full queue drops the OLDEST, never the newest, and never holds more than its capacity", () => {
    const s = initialOutage(); setBackendUp(s, false);
    const es = run(s, 40);
    const dropped = kinds(es, "dropped").map((e) => e.id);
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped).toEqual([...dropped].sort((a, b) => a - b)); // oldest first
    expect(s.queue.length).toBeLessThanOrEqual(CAPACITY);
    const newest = Math.max(...kinds(es, "sampled").map((e) => e.id));
    expect(dropped).not.toContain(newest);
  });

  it("the head being sent keeps its place; if it's dropped in flight it is discarded when its error returns", () => {
    const s = initialOutage(); setBackendUp(s, false);
    const es = run(s, 60, () => 0.99); // long waits: the queue fills while one is away
    const inFlightDrops = kinds(es, "dropped").filter((e) => e.kind === "dropped" && e.inFlight).map((e) => e.id);
    expect(inFlightDrops.length).toBeGreaterThan(0);
    for (const id of inFlightDrops) expect(es.some((e) => e.kind === "discarded" && e.id === id)).toBe(true);
  });

  it("after recovery the backlog drains oldest first", () => {
    const s = initialOutage(); setBackendUp(s, false); run(s, 25);
    const waiting = s.queue.map((q) => q.id);
    setBackendUp(s, true);
    const stored = kinds(run(s, 25), "stored").map((e) => e.id);
    expect(stored.slice(0, waiting.length)).toEqual(waiting);
    expect(s.queue.length).toBeLessThanOrEqual(2);
  });

  it("stays consistent under a storm of random toggles (Review Focus 2)", () => {
    const s = initialOutage(); const r = seeded(42);
    for (let i = 0; i < 20000; i++) {
      if (r() < 0.02) setBackendUp(s, !s.backendUp);
      if (r() < 0.02) setDbUp(s, !s.dbUp);
      stepOutage(s, 0.02, r);
      expect(s.queue.length).toBeLessThanOrEqual(CAPACITY);
      if (s.flight && !s.flight.dropped) expect(s.queue[0]?.id).toBe(s.flight.id);
      expect(new Set(s.queue.map((q) => q.id)).size).toBe(s.queue.length);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/worlds/satis/model/outage.test.ts --reporter=dot`
Expected: FAIL, cannot resolve `./outage`.

- [ ] **Step 3: Implement**

```ts
// src/worlds/satis/model/outage.ts
import { backoffDelay } from "./backoff";

// Figure 1's model. Every rule follows the agent's code in Sour-Dev-Home/satisfactory-dash; only time
// is scaled so a reader can watch (the agent samples every 5 s and backs off 1 s → 60 s).
//  - agent/src/queue.ts      BoundedQueue: a push into a full queue drops the OLDEST.
//  - agent/src/pusher.ts     sends the head with peek(): it keeps its place until the backend accepts
//                            it, so it can be dropped while in flight; a transient error keeps it at
//                            the head and waits backoffDelayMs(failures) before counting the failure;
//                            success resets the failures and the next send follows at once.
//  - agent/src/backoff.ts    exponential, capped, equal jitter (./backoff.ts).
//  - agent/src/agentRunner.ts  QUEUE_MAX_SNAPSHOTS = 120 (about ten minutes); the figure shows 12 places.

export type Target = "tunnel" | "backend" | "db";
export interface OutageTiming {
  sampleEvery: number; arrive: number; minDwell: number; trip: Record<Target, number>;
  drainFactor: number; backoffBase: number; backoffMax: number;
}
export const SCALED: OutageTiming = {
  sampleEvery: 1.6, arrive: 0.9, minDwell: 0.2,
  trip: { tunnel: 0.5, backend: 0.85, db: 1.1 },
  drainFactor: 0.4, backoffBase: 0.6, backoffMax: 6,
};
export const CAPACITY = 12;

export interface Snapshot { id: number; takenAt: number; seatedAt: number | null }
export interface Flight { id: number; target: Target; ok: boolean; phase: "out" | "back"; startedAt: number; duration: number; dropped: boolean }
export type OutageEvent =
  | { kind: "sampled"; id: number } | { kind: "dropped"; id: number; inFlight: boolean }
  | { kind: "sent"; id: number; target: Target } | { kind: "stored"; id: number }
  | { kind: "error"; id: number; at: Target } | { kind: "requeued"; id: number } | { kind: "discarded"; id: number };
export interface OutageState {
  t: number; nextSample: number; nextTry: number; failures: number; nextId: number;
  queue: Snapshot[]; flight: Flight | null; backendUp: boolean; dbUp: boolean; events: OutageEvent[];
}

export function initialOutage(): OutageState {
  return { t: 0, nextSample: 0.3, nextTry: 0, failures: 0, nextId: 1, queue: [], flight: null, backendUp: true, dbUp: true, events: [] };
}

/** Advances the model by dt. Mutates and returns `s`; `s.events` holds only this step's events. */
export function stepOutage(s: OutageState, dt: number, random: () => number, timing: OutageTiming = SCALED): OutageState {
  s.events = [];
  s.t += dt;
  if (s.t >= s.nextSample) {
    s.nextSample += timing.sampleEvery;
    const id = s.nextId++;
    s.queue.push({ id, takenAt: s.t, seatedAt: null });
    s.events.push({ kind: "sampled", id });
    if (s.queue.length > CAPACITY) {
      const old = s.queue.shift()!;
      const inFlight = s.flight?.id === old.id;
      if (inFlight) s.flight!.dropped = true;
      s.events.push({ kind: "dropped", id: old.id, inFlight });
    }
  }
  for (const q of s.queue) if (q.seatedAt === null && s.t - q.takenAt >= timing.arrive) q.seatedAt = s.t;

  const head = s.queue[0];
  if (!s.flight && head && head.seatedAt !== null && s.t - head.seatedAt >= timing.minDwell && s.t >= s.nextTry) {
    const target: Target = !s.backendUp ? "tunnel" : !s.dbUp ? "backend" : "db";
    const ok = s.backendUp && s.dbUp;
    const duration = timing.trip[target] * (ok && s.queue.length > 1 ? timing.drainFactor : 1);
    s.flight = { id: head.id, target, ok, phase: "out", startedAt: s.t, duration, dropped: false };
    s.events.push({ kind: "sent", id: head.id, target });
  }

  const f = s.flight;
  if (f && s.t - f.startedAt >= f.duration) {
    if (f.phase === "out" && f.ok) {
      if (s.queue[0]?.id === f.id) s.queue.shift(); // pusher.ts: shift only if it's still the head
      s.events.push({ kind: "stored", id: f.id });
      s.failures = 0; s.nextTry = s.t; s.flight = null;
    } else if (f.phase === "out") {
      s.events.push({ kind: "error", id: f.id, at: f.target });
      s.flight = { ...f, phase: "back", startedAt: s.t };
    } else {
      s.nextTry = s.t + backoffDelay(s.failures, timing.backoffBase, timing.backoffMax, random);
      s.failures += 1;
      s.flight = null;
      if (f.dropped) s.events.push({ kind: "discarded", id: f.id });
      else { s.queue[0].seatedAt = s.t; s.events.push({ kind: "requeued", id: f.id }); }
    }
  }
  return s;
}

/** When something comes back, the next retry finds it soon rather than after a long wait. */
const recovered = (s: OutageState) => { s.nextTry = Math.min(s.nextTry, s.t + 0.3); };
export function setBackendUp(s: OutageState, up: boolean): void { s.backendUp = up; if (up) recovered(s); }
export function setDbUp(s: OutageState, up: boolean): void { s.dbUp = up; if (up) recovered(s); }
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/worlds/satis/model/outage.test.ts --reporter=dot`
Expected: PASS (9 tests). If "each retry waits longer" fails because two sends land in one step, lower the step to 0.01 in that test only; don't change the model.

- [ ] **Step 5: Commit**

```bash
git add src/worlds/satis/model/outage.ts src/worlds/satis/model/outage.test.ts
git commit -m "Model the agent's queue, push and retry for the outage figure"
```

### Task 3: The cutover model (figure 2)

**Files:**
- Create: `src/worlds/satis/model/cutover.ts`
- Test: `src/worlds/satis/model/cutover.test.ts`

**Interfaces:**
- Produces:

```ts
export const STEP_NAMES: readonly ["Freeze", "Back up", "Restore", "Start", "Switch"];
export type Mode = "live" | "idle";
export interface CutoverView {
  agent: Mode; agentNote: string; pcBackend: Mode; pcBackendNote: string; pcDb: Mode; pcDbNote: string;
  b2Note: string; b2HasDump: boolean; rds: Mode; rdsNote: string; countsMatch: boolean;
  awsBackend: Mode; awsBackendNote: string; route: "pc" | "aws"; sending: boolean;
}
export function viewAt(step: number): CutoverView; // 0 = before, 1..5 = after each step; clamps
export const COPY: readonly { caption: string; rollback: string }[]; // index 0..5
export const LAST_STEP = 5;
```

- [ ] **Step 1: Write the failing test**

```ts
// src/worlds/satis/model/cutover.test.ts
import { describe, it, expect } from "vitest";
import { COPY, LAST_STEP, STEP_NAMES, viewAt } from "./cutover";

describe("cutover (docs-vault/wiki/runbooks/aws.md, Cutover)", () => {
  it("starts with the PC serving everything and AWS empty, scaled to 0", () => {
    const v = viewAt(0);
    expect([v.pcBackend, v.pcDb, v.agent, v.rds, v.awsBackend, v.route, v.sending]).toEqual(["live", "live", "live", "idle", "idle", "pc", true]);
  });
  it("freeze stops the agent and the PC backend: nothing writes until the switch", () => {
    for (const s of [1, 2, 3, 4]) expect([viewAt(s).sending, viewAt(s).agent, viewAt(s).pcBackend]).toEqual([false, "idle", "idle"]);
  });
  it("the dump reaches B2 at the backup, RDS is restored and counts match at the restore", () => {
    expect([viewAt(1).b2HasDump, viewAt(2).b2HasDump]).toEqual([false, true]);
    expect([viewAt(2).countsMatch, viewAt(3).countsMatch, viewAt(3).rds]).toEqual([false, true, "live"]);
  });
  it("AWS starts before the route moves; the route moves only at the switch", () => {
    expect([viewAt(3).awsBackend, viewAt(4).awsBackend]).toEqual(["idle", "live"]);
    expect([viewAt(4).route, viewAt(5).route, viewAt(5).sending]).toEqual(["pc", "aws", true]);
  });
  it("the PC database is kept, stopped, after the switch", () => {
    expect(viewAt(5).pcDb).toBe("idle");
    expect(viewAt(5).pcDbNote).toMatch(/kept/);
  });
  it("has copy for every state, a rollback for every step, and no step numbers", () => {
    expect(COPY).toHaveLength(LAST_STEP + 1);
    expect(STEP_NAMES).toHaveLength(LAST_STEP);
    for (let s = 1; s <= LAST_STEP; s++) expect(COPY[s].rollback.length).toBeGreaterThan(0);
    for (const c of COPY) expect(`${c.caption} ${c.rollback}`).not.toMatch(/\bstep \d|\d ·/i);
  });
  it("clamps out-of-range steps", () => {
    expect(viewAt(-1)).toEqual(viewAt(0));
    expect(viewAt(9)).toEqual(viewAt(LAST_STEP));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/worlds/satis/model/cutover.test.ts --reporter=dot`
Expected: FAIL, cannot resolve `./cutover`.

- [ ] **Step 3: Implement**

```ts
// src/worlds/satis/model/cutover.ts
// Figure 2's states, step by step, from the runbook in Sour-Dev-Home/satisfactory-dash:
// docs-vault/wiki/runbooks/aws.md, "Cutover" (steps 1 to 5 and each rollback).
export const STEP_NAMES = ["Freeze", "Back up", "Restore", "Start", "Switch"] as const;
export const LAST_STEP = 5;
export type Mode = "live" | "idle";
export interface CutoverView {
  agent: Mode; agentNote: string; pcBackend: Mode; pcBackendNote: string; pcDb: Mode; pcDbNote: string;
  b2Note: string; b2HasDump: boolean; rds: Mode; rdsNote: string; countsMatch: boolean;
  awsBackend: Mode; awsBackendNote: string; route: "pc" | "aws"; sending: boolean;
}

export function viewAt(step: number): CutoverView {
  const s = Math.max(0, Math.min(LAST_STEP, Math.floor(step)));
  const frozen = s >= 1 && s < 5;
  return {
    agent: frozen ? "idle" : "live", agentNote: frozen ? "paused" : "sending",
    pcBackend: s >= 1 ? "idle" : "live", pcBackendNote: s >= 1 ? "stopped" : "serving",
    pcDb: s >= 5 ? "idle" : "live", pcDbNote: s >= 5 ? "stopped · kept two weeks" : s >= 1 ? "frozen" : "source of truth",
    b2Note: s >= 2 ? "final dump + row counts" : "nightly backups", b2HasDump: s >= 2,
    rds: s >= 3 ? "live" : "idle", rdsNote: s >= 3 ? "RDS · counts match" : "RDS · empty", countsMatch: s >= 3,
    awsBackend: s >= 4 ? "live" : "idle", awsBackendNote: s >= 4 ? "Fargate · ready" : "Fargate · scaled to 0",
    route: s >= 5 ? "aws" : "pc", sending: !frozen,
  };
}

export const COPY = [
  { caption: "Before: the PC serves everything. AWS is built and waiting, scaled to 0, with an empty database.", rollback: "" },
  { caption: "Freeze. Stop the agent's task and the PC backend, so nothing writes.", rollback: "Start the PC backend and the agent again; nothing has moved yet." },
  { caption: "Final backup. Back up the PC database by hand to B2 and note every table's row count.", rollback: "Re-enable the nightly backup, then undo the freeze." },
  { caption: "Restore into RDS, migrate, and compare the row counts. Any mismatch stops the cutover.", rollback: "The PC data is untouched: undo the backup step. RDS is reset before another try." },
  { caption: "Start on AWS. Scale to one task; the readiness check answers 200 on a staging hostname.", rollback: "Scale to 0, then undo the backup step." },
  { caption: "Switch the route. api.satis-manager.com moves to the AWS tunnel; the agent starts again and its snapshots arrive.", rollback: "Put the hostname back on the PC tunnel, scale AWS to 0, then undo the backup step, all within the window." },
] as const;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/worlds/satis/model/cutover.test.ts --reporter=dot`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/worlds/satis/model/cutover.ts src/worlds/satis/model/cutover.test.ts
git commit -m "Model the cutover runbook's states and copy for the cutover figure"
```

### Task 4: The figure kit

**Files:**
- Create: `src/design/figure/ease.ts`, `src/design/figure/loop.ts`, `src/design/figure/lazy.ts`, `src/design/figure/controls.ts`, `src/design/figure/Controls.astro`, `src/design/figure/Goals.astro`, `src/design/figure/figure.css`
- Test: `src/design/figure/ease.test.ts`, `src/design/figure/loop.test.ts`

**Interfaces:**
- Produces:

```ts
// ease.ts
export const ease: { inOutCubic(p: number): number; inOutSine(p: number): number; outQuad(p: number): number };
export function lerp(a: number, b: number, p: number): number;
export function squash(speedPxPerS: number, sinceLanding: number): { sx: number; sy: number }; // stretch ≤ 1.25, damped wobble ≤ 0.5 s
// loop.ts
export interface Loop { play(): void; pause(): void; playing(): boolean; setSpeed(target: number): void; destroy(): void }
export function startLoop(onFrame: (dt: number) => void, opts: { autoplay: boolean; raf?: (cb: FrameRequestCallback) => number; now?: () => number; caf?: (id: number) => void }): Loop; // dt clamped to 0.05 s × speed; speed eases toward target
export const MAX_DT = 0.05;
export function prefersReducedMotion(): boolean;
// lazy.ts
export function whenVisible(el: Element, load: () => void): () => void; // returns a disconnect function
// controls.ts
export function wireControls(root: HTMLElement, loop: Loop, onReset: () => void): void; // [data-reset], [data-playpause], input[data-speed]
export function tickGoal(root: HTMLElement, id: string): void; // marks li[data-goal=id] done, once
```

- Astro components: `<Controls>` renders `.fig-bar` with `button[data-reset]`, the speed slider `input.fig-range[data-speed]`, a `<slot />` for figure actions, `button[data-playpause]`; `<Goals goals={[{ id, text }]} />` renders `ul.fig-goals` with `li[data-goal]`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/design/figure/ease.test.ts
import { describe, it, expect } from "vitest";
import { ease, lerp, squash } from "./ease";

describe("ease", () => {
  it("starts at 0, ends at 1, and is symmetric (slow in, slow out)", () => {
    for (const f of [ease.inOutCubic, ease.inOutSine]) {
      expect(f(0)).toBe(0); expect(f(1)).toBe(1);
      expect(f(0.25) + f(0.75)).toBeCloseTo(1, 6);
      expect(f(0.1)).toBeLessThan(0.1); // slow in
    }
  });
  it("lerps", () => expect(lerp(10, 20, 0.25)).toBe(12.5));
  it("stretches with speed up to 1.25 and keeps area (sx * sy ≈ 1) when not wobbling", () => {
    const fast = squash(10_000, 9); expect(fast.sx).toBeCloseTo(1.25, 6); expect(fast.sx * fast.sy).toBeCloseTo(1, 6);
    expect(squash(0, 9)).toEqual({ sx: 1, sy: 1 });
  });
  it("wobbles after landing and settles within half a second", () => {
    expect(squash(0, 0).sx).toBeLessThan(1);
    expect(squash(0, 0.6)).toEqual({ sx: 1, sy: 1 });
  });
});
```

```ts
// src/design/figure/loop.test.ts
import { describe, it, expect } from "vitest";
import { MAX_DT, startLoop } from "./loop";

function fakeFrames() {
  let cb: FrameRequestCallback | null = null; let now = 0;
  return {
    raf: (f: FrameRequestCallback) => { cb = f; return 1; }, caf: () => { cb = null; },
    now: () => now,
    frame(ms: number) { now += ms; const f = cb; cb = null; f?.(now); },
  };
}

describe("startLoop", () => {
  it("clamps a long gap (a background tab) to MAX_DT (Review Focus 1)", () => {
    const fr = fakeFrames(); const dts: number[] = [];
    startLoop((dt) => dts.push(dt), { autoplay: true, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16); fr.frame(10_000);
    expect(Math.max(...dts)).toBeLessThanOrEqual(MAX_DT + 1e-9);
  });
  it("does not advance while paused, and resumes on play", () => {
    const fr = fakeFrames(); let total = 0;
    const loop = startLoop((dt) => (total += dt), { autoplay: false, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16); fr.frame(16); expect(total).toBe(0);
    loop.play(); fr.frame(16); fr.frame(16); expect(total).toBeGreaterThan(0);
  });
  it("eases speed toward its target instead of jumping", () => {
    const fr = fakeFrames(); const dts: number[] = [];
    const loop = startLoop((dt) => dts.push(dt), { autoplay: true, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16); loop.setSpeed(3); fr.frame(16); fr.frame(16);
    expect(dts[1]).toBeGreaterThan(dts[0]); expect(dts[1]).toBeLessThan(0.016 * 3);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/design/figure --reporter=dot`
Expected: FAIL, cannot resolve `./ease` and `./loop`.

- [ ] **Step 3: Implement the modules**

```ts
// src/design/figure/ease.ts
export const ease = {
  inOutCubic: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  inOutSine: (p: number) => -(Math.cos(Math.PI * p) - 1) / 2,
  outQuad: (p: number) => 1 - (1 - p) * (1 - p),
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Squash and stretch: stretch along the motion with speed (≤ 1.25), and a damped wobble after a landing. */
export function squash(speedPxPerS: number, sinceLanding: number): { sx: number; sy: number } {
  const stretch = Math.min(0.25, Math.abs(speedPxPerS) / 1800);
  const w = sinceLanding >= 0 && sinceLanding < 0.5 ? 0.22 * Math.exp(-sinceLanding * 9) * Math.cos(sinceLanding * 28) : 0;
  if (stretch === 0 && w === 0) return { sx: 1, sy: 1 };
  return { sx: (1 + stretch) * (1 - w), sy: (1 / (1 + stretch)) * (1 + w) };
}
```

```ts
// src/design/figure/loop.ts
export const MAX_DT = 0.05;
export interface Loop { play(): void; pause(): void; playing(): boolean; setSpeed(target: number): void; destroy(): void }

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One frame loop per figure: dt in seconds, clamped (a hidden tab doesn't fast-forward), scaled by a speed
 *  that eases toward the slider's value, and stopped entirely while paused. */
export function startLoop(
  onFrame: (dt: number) => void,
  opts: { autoplay: boolean; raf?: (cb: FrameRequestCallback) => number; now?: () => number; caf?: (id: number) => void },
): Loop {
  const raf = opts.raf ?? requestAnimationFrame.bind(window);
  const caf = opts.caf ?? cancelAnimationFrame.bind(window);
  const now = opts.now ?? (() => performance.now());
  let playing = opts.autoplay, speed = 1, target = 1, last = now(), id = 0, alive = true;
  const frame = (ts: number) => {
    if (!alive) return;
    const real = Math.min(MAX_DT, Math.max(0, (ts - last) / 1000)); last = ts;
    speed += (target - speed) * Math.min(1, real * 6);
    if (playing) onFrame(real * speed);
    id = raf(frame);
  };
  id = raf(frame);
  return {
    play() { playing = true; last = now(); },
    pause() { playing = false; },
    playing: () => playing,
    setSpeed(t) { target = t; },
    destroy() { alive = false; caf(id); },
  };
}
```

```ts
// src/design/figure/lazy.ts
/** Runs `load` once, the first time `el` comes near the viewport. */
export function whenVisible(el: Element, load: () => void): () => void {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
  }, { rootMargin: "200px" });
  io.observe(el);
  return () => io.disconnect();
}
```

```ts
// src/design/figure/controls.ts
import type { Loop } from "./loop";

const PAUSE = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
const PLAY = '<path d="M7 5l12 7-12 7z"/>';

export function wireControls(root: HTMLElement, loop: Loop, onReset: () => void): void {
  const pp = root.querySelector<HTMLButtonElement>("[data-playpause]");
  const sync = () => {
    if (!pp) return;
    pp.setAttribute("aria-label", loop.playing() ? "Pause" : "Play");
    pp.querySelector("svg")!.innerHTML = loop.playing() ? PAUSE : PLAY;
  };
  pp?.addEventListener("click", () => { (loop.playing() ? loop.pause() : loop.play()); sync(); });
  root.querySelector("[data-reset]")?.addEventListener("click", onReset);
  const range = root.querySelector<HTMLInputElement>("input[data-speed]");
  if (range) {
    const fill = () => range.style.setProperty("--p", `${((+range.value - +range.min) / (+range.max - +range.min)) * 100}%`);
    range.addEventListener("input", () => { loop.setSpeed(+range.value); fill(); });
    fill();
  }
  sync();
}

export function tickGoal(root: HTMLElement, id: string): void {
  const li = root.querySelector<HTMLElement>(`[data-goal="${id}"]`);
  if (li && !li.classList.contains("done")) { li.classList.add("done"); li.setAttribute("aria-checked", "true"); }
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `npx vitest run src/design/figure --reporter=dot`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the Astro components and styles**

```astro
---
// src/design/figure/Controls.astro — the bar under a figure. Figure actions (toggles, steppers) go in the slot.
interface Props { speed?: boolean; play?: boolean; label: string }
const { speed = true, play = true, label } = Astro.props;
---
<div class="fig-bar" role="group" aria-label={label}>
  <button class="fig-ibtn" type="button" data-reset aria-label="Reset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg></button>
  {speed && (
    <div class="fig-speed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 16c0-4 3-7 7-7s7 3 7 7z"/><path d="M18 14h2.5a1.5 1.5 0 0 0 0-3H18"/><path d="M7 16v2M15 16v2"/><path d="M8 12l2 2 2-2 2 2"/></svg>
      <input class="fig-range" data-speed type="range" min="0.4" max="3" step="any" value="1" aria-label="Speed" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 17c2-5 6-7 11-6l3-5 1 6c1 1 2 3 1 5z"/><path d="M8 17v2M16 17v2"/><circle cx="17" cy="13" r=".8" fill="currentColor"/></svg>
    </div>
  )}
  <slot />
  {play && <button class="fig-ibtn" type="button" data-playpause aria-label="Pause"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>}
</div>
```

```astro
---
// src/design/figure/Goals.astro — what to try, ticked by the figure's script as the reader does it.
interface Props { goals: { id: string; text: string }[] }
const { goals } = Astro.props;
---
<div class="fig-goals"><p class="fig-goals-title">Goals</p>
  <ul>{goals.map((g) => <li data-goal={g.id} role="checkbox" aria-checked="false" aria-readonly="true">{g.text}</li>)}</ul>
</div>
```

```css
/* src/design/figure/figure.css — shared by every interactive figure. Colours come from the world's tokens. */
.fig { background: var(--fig-bg); color: var(--fig-ink); border: 1px dashed var(--fig-rule); border-radius: 12px; overflow: hidden; margin: var(--space-5) 0; }
.fig svg { width: 100%; height: auto; display: block; }
.fig-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px dotted var(--fig-rule); background: var(--fig-bar); }
.fig-ibtn, .fig-tbtn { height: 36px; min-width: 36px; border: 0; border-radius: 8px; background: var(--fig-btn); color: var(--fig-ink); display: inline-grid; place-items: center; cursor: pointer; font: 600 12px var(--font-text); padding: 0 12px; }
.fig-ibtn { width: 36px; padding: 0; }
.fig-ibtn svg { width: 18px; height: 18px; }
.fig-ibtn:hover:not(:disabled), .fig-tbtn:hover:not(:disabled) { background: var(--fig-btn-hover); }
.fig-ibtn:disabled, .fig-tbtn:disabled { opacity: .35; cursor: default; }
.fig-tbtn.primary { background: var(--fig-accent); color: var(--fig-on-accent); }
.fig-ibtn:focus-visible, .fig-tbtn:focus-visible, .fig-range:focus-visible, .fig [data-station]:focus-visible { outline: 2px solid var(--fig-accent); outline-offset: 2px; }
.fig-speed { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 180px; }
.fig-speed > svg { width: 22px; height: 22px; color: var(--fig-dim); flex: none; }
.fig-range { --p: 23%; flex: 1; appearance: none; -webkit-appearance: none; height: 6px; border-radius: 3px; cursor: pointer; background: linear-gradient(to right, var(--fig-accent) 0 var(--p), var(--fig-btn-hover) var(--p) 100%); }
.fig-range::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: var(--fig-accent); border: 3px solid var(--fig-bar); box-shadow: 0 0 0 1px var(--fig-accent); transition: transform var(--dur-fast) ease; }
.fig-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: var(--fig-accent); border: 3px solid var(--fig-bar); box-shadow: 0 0 0 1px var(--fig-accent); }
.fig-range:hover::-webkit-slider-thumb, .fig-range:active::-webkit-slider-thumb { transform: scale(1.15); }
.fig-caption { font: 13px/1.5 var(--font-text); color: var(--fig-ink); padding: 4px 14px 12px; background: var(--fig-bar); min-height: 2.6em; margin: 0; }
.fig-goals { border-left: 3px solid var(--ink); padding: 2px 0 2px var(--space-4); margin: var(--space-4) 0; }
.fig-goals-title { font: 700 var(--step--1) ui-monospace, monospace; margin: 0; }
.fig-goals ul { list-style: none; padding: 0; margin: var(--space-1) 0 0; }
.fig-goals li::before { content: "☐"; margin-right: var(--space-2); color: var(--muted); }
.fig-goals li.done { color: var(--fig-done); }
.fig-goals li.done::before { content: "☑"; color: var(--fig-done); }
```

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck` (Expected: exit 0) and `npx vitest run src/design/figure --reporter=dot` (Expected: PASS).

```bash
git add src/design/figure
git commit -m "Add the figure kit: easing, frame loop, lazy start, control bar, goals"
```

### Task 5: World tokens, stations and layouts

**Files:**
- Create: `src/worlds/satis/world.css`, `src/worlds/satis/Station.astro`, `src/worlds/satis/figures/layouts.ts`
- Test: `src/worlds/satis/figures/layouts.test.ts`

**Interfaces:**
- Produces:

```ts
// layouts.ts
export interface Pt { x: number; y: number }
export interface OutageLayout { w: number; h: number; pc: Pt; pill: { x: number; y: number; w: number; h: number }; headX: number; gap: number; out: number; tunnel: Pt; backend: Pt; db: Pt; axis: "x" | "y" }
export const OUTAGE: { desktop: OutageLayout; phone: OutageLayout };
export interface CutoverLayout { w: number; h: number; shift: number; panels: Record<"pc" | "off" | "cf" | "aws", { x: number; y: number; w: number; h: number; label: Pt; anchor: "start" | "end" }>; pcDb: Pt; pcBackend: Pt; b2: Pt; awsBackend: Pt; rds: Pt; agent: Pt; tunnel: Pt; routeExit: Pt; gutter: number; dump: string; restore: string }
export const CUTOVER: { desktop: CutoverLayout; phone: CutoverLayout };
export function routePath(l: CutoverLayout, to: "pc" | "aws"): string;
```

`Station.astro` props: `{ kind: "pc" | "tunnel" | "rack" | "db" | "bucket"; x: number; y: number; label: string; sub: string; id?: string; zone?: "pc" | "off" | "cf" | "aws"; clickable?: string /* aria-label */; mode?: "live" | "idle" | "down" }`. It renders `<g class="st st-{zone} {mode}" data-station={id} transform=...>` with the disc (`circle.halo r=34`), the icon paths from the prototypes, and `<text class="lbl">`/`<text class="lbl dim" data-sub>`; with `clickable` it adds `role="button" tabindex="0" aria-label={clickable}`.

- [ ] **Step 1: Write the failing test** (geometry rules that keep labels clear, independent of the browser)

```ts
// src/worlds/satis/figures/layouts.test.ts
import { describe, it, expect } from "vitest";
import { CUTOVER, OUTAGE, routePath } from "./layouts";

describe("figure layouts", () => {
  it("outage: the queue sits clear of the PC disc and the tunnel disc (r 34)", () => {
    for (const l of [OUTAGE.desktop]) {
      expect(l.pill.x - (l.pc.x + 34)).toBeGreaterThanOrEqual(20);
      expect(l.tunnel.x - 34 - (l.pill.x + l.pill.w)).toBeGreaterThanOrEqual(20);
    }
  });
  it("cutover: every station sits inside its panel with 15 units to spare for its sub-label", () => {
    for (const l of [CUTOVER.desktop, CUTOVER.phone]) {
      const inside = (p: { x: number; y: number }, z: keyof typeof l.panels, half = 66) =>
        p.x - half >= l.panels[z].x + 15 - 1e-9 && p.x + half <= l.panels[z].x + l.panels[z].w - 15 + 1e-9;
      expect(inside(l.pcDb, "pc")).toBe(true); expect(inside(l.pcBackend, "pc", 40)).toBe(true);
      expect(inside(l.b2, "off")).toBe(true); expect(inside(l.awsBackend, "aws", 56)).toBe(true); expect(inside(l.rds, "aws", 50)).toBe(true);
    }
  });
  it("cutover: both routes start at the tunnel's exit and end at their backend", () => {
    const l = CUTOVER.desktop;
    expect(routePath(l, "pc")).toBe("M378 236 V180 Q378 176 374 176 H259 Q255 176 255 172 V86 Q255 82 251 82 H239");
    expect(routePath(l, "pc").startsWith(`M${l.routeExit.x} ${l.routeExit.y}`)).toBe(true);
    expect(routePath(l, "aws")).toMatch(new RegExp(`H${l.awsBackend.x - 24}$`));
    expect(routePath(l, "pc")).toMatch(new RegExp(`H${l.pcBackend.x + 24}$`));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/worlds/satis/figures/layouts.test.ts --reporter=dot`
Expected: FAIL, cannot resolve `./layouts`.

- [ ] **Step 3: Implement `layouts.ts`** — desktop values are the approved prototypes' (outage v6, cutover v5); phone values are the vertical compositions (reviewed in Task 8).

```ts
// src/worlds/satis/figures/layouts.ts
export interface Pt { x: number; y: number }
export interface OutageLayout { w: number; h: number; pc: Pt; pill: { x: number; y: number; w: number; h: number }; headX: number; gap: number; out: number; tunnel: Pt; backend: Pt; db: Pt; axis: "x" | "y" }
export interface Panel { x: number; y: number; w: number; h: number; label: Pt; anchor: "start" | "end" }
export interface CutoverLayout { w: number; h: number; shift: number; panels: Record<"pc" | "off" | "cf" | "aws", Panel>; pcDb: Pt; pcBackend: Pt; b2: Pt; awsBackend: Pt; rds: Pt; agent: Pt; tunnel: Pt; routeExit: Pt; gutter: number; dump: string; restore: string }

// Outage: left to right on desktop (prototype v6); top to bottom on phones, the queue a vertical pill.
export const OUTAGE: { desktop: OutageLayout; phone: OutageLayout } = {
  desktop: { w: 720, h: 160, axis: "x", pc: { x: 60, y: 70 }, pill: { x: 140, y: 54, w: 208, h: 32 }, headX: 330, gap: 16, out: 348, tunnel: { x: 420, y: 70 }, backend: { x: 540, y: 70 }, db: { x: 660, y: 70 } },
  phone: { w: 320, h: 640, axis: "y", pc: { x: 160, y: 50 }, pill: { x: 144, y: 110, w: 32, h: 208 }, headX: 300, gap: 16, out: 318, tunnel: { x: 160, y: 380 }, backend: { x: 160, y: 480 }, db: { x: 160, y: 580 } },
};

// Cutover: panels side by side on desktop (prototype v5, drawn 16 units down for the panel labels);
// stacked on phones: Gaming PC, Cloudflare, Off-site backups, AWS.
export const CUTOVER: { desktop: CutoverLayout; phone: CutoverLayout } = {
  desktop: {
    w: 764, h: 360, shift: 16,
    panels: {
      pc: { x: 12, y: 30, w: 280, h: 320, label: { x: 24, y: 47 }, anchor: "start" },
      off: { x: 318, y: 30, w: 156, h: 154, label: { x: 330, y: 47 }, anchor: "start" },
      cf: { x: 318, y: 208, w: 156, h: 142, label: { x: 462, y: 225 }, anchor: "end" },
      aws: { x: 500, y: 30, w: 252, h: 154, label: { x: 512, y: 47 }, anchor: "start" },
    },
    pcDb: { x: 95, y: 82 }, pcBackend: { x: 215, y: 82 }, b2: { x: 396, y: 82 }, awsBackend: { x: 575, y: 82 }, rds: { x: 685, y: 82 },
    agent: { x: 95, y: 254 }, tunnel: { x: 396, y: 254 }, routeExit: { x: 378, y: 236 }, gutter: 176,
    dump: "M95 52 V44 Q95 40 99 40 H392 Q396 40 396 44 V52",
    restore: "M396 52 V44 Q396 40 400 40 H681 Q685 40 685 44 V52",
  },
  phone: {
    w: 340, h: 760, shift: 16,
    panels: {
      pc: { x: 8, y: 30, w: 324, h: 250, label: { x: 20, y: 47 }, anchor: "start" },
      cf: { x: 8, y: 296, w: 324, h: 120, label: { x: 320, y: 313 }, anchor: "end" },
      off: { x: 8, y: 432, w: 324, h: 130, label: { x: 20, y: 449 }, anchor: "start" },
      aws: { x: 8, y: 578, w: 324, h: 170, label: { x: 20, y: 595 }, anchor: "start" },
    },
    pcDb: { x: 95, y: 82 }, pcBackend: { x: 245, y: 82 }, agent: { x: 95, y: 200 }, tunnel: { x: 170, y: 330 },
    b2: { x: 170, y: 470 }, awsBackend: { x: 95, y: 626 }, rds: { x: 245, y: 626 },
    routeExit: { x: 152, y: 312 }, gutter: 288,
    dump: "M24 82 H8 V470 H136",
    restore: "M204 470 H332 V626 H279",
  },
};

/** The route from the tunnel to a backend: up to the gutter, across, up beside the backend, in from the
 *  side facing the tunnel (desktop, prototype v5). On phones the backend is above or below the tunnel,
 *  so the riser runs vertically to it. Always clear of labels (e2e collision test). */
export function routePath(l: CutoverLayout, to: "pc" | "aws"): string {
  const b = to === "pc" ? l.pcBackend : l.awsBackend;
  const side = b.x < l.tunnel.x ? 1 : -1; // enter from the side facing the tunnel
  const bx = b.x + side * 40, end = b.x + side * 24, { x: rx, y: ry } = l.routeExit, g = l.gutter;
  const up1 = Math.sign(g - ry) || -1;   // tunnel exit → gutter
  const h = Math.sign(bx - rx) || 1;     // along the gutter
  const up2 = Math.sign(b.y - g) || -1;  // gutter → backend
  // Desktop, to the PC: M378 236 V180 Q378 176 374 176 H259 Q255 176 255 172 V86 Q255 82 251 82 H239 (prototype v5).
  return `M${rx} ${ry} V${g - up1 * 4} Q${rx} ${g} ${rx + h * 4} ${g} H${bx - h * 4} Q${bx} ${g} ${bx} ${g + up2 * 4} V${b.y - up2 * 4} Q${bx} ${b.y} ${bx - side * 4} ${b.y} H${end}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/worlds/satis/figures/layouts.test.ts --reporter=dot`
Expected: PASS (3 tests). If the phone geometry fails a rule, fix the phone numbers, not the test: the rules are the spec's.

- [ ] **Step 5: Add `world.css` and `Station.astro`**

```css
/* src/worlds/satis/world.css — the satis-manager world. PLACEHOLDER colours until the palette round (Task 11).
   Roles are fixed: route, snapshot, error, dropped, backup, one tint per area; red is failure only. */
.world-satis {
  --satis-steel: #1f2327; --satis-steel-2: #2c3237; --satis-line: #4a525a; --satis-ink: #e9e5dc; --satis-dim: #9aa1a8;
  --satis-route: #ff6a13; --satis-snapshot: #ff6a13; --satis-error: #e5534b; --satis-dropped: #ffb07a; --satis-backup: #6a5acd; --satis-ok: #5fd38d;
  --satis-zone-pc: #272a2e; --satis-zone-pc-rule: #4f565e; --satis-zone-pc-ink: #c3c9cf;
  --satis-zone-off: #24223a; --satis-zone-off-rule: #48426e; --satis-zone-off-ink: #a99de0;
  --satis-zone-cf: #2c241d; --satis-zone-cf-rule: #5c4430; --satis-zone-cf-ink: #f0a36a;
  --satis-zone-aws: #1d2630; --satis-zone-aws-rule: #36495c; --satis-zone-aws-ink: #8fb3d6;
  --fig-bg: var(--satis-steel); --fig-ink: var(--satis-ink); --fig-dim: var(--satis-dim); --fig-rule: #5a636b; --fig-bar: #262a2e;
  --fig-btn: #3a4046; --fig-btn-hover: #4a5158; --fig-accent: var(--satis-route); --fig-on-accent: #1b1b1b; --fig-done: #2f8a57;
}
.world-satis .tok { font-weight: 700; white-space: nowrap; }
.world-satis .tok i { font-style: normal; margin-right: 3px; }
.world-satis .tok-snapshot { color: #c24a0a; } .world-satis .tok-error { color: #b0342a; } .world-satis .tok-dropped { color: #8a6a4a; }
.world-satis .tok-route { color: #c24a0a; } .world-satis .tok-backup { color: #5a4bb8; }
.st .halo { fill: var(--fig-bg); }
.st-pc .halo { fill: var(--satis-zone-pc); } .st-off .halo { fill: var(--satis-zone-off); } .st-cf .halo { fill: var(--satis-zone-cf); } .st-aws .halo { fill: var(--satis-zone-aws); }
.st > * { transition: opacity var(--dur) ease; }
.st.idle > :not(.halo) { opacity: .4; }
.st .body { fill: var(--satis-steel-2); stroke: var(--satis-line); stroke-width: 1.5; transition: stroke var(--dur); }
.st.down .body { stroke: var(--satis-error); stroke-dasharray: 4 3; }
.st.live .frame { stroke: var(--satis-ok); }
.st .dark { fill: #121416; }
.st .lbl { fill: var(--satis-ink); font: 600 12px var(--font-text); text-anchor: middle; }
.st .lbl.dim { fill: var(--satis-dim); font-weight: 500; font-size: 10.5px; }
.st[data-click] { cursor: pointer; }
.st[data-click]:hover .halo { stroke: color-mix(in srgb, var(--satis-route) 60%, transparent); stroke-width: 1; }
.fig .wire { stroke: var(--satis-line); stroke-width: 2; fill: none; stroke-dasharray: 2 5; stroke-linecap: round; transition: opacity var(--dur) ease; }
.fig .wire.idle { opacity: .3; }
```

`Station.astro`: copy each icon's paths verbatim from the prototypes (`figure-outage.html` for pc, tunnel, rack, db; `figure-cutover.html` for bucket and the cutover's rack and cylinder), placed in a `switch` on `kind`:

```astro
---
// src/worlds/satis/Station.astro — one station: an opaque disc (hides wires behind it), a flat icon, two labels.
interface Props {
  kind: "pc" | "tunnel" | "rack" | "db" | "bucket"; x: number; y: number; label: string; sub: string;
  id?: string; zone?: "pc" | "off" | "cf" | "aws"; clickable?: string; mode?: "live" | "idle" | "down";
}
const { kind, x, y, label, sub, id, zone, clickable, mode = "live" } = Astro.props;
const cls = ["st", zone && `st-${zone}`, mode].filter(Boolean).join(" ");
---
<g class={cls} data-station={id} data-click={clickable ? "" : undefined} transform={`translate(${x} ${y})`}
   role={clickable ? "button" : undefined} tabindex={clickable ? 0 : undefined} aria-label={clickable}>
  <circle class="halo" r="34" />
  {kind === "pc" && (<>
    <rect class="body" x="-30" y="-22" width="40" height="28" rx="3"/><rect class="dark" x="-26" y="-18" width="32" height="20" rx="1.5"/>
    <rect class="body" x="-14" y="6" width="8" height="8"/><rect class="body" x="-20" y="14" width="20" height="4" rx="1"/>
    <rect class="body" x="14" y="-24" width="16" height="42" rx="2"/><circle class="led" data-power cx="22" cy="10" r="2.2" fill="var(--satis-snapshot)"/>
  </>)}
  {kind === "tunnel" && (<>
    <path class="body" d="M-30 18 V-2 A30 28 0 0 1 30 -2 V18 Z"/><path class="dark" d="M-16 18 V2 A16 15 0 0 1 16 2 V18 Z"/>
    <path d="M-30 18 H30" stroke="var(--satis-line)" stroke-width="2"/>
  </>)}
  {kind === "rack" && (<>
    <rect class="body frame" x="-24" y="-24" width="48" height="44" rx="4"/>
    <rect class="dark" x="-18" y="-18" width="36" height="9" rx="2"/><rect class="dark" x="-18" y="-5" width="36" height="9" rx="2"/><rect class="dark" x="-18" y="8" width="36" height="9" rx="2"/>
    <circle class="led" cx="11" cy="-13.5" r="2.2"/><circle class="led" cx="11" cy="-0.5" r="2.2"/><circle class="led" cx="11" cy="12.5" r="2.2"/>
  </>)}
  {kind === "db" && (<>
    <path class="body frame" d="M-22 -14 V16 A22 6 0 0 0 22 16 V-14"/><ellipse class="body frame" cx="0" cy="-14" rx="22" ry="6"/>
    <path d="M-22 -3 A22 6 0 0 0 22 -3 M-22 7 A22 6 0 0 0 22 7" stroke="var(--satis-line)" stroke-width="1.5" fill="none"/>
    <rect class="fill" data-fill x="-14" y="0" width="28" height="12" rx="2" fill="var(--satis-backup)" opacity="0"/>
  </>)}
  {kind === "bucket" && (<>
    <path class="body frame" d="M-22 -16 L-17 18 Q-16 22 -12 22 H12 Q16 22 17 18 L22 -16 Z"/><ellipse class="body frame" cx="0" cy="-16" rx="22" ry="5"/>
    <rect class="fill" data-fill x="-9" y="2" width="18" height="12" rx="2" fill="var(--satis-backup)" opacity="0"/>
  </>)}
  <text class="lbl" y="52">{label}</text><text class="lbl dim" data-sub y="66">{sub}</text>
</g>
```

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck` — Expected: exit 0.

```bash
git add src/worlds/satis/world.css src/worlds/satis/Station.astro src/worlds/satis/figures/layouts.ts src/worlds/satis/figures/layouts.test.ts
git commit -m "Add the satis world tokens, station icons and figure layouts"
```

### Task 6: JavaScript budget and the no-JavaScript tests

Done before the figures, so no commit ever lands with a red dist suite.

**Files:**
- Modify: `tests/dist/budget.ts`, `tests/dist/prerender.test.ts`
- Test: `npm run test:dist`

**Interfaces:**
- Produces: `BUDGETS = { "projects/satisfactory-dash.html": 15_000, "kit.html": 15_000 }`; `DEFAULT_BUDGET = 0`; `SCRIPTED_PAGES = Object.keys(BUDGETS)` exported from `budget.ts`.

- [ ] **Step 1: Tighten the default and exempt only the figure pages**

In `tests/dist/budget.ts`:

```ts
// Only pages with interactive figures may run JavaScript, each within its own budget (gzipped bytes);
// every other page runs none.
export const DEFAULT_BUDGET = 0;
export const BUDGETS: Record<string, number> = { "projects/satisfactory-dash.html": 15_000, "kit.html": 15_000 };
export const SCRIPTED_PAGES = Object.keys(BUDGETS);
```

In `tests/dist/prerender.test.ts`, change the last assertion so only scripted pages are exempt (import `SCRIPTED_PAGES` from `./budget`; rename the test to `${file} prerenders same-site links on hover and runs no JavaScript unless it has a budget`):

```ts
      if (!SCRIPTED_PAGES.includes(file)) expect(doc.querySelectorAll(RUNNABLE_SCRIPTS)).toHaveLength(0);
```

- [ ] **Step 2: Run them**

Run: `npm run build && npm run test:dist`
Expected: PASS (no page has scripts yet; the default budget is now 0 and every page meets it). Later, if the budget fails on a figure page, report the measured bytes: the figure logic must fit in 15 KB; trim the view code (it carries no library), and don't raise the budget without the owner.

- [ ] **Step 3: Commit**

```bash
git add tests/dist/budget.ts tests/dist/prerender.test.ts
git commit -m "Allow JavaScript only on pages with figures, within 15 KB each"
```

### Task 7: Figure 1 (the outage) — desktop

**Files:**
- Create: `src/worlds/satis/figures/OutageFigure.astro`, `src/worlds/satis/figures/outage-view.ts`, `e2e/figures.ts`, `e2e/figures.spec.ts`
- Modify: `src/pages/kit.astro` (add the figure in a new "World · satis-manager" section with `class="world-satis"`), `e2e/pages.ts` (unchanged list; kit already covered)

**Interfaces:**
- Consumes: Task 2 model, Task 4 kit, Task 5 `Station`, `OUTAGE`.
- Produces: `<OutageFigure />` (no props); root `figure.fig[data-figure="outage"]`; stations `[data-station="backend"]`, `[data-station="db"]` clickable; toggles `button[data-toggle="backend"]`, `button[data-toggle="db"]` with `aria-pressed`; caption `p.fig-caption[aria-live="polite"]`; goals `wait`, `drop`, `drain`, `db`. `mount(root: HTMLElement): () => void` in `outage-view.ts`. `e2e/figures.ts` exports `labelCollisions(page: Page, root: string): Promise<string[]>`.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// e2e/figures.ts
import type { Page } from "@playwright/test";

/** Every drawn line and orb path in a figure, sampled every 2 units, tested against every text box (+2 px).
 *  Only the drawn part of a route counts (length minus its dash offset). Returns "<line> x <label>" hits. */
export function labelCollisions(page: Page, root: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const fig = document.querySelector(sel)!;
    const svg = [...fig.querySelectorAll("svg")].find((s) => s.getBoundingClientRect().width > 0)!;
    const texts = [...svg.querySelectorAll("text")].map((t) => ({ n: t.textContent ?? "", r: t.getBoundingClientRect() }));
    const out = new Set<string>();
    for (const path of svg.querySelectorAll<SVGPathElement>("path.wire, path.route, path.path-dump.on")) {
      const cs = getComputedStyle(path);
      if (cs.opacity === "0" || cs.visibility === "hidden") continue;
      const L = path.getTotalLength();
      const vis = path.classList.contains("route") ? L - (parseFloat(cs.strokeDashoffset) || 0) : L;
      const m = path.getScreenCTM()!;
      for (let d = 0; d <= vis; d += 2) {
        const p = path.getPointAtLength(d).matrixTransform(m);
        for (const { n, r } of texts) if (p.x > r.left - 2 && p.x < r.right + 2 && p.y > r.top - 2 && p.y < r.bottom + 2) out.add(`${path.id || path.getAttribute("class")} x ${n}`);
      }
    }
    return [...out];
  }, root);
}
```

```ts
// e2e/figures.spec.ts
import { expect, test } from "@playwright/test";
import { labelCollisions } from "./figures";

const OUT = 'figure[data-figure="outage"]';

test.describe("outage figure", () => {
  test("renders its full size before its script runs", async ({ page }) => {
    await page.route("**/_astro/*.js", (r) => r.abort());
    await page.goto("/kit");
    const box = await page.locator(OUT).boundingBox();
    expect(box!.height).toBeGreaterThan(200);
    await expect(page.locator(`${OUT} [data-station="backend"]`)).toBeVisible();
  });

  test("taking the backend down sends errors back and ticks the goals", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    await page.locator(`${OUT} button[data-toggle="backend"]`).click();
    await expect(page.locator(`${OUT} button[data-toggle="backend"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(`${OUT} [data-goal="wait"]`)).toHaveClass(/done/, { timeout: 15_000 });
    await expect(page.locator(`${OUT} .fig-caption`)).toContainText("Cloudflare answers with an error");
  });

  test("works from the keyboard alone (Review Focus 5)", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(`${OUT} [data-station="db"]`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`${OUT} button[data-toggle="db"]`)).toHaveAttribute("aria-pressed", "true");
    await page.locator(`${OUT} button[data-playpause]`).focus();
    await page.keyboard.press("Space");
    await expect(page.locator(`${OUT} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
  });

  test("opens paused under reduced motion, and its controls still work", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    await expect(page.locator(`${OUT} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
    const before = await page.locator(`${OUT} [data-dots] circle`).count();
    await page.waitForTimeout(1500);
    expect(await page.locator(`${OUT} [data-dots] circle`).count()).toBe(before);
    await page.locator(`${OUT} button[data-toggle="backend"]`).click();
    await expect(page.locator(`${OUT} button[data-toggle="backend"]`)).toHaveAttribute("aria-pressed", "true");
  });

  test("no line crosses a label", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    expect(await labelCollisions(page, OUT)).toEqual([]);
    await page.locator(`${OUT} button[data-toggle="backend"]`).click();
    await page.waitForTimeout(800);
    expect(await labelCollisions(page, OUT)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build && npx playwright test e2e/figures.spec.ts --project=desktop-1280 --reporter=line`
Expected: FAIL (no `figure[data-figure="outage"]` on /kit).

- [ ] **Step 3: Write `OutageFigure.astro`** — the prose-free figure; the article supplies the prose and goals sit above the drawing.

```astro
---
// src/worlds/satis/figures/OutageFigure.astro — figure 1: what the agent does when the backend or database is down.
// The first frame is static markup; outage-view.ts starts the model when the figure scrolls into view.
import Station from "../Station.astro";
import Goals from "../../../design/figure/Goals.astro";
import Controls from "../../../design/figure/Controls.astro";
import { OUTAGE } from "./layouts";
import "../../../design/figure/figure.css";
const d = OUTAGE.desktop;
---
<Goals goals={[
  { id: "wait", text: "Take the backend down and watch snapshots wait in the queue." },
  { id: "drop", text: "Keep it down until a snapshot is dropped." },
  { id: "drain", text: "Bring it back and watch the backlog drain." },
  { id: "db", text: "Take only the database down: the error comes back from further away." },
]} />
<figure class="fig" data-figure="outage">
  <svg data-layout="desktop" viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-label="The agent on the game PC queues snapshots and sends them through the Cloudflare tunnel to the backend and its database; errors come back when the backend or the database is down.">
    <path class="wire" d={`M${d.pc.x} ${d.pc.y} H${d.db.x}`} />
    <rect class="pill" x={d.pill.x} y={d.pill.y} width={d.pill.w} height={d.pill.h} rx={d.pill.h / 2} fill="#2a2f34" stroke="var(--satis-line)" stroke-width="1.5" />
    <circle data-ghost r="5.5" cx={d.headX} cy={d.pc.y} fill="none" stroke="var(--satis-snapshot)" stroke-dasharray="2 2" opacity="0" />
    <g data-dots></g>
    <Station kind="pc" x={d.pc.x} y={d.pc.y} label="Agent" sub="game PC" />
    <text class="lbl-q" x={d.pill.x + d.pill.w / 2} y={d.pc.y + 56} text-anchor="middle" fill="var(--satis-ink)" font-size="12" font-weight="600">Queue</text>
    <text x={d.pill.x + d.pill.w / 2} y={d.pc.y + 70} text-anchor="middle" fill="var(--satis-dim)" font-size="10.5">on the PC</text>
    <Station kind="tunnel" x={d.tunnel.x} y={d.tunnel.y} label="Tunnel" sub="Cloudflare" />
    <Station kind="rack" id="backend" x={d.backend.x} y={d.backend.y} label="Backend" sub="ECS Fargate" clickable="Take the backend down" />
    <Station kind="db" id="db" x={d.db.x} y={d.db.y} label="PostgreSQL" sub="RDS" clickable="Take the database down" />
  </svg>
  <Controls label="Outage figure controls">
    <button class="fig-tbtn" type="button" data-toggle="backend" aria-pressed="false">Backend</button>
    <button class="fig-tbtn" type="button" data-toggle="db" aria-pressed="false">Database</button>
  </Controls>
  <p class="fig-caption" aria-live="polite">The agent sends each snapshot as it's taken; the backend stores it in PostgreSQL.</p>
</figure>
<script>
  import { whenVisible } from "../../../design/figure/lazy";
  for (const el of document.querySelectorAll<HTMLElement>('figure[data-figure="outage"]')) {
    whenVisible(el, () => { import("./outage-view").then((m) => m.mount(el)); });
  }
</script>
```

- [ ] **Step 4: Write `outage-view.ts`** — port the prototype's drawing (`figure-outage.html`, script section) onto the model: orbs are created on `sampled`, follow `queue` slots and `flight`, turn red on `error`, fall hollow on `dropped` (not in flight) and `discarded`; the ghost shows while the head is away; goals tick from events; captions from state.

```ts
// src/worlds/satis/figures/outage-view.ts
import { initialOutage, setBackendUp, setDbUp, stepOutage, type OutageState } from "../model/outage";
import { seeded } from "../model/random";
import { ease, lerp, squash } from "../../../design/figure/ease";
import { prefersReducedMotion, startLoop } from "../../../design/figure/loop";
import { tickGoal, wireControls } from "../../../design/figure/controls";
import { OUTAGE, type OutageLayout } from "./layouts";

const NS = "http://www.w3.org/2000/svg";
const CAPTION = {
  ok: "The agent sends each snapshot as it's taken; the backend stores it in PostgreSQL.",
  be: "The backend is unreachable, so Cloudflare answers with an error. The snapshot keeps its place at the front of the queue; each retry waits longer, with jitter. When the queue is full, the oldest is dropped.",
  db: "The database is down. The backend is alive, so ECS leaves it running (it only checks liveness), but it can't store anything and answers with an error.",
};
interface Orb { el: SVGCircleElement; x: number; y: number; px: number; landedAt: number; life?: number; vy?: number }

export function mount(root: HTMLElement): () => void {
  const svg = root.querySelector<SVGSVGElement>('svg[data-layout]:not([hidden])') ?? root.querySelector("svg")!;
  const L: OutageLayout = svg.dataset.layout === "phone" ? OUTAGE.phone : OUTAGE.desktop;
  const dots = svg.querySelector<SVGGElement>("[data-dots]")!, ghost = svg.querySelector<SVGCircleElement>("[data-ghost]")!;
  const reduced = prefersReducedMotion();
  const random = seeded(4); // deterministic, so the paused frame is the same every time
  let s: OutageState = initialOutage();
  const orbs = new Map<number, Orb>(); let falling: Orb[] = []; let sawBacklog = false;
  const along = (v: number) => (L.axis === "x" ? { x: v, y: L.pc.y } : { x: L.pc.x, y: v });
  const slot = (i: number) => L.headX - i * L.gap; // along the flow axis
  const stationAt = (t: "tunnel" | "backend" | "db") => (L.axis === "x" ? L[t].x : L[t].y);
  const start = L.axis === "x" ? L.pc.x : L.pc.y;
  const mk = (): Orb => { const el = document.createElementNS(NS, "circle"); el.setAttribute("r", "5.5"); el.setAttribute("fill", "var(--satis-snapshot)"); dots.appendChild(el); return { el, x: start, y: 0, px: start, landedAt: -9 }; };
  const hollow = (o: Orb) => { o.el.setAttribute("fill", "none"); o.el.setAttribute("stroke", "var(--satis-dropped)"); o.el.setAttribute("stroke-width", "1.5"); o.life = 1; o.vy = -40; falling.push(o); };

  function apply(dt: number) {
    stepOutage(s, dt, random);
    for (const e of s.events) {
      if (e.kind === "sampled") orbs.set(e.id, mk());
      if (e.kind === "dropped") { if (!s.backendUp || !s.dbUp) tickGoal(root, "drop"); if (!e.inFlight) { hollow(orbs.get(e.id)!); orbs.delete(e.id); } }
      if (e.kind === "error") { orbs.get(e.id)!.el.setAttribute("fill", "var(--satis-error)"); orbs.get(e.id)!.landedAt = s.t; if (e.at === "backend") tickGoal(root, "db"); }
      if (e.kind === "requeued") { const o = orbs.get(e.id)!; o.el.setAttribute("fill", "var(--satis-snapshot)"); o.landedAt = s.t; }
      if (e.kind === "discarded") { hollow(orbs.get(e.id)!); orbs.delete(e.id); }
      if (e.kind === "stored") { orbs.get(e.id)?.el.remove(); orbs.delete(e.id); }
    }
    if (!s.backendUp && s.queue.length >= 3) tickGoal(root, "wait");
    if (s.queue.length >= 3) sawBacklog = true;
    if (s.backendUp && s.dbUp && sawBacklog && s.queue.length <= 1 && root.querySelector('[data-goal="wait"].done')) tickGoal(root, "drain");
  }

  function draw(dt: number) {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 10);
    s.queue.forEach((q, i) => {
      const o = orbs.get(q.id); if (!o || s.flight?.id === q.id) return;
      if (q.seatedAt === null) o.x = lerp(start, slot(i), ease.inOutCubic(Math.min(1, (s.t - q.takenAt) / 0.9)));
      else o.x += (slot(i) - o.x) * k;
    });
    const f = s.flight;
    if (f) {
      const o = orbs.get(f.id)!; const p = Math.min(1, (s.t - f.startedAt) / f.duration);
      const from = f.phase === "out" ? slot(0) : stationAt(f.target), to = f.phase === "out" ? stationAt(f.target) : slot(0);
      o.x = lerp(from, to, reduced ? 1 : ease.inOutSine(p));
    }
    ghost.setAttribute("opacity", f && !f.dropped ? "0.7" : "0");
    for (const d of falling) { d.vy! += dt * 260; d.y += d.vy! * dt; d.life! -= dt * 0.9; }
    falling = falling.filter((d) => (d.life! > 0 ? true : (d.el.remove(), false)));
    for (const o of [...orbs.values(), ...falling]) {
      const speed = dt > 0 ? (o.x - o.px) / dt : 0; o.px = o.x;
      const { sx, sy } = reduced ? { sx: 1, sy: 1 } : squash(speed, s.t - o.landedAt);
      const pos = along(o.x), ty = pos.y + o.y;
      o.el.setAttribute("transform", L.axis === "x" ? `translate(${pos.x} ${ty}) scale(${sx} ${sy})` : `translate(${pos.x + o.y} ${pos.y}) scale(${sy} ${sx})`);
      if (o.life !== undefined) o.el.setAttribute("opacity", String(Math.max(0, o.life)));
    }
    const mode = s.backendUp && s.dbUp ? "ok" : !s.backendUp ? "be" : "db";
    const cap = root.querySelector(".fig-caption")!;
    if (cap.textContent !== CAPTION[mode]) cap.textContent = CAPTION[mode];
  }

  const loop = startLoop((dt) => { apply(dt); draw(dt); }, { autoplay: !reduced });
  if (reduced) for (let i = 0; i < 160; i++) { apply(0.025); draw(0.025); } // a meaningful paused frame: snapshots on their way
  const setStation = (which: "backend" | "db", down: boolean) => {
    if (which === "backend") setBackendUp(s, !down); else setDbUp(s, !down);
    const st = svg.querySelector(`[data-station="${which}"]`)!;
    st.classList.toggle("down", down); st.classList.toggle("live", !down);
    st.querySelector("[data-sub]")!.textContent = which === "backend" ? (down ? "unreachable" : "ECS Fargate") : down ? "not answering" : "RDS";
    st.querySelectorAll(".led").forEach((l) => l.setAttribute("fill", down ? "var(--satis-error)" : "var(--satis-ok)"));
    root.querySelector(`button[data-toggle="${which}"]`)!.setAttribute("aria-pressed", String(down));
    if (reduced && !loop.playing()) draw(0);
  };
  const toggle = (which: "backend" | "db") => setStation(which, which === "backend" ? s.backendUp : s.dbUp);
  for (const which of ["backend", "db"] as const) {
    root.querySelector(`button[data-toggle="${which}"]`)!.addEventListener("click", () => toggle(which));
    const st = svg.querySelector<SVGGElement>(`[data-station="${which}"]`)!;
    st.addEventListener("click", () => toggle(which));
    st.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(which); } });
  }
  wireControls(root, loop, () => {
    dots.querySelectorAll("circle").forEach((c) => c.remove()); orbs.clear(); falling = []; sawBacklog = false;
    s = initialOutage(); setStation("backend", false); setStation("db", false); draw(0);
  });
  return () => { loop.destroy(); dots.replaceChildren(); };
}
```

Note: the `.led` default fill for the rack is set to `var(--satis-ok)` at mount (`setStation("backend", false)` runs once after wiring):

```ts
  setStation("backend", false); setStation("db", false);
```

Add that line immediately before `wireControls(...)`.

- [ ] **Step 5: Show it on /kit** — in `src/pages/kit.astro`, import and add after the "Card" section:

```astro
---
import OutageFigure from "../worlds/satis/figures/OutageFigure.astro";
import "../worlds/satis/world.css";
---
<section class="section page reveal world-satis">
  <div class="section-head"><p class="kicker">World · satis-manager</p><h2>Figures</h2></div>
  <div class="kit-figures"><OutageFigure /></div>
</section>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build && npx playwright test e2e/figures.spec.ts --reporter=line`
Expected: PASS at all four widths (the phone layout arrives in Task 9; until then the desktop drawing scales down, and the collision test still passes).

- [ ] **Step 7: Run the full gate for the kit page**

Run: `npm run test:dist` (Expected: PASS; the kit page now runs its figure script within its 15 KB budget, Task 6.)
Run: `npx playwright test e2e/loading.spec.ts e2e/a11y.spec.ts e2e/layout.spec.ts --reporter=line` (Expected: PASS; if the reduced-motion check finds a transition, make it use `var(--dur)`, which is 0 under reduced motion.)

- [ ] **Step 8: Commit**

```bash
git add src/worlds/satis/figures/OutageFigure.astro src/worlds/satis/figures/outage-view.ts src/pages/kit.astro e2e/figures.ts e2e/figures.spec.ts
git commit -m "Add the outage figure: the agent's queue under a backend or database failure"
```

### Task 8: Figure 2 (the cutover) — desktop

**Files:**
- Create: `src/worlds/satis/figures/CutoverFigure.astro`, `src/worlds/satis/figures/cutover-view.ts`
- Modify: `src/pages/kit.astro` (add `<CutoverFigure />` under the outage figure), `e2e/figures.spec.ts`

**Interfaces:**
- Consumes: Task 3 model, Task 4 kit, Task 5 `Station`, `CUTOVER`, `routePath`.
- Produces: root `figure.fig[data-figure="cutover"]`; `button[data-next]`, `button[data-prev]`, `button[data-reset]`; the step track `ol.fig-track > li.stp` (5) with `span.conn` between them; stations `data-station` = `pcDb`, `pcBackend`, `b2`, `awsBackend`, `rds`, `agent`, `tunnel`; wires `path.wire#wPc|#wAws|#wAgent`; routes `path.route#routePc|#routeAws`; arcs `path.path-dump#pDump|#pRestore`; goals `switch`, `back`; `mount(root): () => void`.

- [ ] **Step 1: Add the failing e2e tests** to `e2e/figures.spec.ts` (the `import` goes at the top of the file, with the others)

```ts
import { viewAt } from "../src/worlds/satis/model/cutover";

const CUT = 'figure[data-figure="cutover"]';

test.describe("cutover figure", () => {
  test("steps to the switch: the route moves to AWS and the goal ticks", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(CUT).scrollIntoViewIfNeeded();
    for (let i = 0; i < 5; i++) { await page.locator(`${CUT} button[data-next]`).click(); await page.waitForTimeout(i === 1 || i === 2 ? 1700 : 400); }
    await page.waitForTimeout(1300);
    await expect(page.locator(`${CUT} [data-goal="switch"]`)).toHaveClass(/done/);
    const offs = await page.evaluate((sel) => ["routePc", "routeAws"].map((id) => parseFloat(getComputedStyle(document.querySelector(`${sel} #${id}`)!).strokeDashoffset)), CUT);
    expect(offs[1]).toBeCloseTo(0, 0); expect(offs[0]).toBeGreaterThan(10);
  });

  test("rolling back shows that step's rollback and restores the previous view", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(`${CUT} button[data-next]`).click();
    await page.locator(`${CUT} button[data-prev]`).click();
    await expect(page.locator(`${CUT} [data-goal="back"]`)).toHaveClass(/done/);
    await expect(page.locator(`${CUT} [data-station="pcBackend"]`)).toHaveClass(/live/);
  });

  test("ignores Next while the dump is still moving (Review Focus 3)", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(`${CUT} button[data-next]`).click(); // freeze
    await page.locator(`${CUT} button[data-next]`).click(); // backup: the dump starts
    await page.locator(`${CUT} button[data-next]`).click({ force: true }); // pressed mid-animation
    await page.waitForTimeout(1800);
    const v = viewAt(2);
    await expect(page.locator(`${CUT} [data-station="b2"] [data-sub]`)).toHaveText(v.b2Note);
    await expect(page.locator(`${CUT} [data-station="rds"] [data-sub]`)).toHaveText(v.rdsNote);
  });

  test("keyboard only: Next, Roll back and Reset (Review Focus 5)", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(`${CUT} button[data-next]`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`${CUT} .fig-track li`).first()).toHaveClass(/now/);
    await page.locator(`${CUT} button[data-prev]`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`${CUT} button[data-prev]`)).toBeDisabled();
  });

  test("no line crosses a label at any step or mid-switch", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(CUT).scrollIntoViewIfNeeded();
    expect(await labelCollisions(page, CUT)).toEqual([]);
    for (let i = 1; i <= 5; i++) {
      await page.locator(`${CUT} button[data-next]`).click();
      if (i === 5) { for (const ms of [250, 300, 300]) { await page.waitForTimeout(ms); expect(await labelCollisions(page, CUT)).toEqual([]); } }
      await page.waitForTimeout(i === 2 || i === 3 ? 1700 : 1200);
      expect(await labelCollisions(page, CUT)).toEqual([]);
    }
  });

  test("has no step numbers in its track", async ({ page }) => {
    await page.goto("/kit");
    expect(await page.locator(`${CUT} .fig-track`).innerText()).not.toMatch(/\d/);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build && npx playwright test e2e/figures.spec.ts -g "cutover" --project=desktop-1280 --reporter=line`
Expected: FAIL (no cutover figure on /kit).

- [ ] **Step 3: Write `CutoverFigure.astro`** — panels, wires, arcs, routes, stations and the step track from `CUTOVER.desktop` (prototype `figure-cutover.html` v5).

```astro
---
// src/worlds/satis/figures/CutoverFigure.astro — figure 2: the move from the PC to AWS, step by reversible step.
import Station from "../Station.astro";
import Goals from "../../../design/figure/Goals.astro";
import Controls from "../../../design/figure/Controls.astro";
import { CUTOVER, routePath } from "./layouts";
import { COPY, STEP_NAMES, viewAt } from "../model/cutover";
import "../../../design/figure/figure.css";
const d = CUTOVER.desktop, v = viewAt(0);
const ZONES = [["pc", "GAMING PC"], ["off", "OFF-SITE BACKUPS"], ["cf", "CLOUDFLARE"], ["aws", "AWS"]] as const;
---
<Goals goals={[{ id: "switch", text: "Step all the way to the switch." }, { id: "back", text: "Roll a step back and read what it undoes." }]} />
<figure class="fig" data-figure="cutover">
  <svg data-layout="desktop" viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-label="The cutover from the gaming PC to AWS, step by step.">
    {ZONES.map(([z]) => <rect class={`zbg zbg-${z}`} x={d.panels[z].x} y={d.panels[z].y} width={d.panels[z].w} height={d.panels[z].h} rx="12" />)}
    {ZONES.map(([z, name]) => <text class={`zlabel zlabel-${z}`} x={d.panels[z].label.x} y={d.panels[z].label.y} text-anchor={d.panels[z].anchor}>{name}</text>)}
    <g transform={`translate(0 ${d.shift})`}>
      <path class="wire" id="wPc" d={`M${d.pcDb.x} ${d.pcDb.y} H${d.pcBackend.x}`} />
      <path class="wire idle" id="wAws" d={`M${d.awsBackend.x} ${d.awsBackend.y} H${d.rds.x}`} />
      <path class="wire" id="wAgent" d={`M${d.agent.x} ${d.agent.y} H${d.tunnel.x}`} />
      <path id="pDump" class="path-dump" d={d.dump} />
      <path id="pRestore" class="path-dump" d={d.restore} />
      <path id="routePc" class="route" d={routePath(d, "pc")} />
      <path id="routeAws" class="route" d={routePath(d, "aws")} />
      <g data-dots></g>
      <Station kind="db" id="pcDb" zone="pc" x={d.pcDb.x} y={d.pcDb.y} label="PostgreSQL" sub={v.pcDbNote} />
      <Station kind="rack" id="pcBackend" zone="pc" x={d.pcBackend.x} y={d.pcBackend.y} label="Backend" sub={v.pcBackendNote} />
      <Station kind="bucket" id="b2" zone="off" x={d.b2.x} y={d.b2.y} label="Backblaze B2" sub={v.b2Note} />
      <Station kind="rack" id="awsBackend" zone="aws" mode="idle" x={d.awsBackend.x} y={d.awsBackend.y} label="Backend" sub={v.awsBackendNote} />
      <Station kind="db" id="rds" zone="aws" mode="idle" x={d.rds.x} y={d.rds.y} label="PostgreSQL" sub={v.rdsNote} />
      <g transform={`translate(${d.rds.x + 22} ${d.rds.y - 20})`}><g class="check" data-check><circle r="8" fill="var(--satis-ok)" /><path d="M-3.5 0 l2.5 2.5 l4.5 -5" stroke="#12301f" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></g></g>
      <Station kind="pc" id="agent" zone="pc" x={d.agent.x} y={d.agent.y} label="Agent" sub={v.agentNote} />
      <Station kind="tunnel" id="tunnel" zone="cf" x={d.tunnel.x} y={d.tunnel.y} label="Tunnel" sub="api.satis-manager.com" />
    </g>
  </svg>
  <Controls label="Cutover figure controls" speed={false} play={false}>
    <button class="fig-tbtn" type="button" data-prev disabled>↶ Roll back</button>
    <ol class="fig-track">{STEP_NAMES.map((n, i) => <>{i > 0 && <span class="conn" aria-hidden="true"><i></i></span>}<li class="stp">{n}</li></>)}</ol>
    <button class="fig-tbtn primary" type="button" data-next>Next step →</button>
  </Controls>
  <p class="fig-caption" aria-live="polite">{COPY[0].caption}</p>
  <p class="fig-rollback"></p>
</figure>
<script>
  import { whenVisible } from "../../../design/figure/lazy";
  for (const el of document.querySelectorAll<HTMLElement>('figure[data-figure="cutover"]')) {
    whenVisible(el, () => { import("./cutover-view").then((m) => m.mount(el)); });
  }
</script>
```

Add to `world.css` (from the prototype v5 styles):

```css
.zbg { stroke-width: 1; }
.zbg-pc { fill: var(--satis-zone-pc); stroke: var(--satis-zone-pc-rule); } .zbg-off { fill: var(--satis-zone-off); stroke: var(--satis-zone-off-rule); }
.zbg-cf { fill: var(--satis-zone-cf); stroke: var(--satis-zone-cf-rule); } .zbg-aws { fill: var(--satis-zone-aws); stroke: var(--satis-zone-aws-rule); }
.zlabel { font: 700 10px var(--font-text); letter-spacing: .14em; }
.zlabel-pc { fill: var(--satis-zone-pc-ink); } .zlabel-off { fill: var(--satis-zone-off-ink); } .zlabel-cf { fill: var(--satis-zone-cf-ink); } .zlabel-aws { fill: var(--satis-zone-aws-ink); }
.fig .route { stroke: var(--satis-route); stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.fig .path-dump { stroke: var(--satis-backup); stroke-width: 1.5; fill: none; stroke-dasharray: 3 4; opacity: 0; transition: opacity var(--dur); }
.fig .path-dump.on { opacity: .8; }
.fig .check { transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(.5); transition: opacity var(--dur), transform var(--dur) cubic-bezier(.34, 1.56, .64, 1); }
.fig .check.on { opacity: 1; transform: scale(1); }
.fig-track { display: flex; align-items: center; gap: 5px; flex: 1; min-width: 300px; list-style: none; margin: 0; padding: 0; }
.fig-track .stp { flex: 1; text-align: center; font: 600 12px var(--font-text); padding: 9px 10px; border-radius: 7px; background: var(--satis-steel-2); color: var(--fig-dim); white-space: nowrap; transition: background var(--dur), color var(--dur); }
.fig-track .stp.done { color: var(--satis-ok); } .fig-track .stp.now { background: #4a3324; color: var(--satis-route); }
.fig-track .conn { flex: none; width: 14px; height: 1.5px; background: var(--fig-btn-hover); position: relative; }
.fig-track .conn i { position: absolute; inset: 0 auto 0 0; width: 0; background: var(--satis-route); transition: width var(--dur) cubic-bezier(.65, 0, .35, 1); }
.fig-track .conn::after { content: ""; position: absolute; right: -1px; top: -2.5px; border-left: 4px solid var(--fig-btn-hover); border-top: 3px solid transparent; border-bottom: 3px solid transparent; transition: border-left-color var(--dur); }
.fig-track .conn.on i { width: 100%; } .fig-track .conn.on::after { border-left-color: var(--satis-route); }
.fig-rollback { font: 13px/1.5 var(--font-text); color: var(--fig-dim); padding: 0 14px 12px; background: var(--fig-bar); margin: 0; min-height: 1.5em; }
.fig-rollback b { color: #ff8a5c; }
```

- [ ] **Step 4: Write `cutover-view.ts`** — port the prototype's script onto `viewAt`, `COPY`, `routePath`: render(step) sets each station's mode class and sub-label, wires' `idle`, B2/RDS fills and the ✓, the track (`now`/`done`, `conn.on` when `step >= i + 2`), caption and rollback; Next to step 2 and 3 first carries the dump along `#pDump` / `#pRestore` (busy: Next/Roll back ignored until it lands); the route switch retracts `#routePc` then draws `#routeAws` over 1.1 s via `stroke-dashoffset`; snapshots run agent → tunnel → route → backend → its database whenever `view.sending`; reduced motion makes every move instant.

```ts
// src/worlds/satis/figures/cutover-view.ts
import { COPY, LAST_STEP, viewAt, type CutoverView } from "../model/cutover";
import { ease } from "../../../design/figure/ease";
import { prefersReducedMotion, startLoop } from "../../../design/figure/loop";
import { tickGoal } from "../../../design/figure/controls";
import { CUTOVER, type CutoverLayout } from "./layouts";

const NS = "http://www.w3.org/2000/svg";
type Pt = [number, number];

export function mount(root: HTMLElement): () => void {
  const svg = root.querySelector<SVGSVGElement>("svg[data-layout]:not([hidden])") ?? root.querySelector("svg")!;
  const L: CutoverLayout = svg.dataset.layout === "phone" ? CUTOVER.phone : CUTOVER.desktop;
  const reduced = prefersReducedMotion();
  const $ = <T extends Element>(sel: string) => svg.querySelector<T>(sel)!;
  const dots = $<SVGGElement>("[data-dots]");
  const routes = { pc: $<SVGPathElement>("#routePc"), aws: $<SVGPathElement>("#routeAws") };
  const LEN = { pc: routes.pc.getTotalLength(), aws: routes.aws.getTotalLength() };
  for (const k of ["pc", "aws"] as const) routes[k].style.strokeDasharray = `${LEN[k]} ${LEN[k]}`;
  let step = 0, t = 0, r = 0, rTw: { from: number; to: number; t0: number } | null = null, busy = false, nextFlow = 0;
  let carry: { path: SVGPathElement; el: SVGRectElement; t0: number; done: () => void } | null = null;
  let flows: { el: SVGCircleElement; t0: number }[] = [];

  const ZONE: Record<string, string> = { pcBackend: "pc", pcDb: "pc", agent: "pc", b2: "off", awsBackend: "aws", rds: "aws" };
  function render(s: number) {
    const v: CutoverView = viewAt(s);
    const set = (id: string, mode: string, sub: string) => {
      const g = $(`[data-station="${id}"]`); g.setAttribute("class", `st st-${ZONE[id]} ${mode}`); g.querySelector("[data-sub]")!.textContent = sub;
    };
    set("agent", v.agent, v.agentNote); set("pcBackend", v.pcBackend, v.pcBackendNote); set("pcDb", v.pcDb, v.pcDbNote);
    set("b2", "", v.b2Note); set("rds", v.rds, v.rdsNote); set("awsBackend", v.awsBackend, v.awsBackendNote);
    for (const [id, m] of [["pcBackend", v.pcBackend], ["awsBackend", v.awsBackend]] as const)
      $(`[data-station="${id}"]`).querySelectorAll(".led").forEach((l) => l.setAttribute("fill", m === "live" ? "var(--satis-ok)" : "#3a3f44"));
    $(`[data-station="agent"] [data-power]`).setAttribute("fill", v.sending ? "var(--satis-snapshot)" : "#3a3f44");
    $(`[data-station="b2"] [data-fill]`).setAttribute("opacity", v.b2HasDump ? "1" : "0");
    $(`[data-station="rds"] [data-fill]`).setAttribute("opacity", v.countsMatch ? "0.9" : "0");
    $("[data-check]").classList.toggle("on", v.countsMatch);
    $("#wPc").classList.toggle("idle", v.pcBackend !== "live"); $("#wAws").classList.toggle("idle", v.awsBackend !== "live"); $("#wAgent").classList.toggle("idle", v.agent !== "live");
    const to = v.route === "aws" ? 1 : 0;
    if (to !== r && rTw?.to !== to) rTw = reduced ? null : { from: r, to, t0: t };
    if (reduced) r = to;
    root.querySelector(".fig-caption")!.textContent = COPY[s].caption;
    root.querySelector(".fig-rollback")!.innerHTML = s ? `<b>↶ Rollback:</b> ${COPY[s].rollback}` : "";
    root.querySelectorAll(".fig-track .stp").forEach((li, i) => li.className = "stp" + (i + 1 < s ? " done" : i + 1 === s ? " now" : ""));
    root.querySelectorAll(".fig-track .conn").forEach((c, i) => c.classList.toggle("on", s >= i + 2));
    root.querySelector<HTMLButtonElement>("[data-prev]")!.disabled = s === 0;
    root.querySelector<HTMLButtonElement>("[data-next]")!.disabled = s === LAST_STEP;
    if (s === LAST_STEP) tickGoal(root, "switch");
  }

  function carryAlong(pathSel: string, done: () => void) {
    const path = $<SVGPathElement>(pathSel); path.classList.add("on");
    if (reduced) { path.classList.remove("on"); done(); return; }
    busy = true;
    const el = document.createElementNS(NS, "rect"); el.setAttribute("x", "-6"); el.setAttribute("y", "-5"); el.setAttribute("width", "12"); el.setAttribute("height", "10"); el.setAttribute("rx", "2"); el.setAttribute("fill", "var(--satis-backup)"); dots.appendChild(el);
    carry = { path, el, t0: t, done: () => { el.remove(); path.classList.remove("on"); busy = false; carry = null; done(); } };
  }

  function go(to: number) {
    if (busy || to < 0 || to > LAST_STEP) return;
    const from = step; step = to;
    if (to < from) tickGoal(root, "back");
    if (to > from && (to === 2 || to === 3)) { render(to - 1); root.querySelector(".fig-caption")!.textContent = COPY[to].caption; carryAlong(to === 2 ? "#pDump" : "#pRestore", () => render(to)); return; }
    render(to);
  }

  const snapshotPath = (): Pt[] => {
    const aws = r >= 1, b = aws ? L.awsBackend : L.pcBackend, db = aws ? L.rds : L.pcDb;
    const side = b.x < L.tunnel.x ? 1 : -1, bx = b.x + side * 40;
    return [[L.agent.x, L.agent.y], [L.routeExit.x, L.agent.y], [L.routeExit.x, L.gutter], [bx, L.gutter], [bx, b.y], [b.x, b.y], [db.x, db.y]];
  };
  const along = (pts: Pt[], u: number): Pt => {
    const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])); let d = u * segs.reduce((a, b) => a + b, 0);
    for (let i = 0; i < segs.length; i++) { if (d <= segs[i]) { const k = segs[i] ? d / segs[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } d -= segs[i]; }
    return pts[pts.length - 1];
  };

  const loop = startLoop((dt) => {
    t += dt;
    if (rTw) { const p = Math.min(1, (t - rTw.t0) / 1.1); r = rTw.from + (rTw.to - rTw.from) * p; if (p >= 1) rTw = null; }
    const u1 = Math.min(1, r / 0.5), u2 = Math.max(0, (r - 0.5) / 0.5); // retract the PC route, then draw the AWS one
    routes.pc.style.strokeDashoffset = String(LEN.pc * ease.inOutCubic(u1));
    routes.aws.style.strokeDashoffset = String(LEN.aws * (1 - ease.inOutCubic(u2)));
    if (carry) {
      const p = Math.min(1, (t - carry.t0) / 1.3), pt = carry.path.getPointAtLength(ease.inOutCubic(p) * carry.path.getTotalLength()), sp = Math.sin(Math.PI * p) * 0.25;
      carry.el.setAttribute("transform", `translate(${pt.x} ${pt.y}) scale(${1 + sp} ${1 / (1 + sp)})`);
      if (p >= 1) carry.done();
    }
    if (!reduced && viewAt(step).sending && !rTw && t >= nextFlow) {
      nextFlow = t + 1.4; const el = document.createElementNS(NS, "circle"); el.setAttribute("r", "5"); el.setAttribute("fill", "var(--satis-snapshot)"); dots.appendChild(el); flows.push({ el, t0: t });
    }
    flows = flows.filter((f) => {
      const p = Math.min(1, (t - f.t0) / 2.0); const [x, y] = along(snapshotPath(), ease.inOutCubic(p));
      f.el.setAttribute("transform", `translate(${x} ${y})`);
      if (p >= 1 || (!viewAt(step).sending && p < 0.05)) { f.el.remove(); return false; } return true;
    });
  }, { autoplay: true }); // the stepper always runs; under reduced motion every move above is instant

  root.querySelector("[data-next]")!.addEventListener("click", () => go(step + 1));
  root.querySelector("[data-prev]")!.addEventListener("click", () => go(step - 1));
  root.querySelector("[data-reset]")!.addEventListener("click", () => { if (!busy) { step = 0; render(0); } });
  render(0);
  return () => { loop.destroy(); dots.replaceChildren(); };
}
```

- [ ] **Step 5: Add it to /kit** — `import CutoverFigure from "../worlds/satis/figures/CutoverFigure.astro";` and `<CutoverFigure />` after `<OutageFigure />`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build && npx playwright test e2e/figures.spec.ts --reporter=line`
Expected: PASS at all widths. A collision failure names the line and the label: move the label or the line in `layouts.ts`, never weaken the test.

- [ ] **Step 7: Commit**

```bash
git add src/worlds/satis/figures/CutoverFigure.astro src/worlds/satis/figures/cutover-view.ts src/worlds/satis/world.css src/pages/kit.astro e2e/figures.spec.ts
git commit -m "Add the cutover figure: the runbook's steps with their rollbacks"
```

### Task 9: Phone compositions (owner review round)

**Files:**
- Modify: `OutageFigure.astro`, `CutoverFigure.astro` (a second `<svg data-layout="phone" hidden>` drawn from `OUTAGE.phone` / `CUTOVER.phone`), `outage-view.ts`, `cutover-view.ts` (mount on the visible SVG), `src/design/figure/figure.css`, `e2e/figures.spec.ts`
- Create: `src/design/figure/responsive.ts`

**Interfaces:**
- Produces: `mountResponsive(root: HTMLElement, mount: (root: HTMLElement) => () => void, query = "(max-width: 40rem)"): () => void` — shows the matching SVG (`hidden` on the other), mounts on it, and on a media-query change unmounts and remounts once.

- [ ] **Step 1: Write the failing tests** in `e2e/figures.spec.ts`

```ts
test.describe("figures on phones", () => {
  test("use their vertical composition below 40rem, with readable labels", async ({ page, viewport }) => {
    test.skip(viewport!.width > 640, "phones only");
    await page.goto("/kit");
    for (const sel of [OUT, CUT]) {
      await expect(page.locator(`${sel} svg[data-layout="phone"]`)).toBeVisible();
      await expect(page.locator(`${sel} svg[data-layout="desktop"]`)).toBeHidden();
      const smallest = await page.locator(`${sel} svg[data-layout="phone"] text`).evaluateAll((ts) => Math.min(...ts.map((t) => t.getBoundingClientRect().height)));
      expect(smallest).toBeGreaterThanOrEqual(9); // rendered px: no shrunken desktop drawing
      expect(await labelCollisions(page, sel)).toEqual([]);
    }
  });

  test("resizing across the breakpoint remounts once, without leftovers (Review Focus 4)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
    await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(1500);
    expect(await page.locator(`${OUT} svg[data-layout="phone"] [data-dots] *`).count()).toBe(0);
    expect(await page.locator(`${OUT} svg[data-layout="desktop"] [data-dots] circle`).count()).toBeLessThanOrEqual(13);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build && npx playwright test e2e/figures.spec.ts -g "phones" --reporter=line`
Expected: FAIL (no phone SVG).

- [ ] **Step 3: Implement `responsive.ts` and the phone SVGs**

```ts
// src/design/figure/responsive.ts
/** Mounts a figure on whichever of its SVGs fits the screen, and remounts once when that changes. */
export function mountResponsive(root: HTMLElement, mount: (root: HTMLElement) => () => void, query = "(max-width: 40rem)"): () => void {
  const mq = matchMedia(query);
  let unmount: (() => void) | null = null;
  const apply = () => {
    unmount?.();
    const phone = mq.matches;
    root.querySelectorAll<SVGSVGElement>("svg[data-layout]").forEach((s) => s.toggleAttribute("hidden", (s.dataset.layout === "phone") !== phone));
    unmount = mount(root);
  };
  mq.addEventListener("change", apply);
  apply();
  return () => { mq.removeEventListener("change", apply); unmount?.(); };
}
```

In each figure's `<script>`, replace `m.mount(el)` with `mountResponsive(el, m.mount)` (import from `../../../design/figure/responsive`). Server-render both SVGs; CSS shows the right one before any script: add to `figure.css`:

```css
.fig svg[data-layout="phone"] { display: none; }
@media (max-width: 40rem) { .fig svg[data-layout="desktop"] { display: none; } .fig svg[data-layout="phone"] { display: block; } }
.fig svg[hidden] { display: none !important; }
```

Draw the phone SVGs from `OUTAGE.phone` (stations stacked on x = 160, the vertical pill between the PC and the tunnel; the wire is `M160 50 V580`) and `CUTOVER.phone` (the four panels stacked), reusing the same `Station` components with the phone coordinates. In `outage-view.ts` the code already reads `L.axis`; in `cutover-view.ts` `routePath` and `snapshotPath` already use the layout's points.

- [ ] **Step 4: Run them to verify they pass**

Run: `npm run build && npx playwright test e2e/figures.spec.ts --reporter=line`
Expected: PASS at all four widths.

- [ ] **Step 5: Owner review round (gate).** Start the companion (`superpowers:brainstorming` visual companion, `--project-dir` = this worktree), push a page showing both figures at 360 and 390 px (screenshots from `npm run preview`), and ask the owner to approve or adjust. Apply the changes (in `layouts.ts` and the phone SVGs) and re-run Step 4 before committing. Don't continue to Task 10 without the owner's yes.

- [ ] **Step 6: Commit**

```bash
git add src/design/figure/responsive.ts src/design/figure/figure.css src/worlds/satis/figures e2e/figures.spec.ts
git commit -m "Give both figures a vertical composition on phones"
```

### Task 10: The cover, the article and the stills

**Files:**
- Create: `src/worlds/satis/Cover.astro`, `src/worlds/index.ts`, `scripts/render-covers.ts`, `src/content/projects/satisfactory-dash/index.mdx`
- Delete: `src/content/projects/satisfactory-dash/index.md`, `public/diagrams/satisfactory-dash-deployment.svg` (it shows the PC topology, now wrong)
- Modify: `src/layouts/CaseStudy.astro` (a `cover` slot above the header and `class="world-satis"` when `project.world`), `src/pages/projects/[slug].astro`, `src/pages/kit.astro` (`<Cover still />` in the world section), `package.json` (`"render:covers": "tsx scripts/render-covers.ts"`), `tests/dist/case-study.test.ts`, `tests/dist/media.test.ts` if it lists the old diagram

**Interfaces:**
- Consumes: Tasks 7 and 8 figures, Task 5 `Station`, Task 6 budgets.
- Produces: `covers: Record<string, AstroComponentFactory>` in `src/worlds/index.ts` (`{ "satisfactory-dash": Cover }`); `<Cover still? />` with root `.satis-cover` (and `#satis-cover-still` when `still`); `public/covers/satisfactory-dash.png` (1600 × 900) and `public/og/satisfactory-dash.png` (1200 × 630).

- [ ] **Step 1: Write the failing dist tests** — replace the section list, links and media tests in `tests/dist/case-study.test.ts`:

```ts
  it("renders the heading, stack and every section", () => {
    expect(doc.querySelector("h1")?.text).toBe("satisfactory-dash");
    expect(doc.querySelectorAll(".case-study-body > h2, .case-study-body h2").map((h) => h.text.trim())).toEqual([
      "The problem", "How data gets in", "The move to AWS", "What I’d do differently", "How it was built",
    ]);
  });

  it("opens on its cover and places both figures in the article", () => {
    expect(doc.querySelector(".world-satis .satis-cover")).not.toBeNull();
    expect(doc.querySelector('figure[data-figure="outage"]')).not.toBeNull();
    expect(doc.querySelector('figure[data-figure="cutover"]')).not.toBeNull();
  });

  it("keeps the deeper material in closed 'More detail' sections", () => {
    const details = doc.querySelectorAll(".case-study-body details");
    expect(details.length).toBeGreaterThanOrEqual(2);
    for (const d of details) { expect(d.getAttribute("open")).toBeNull(); expect(d.querySelector("summary")?.text).toMatch(/More detail/); }
  });

  it("links every claim's source in the public repo", () => {
    const links = hrefs(doc);
    for (const path of [
      "agent/src/queue.ts", "agent/src/pusher.ts", "agent/src/backoff.ts", "agent/src/agentRunner.ts",
      "frontend/src/components/DataAge.tsx", "infra/aws/ecs.tf", "docs-vault/wiki/runbooks/aws.md",
      "docs-vault/wiki/decisions/0031-edge-agent.md", "docs-vault/wiki/decisions/0034-backend-on-aws.md", "docs-vault/wiki/decisions/0035-backups-off-aws.md",
    ]) expect(links.some((h) => h.startsWith("https://github.com/Sour-Dev-Home/satisfactory-dash/blob/main/" + path)), path).toBe(true);
    expect(links).toContain("https://demo.satis-manager.com");
  });

  // Replaces "ships no JavaScript": the figures now run here, within the page's budget (Task 6).
  it("runs only its own module scripts, from the build", () => {
    const scripts = doc.querySelectorAll(RUNNABLE_SCRIPTS);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(s.getAttribute("type")).toBe("module");
  });

  it("uses a link-preview image made from its cover", () => {
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(`${SITE}/og/satisfactory-dash.png`);
    expect(distFileExists("og/satisfactory-dash.png")).toBe(true);
    expect(distFileExists("covers/satisfactory-dash.png")).toBe(true);
  });
```

Add a size check to `tests/dist/media.test.ts`:

```ts
import sharp from "sharp";
it("ships the satis cover stills at their sizes", async () => {
  const card = await sharp(join(process.cwd(), "dist/covers/satisfactory-dash.png")).metadata();
  const og = await sharp(join(process.cwd(), "dist/og/satisfactory-dash.png")).metadata();
  expect([card.width, card.height, og.width, og.height]).toEqual([1600, 900, 1200, 630]);
});
```

Run: `npm run build && npx vitest run tests/dist/case-study.test.ts tests/dist/media.test.ts --reporter=dot` — Expected: FAIL.

- [ ] **Step 2: Write `Cover.astro`** — the prototype `cover.html` (A v2) with `Station` icons; motion is CSS `offset-path` only.

```astro
---
// src/worlds/satis/Cover.astro — the world's cover: the real system, quietly running. CSS only, no script.
import Station from "./Station.astro";
interface Props { still?: boolean }
const { still = false } = Astro.props;
---
<header class:list={["satis-cover", { still }]} id={still ? "satis-cover-still" : undefined}>
  <div class="satis-cover-text">
    <p class="satis-kick">Case study · in production</p>
    <p class="satis-title">satisfactory-dash</p>
    <p class="satis-sub">A live dashboard for Satisfactory servers, moved from a home PC to AWS.</p>
  </div>
  <svg viewBox="0 0 440 130" aria-hidden="true">
    <path class="wire" d="M60 40 H297 Q305 40 305 48 V92 Q305 100 313 100 H380" />
    <circle class="satis-orb" r="4" /><circle class="satis-orb b" r="4" />
    <Station kind="pc" x={60} y={40} label="" sub="" />
    <Station kind="rack" x={225} y={40} label="" sub="" />
    <Station kind="db" x={380} y={100} label="" sub="" />
  </svg>
  <div class="satis-hazard" aria-hidden="true"></div>
</header>
<style>
  .satis-cover { position: relative; overflow: hidden; background: var(--satis-steel); color: var(--satis-ink); border-radius: 12px; padding: var(--space-6) var(--space-5) var(--space-6); display: grid; gap: var(--space-4); }
  .satis-kick { font: 700 var(--step--1) var(--font-text); letter-spacing: .14em; text-transform: uppercase; color: var(--satis-route); margin: 0; }
  .satis-title { font-family: var(--font-display); font-variation-settings: var(--display-axes); font-size: var(--step-4); line-height: 1; margin: 0; }
  .satis-sub { color: var(--satis-dim); max-width: 34ch; margin: 0; }
  .satis-cover svg { width: 100%; max-width: 560px; }
  .satis-orb { fill: var(--satis-snapshot); offset-path: path("M60 40 H297 Q305 40 305 48 V92 Q305 100 313 100 H380"); animation: satis-run 3.6s linear infinite; }
  .satis-orb.b { animation-delay: -1.8s; }
  @keyframes satis-run { from { offset-distance: 0%; } to { offset-distance: 100%; } }
  .satis-hazard { position: absolute; inset: auto 0 0 0; height: 8px; background: repeating-linear-gradient(-45deg, var(--satis-route) 0 10px, var(--satis-steel) 10px 20px); }
  .still { width: 800px; height: 450px; }
  @media (prefers-reduced-motion: reduce) { .satis-orb { animation: none; offset-distance: 40%; } .satis-orb.b { offset-distance: 80%; } }
  @media (min-width: 48rem) { .satis-cover:not(.still) { grid-template-columns: 1fr 1.2fr; align-items: center; } }
</style>
```

(The orb is drawn before the stations, so it slides out from behind one and into the next; the wire turns in the gap, 25 units clear of each.)

- [ ] **Step 3: Registry, layout and route**

```ts
// src/worlds/index.ts — a project with its own world gets a cover here, keyed by its slug.
import SatisCover from "./satis/Cover.astro";
export const covers: Record<string, typeof SatisCover> = { "satisfactory-dash": SatisCover };
```

In `CaseStudy.astro`: `import "../worlds/satis/world.css";` is too specific for the layout — instead accept a `world` string prop and set `class:list={["case-study page", world && `world-${world}`]}` on the article, render `<slot name="cover" />` as the article's first child, and import `world.css` from `Cover.astro` (it travels with the world). In `[slug].astro`:

```astro
---
import { covers } from "../../worlds";
const Cover = covers[entry.id];
---
<CaseStudy project={project} slug={entry.id} world={entry.data.world ? "satis" : undefined}>
  {Cover && <Cover slot="cover" />}
  <Content />
</CaseStudy>
```

Add `import "./world.css";` at the top of `Cover.astro`'s frontmatter.

- [ ] **Step 4: The stills** — add `<Cover still />` to the kit page's world section, then:

```ts
// scripts/render-covers.ts — renders the cover stills from /kit (run after `npm run build`, against `npm run preview`).
import { chromium } from "@playwright/test";
const base = process.env.BASE_URL ?? "http://127.0.0.1:4321";
const browser = await chromium.launch();
for (const [out, w, h, scale] of [["public/covers/satisfactory-dash.png", 800, 450, 2], ["public/og/satisfactory-dash.png", 800, 420, 1.5]] as const) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: scale, reducedMotion: "reduce" });
  await page.goto(`${base}/kit`, { waitUntil: "networkidle" });
  const el = page.locator("#satis-cover-still");
  await el.evaluate((n, [ww, hh]) => { (n as HTMLElement).style.width = `${ww}px`; (n as HTMLElement).style.height = `${hh}px`; }, [w, h]);
  await el.screenshot({ path: out });
  await page.close();
}
await browser.close();
```

Run: `npm run build`, start `npm run preview -- --host 127.0.0.1 --port 4321` in the background, then `npx tsx scripts/render-covers.ts`, then stop the preview. Expected: two PNGs at 1600 × 900 and 1200 × 630. Read both images to check them before committing. (If `tsx` isn't installed, add it as a devDependency pinned to the current version.)

- [ ] **Step 5: Write the article** — create `index.mdx` with the frontmatter of `index.md` plus `world: true`, `cover: { src: /covers/satisfactory-dash.png }`, `ogImage: /og/satisfactory-dash.png`, then this body. Links use `https://github.com/Sour-Dev-Home/satisfactory-dash/blob/main/<path>` (written below as `[text](gh:<path>)` for brevity: **expand every `gh:` to that URL**). Before committing, open each linked file at that path in the repo and confirm the sentence it supports; cut any claim that doesn't hold.

```mdx
import OutageFigure from "../../../worlds/satis/figures/OutageFigure.astro";
import CutoverFigure from "../../../worlds/satis/figures/CutoverFigure.astro";
import Sidenote from "../../../design/components/Sidenote.astro";
import Aside from "../../../design/components/Aside.astro";
import Figure from "../../../design/components/Figure.astro";

## The problem

Satisfactory players who run a dedicated server can't see how their factory is doing without joining the game. satisfactory-dash is a dashboard for that: production, overflow and power, live, with a [public demo](https://demo.satis-manager.com).

For its first months the backend and its database ran on my gaming PC, beside the game itself. That PC was already short of memory and was never meant to be a server. This is the story of moving the service off it, without losing data and without a way in to my home network.

<Figure caption="The dashboard, running on the demo's sample data.">
  <video width="1920" height="1080" style="aspect-ratio: 1920 / 1080" controls playsinline preload="none" poster="/demo/satisfactory-dash-walkthrough-poster.png"><source src="/demo/satisfactory-dash-walkthrough.mp4" type="video/mp4" /></video>
</Figure>

## How data gets in

The game only answers on the PC itself, so a small agent runs there. It reads the game and pushes what it sees out to the backend, one <span class="tok tok-snapshot"><i>●</i>snapshot</span> at a time, oldest first. The cloud never connects in to the PC, and the game's credentials never leave it ([ADR-0031](gh:docs-vault/wiki/decisions/0031-edge-agent.md)).

Anything the agent can't deliver yet waits in its <span class="tok">queue</span>. If something along the way is down, an <span class="tok tok-error"><i>●</i>error</span> comes back; the agent keeps that snapshot and tries again later, waiting a little longer each time, with some randomness so that many agents don't all retry at once ([pusher.ts](gh:agent/src/pusher.ts), [backoff.ts](gh:agent/src/backoff.ts)).

<OutageFigure />

When the link breaks, something has to give. The system picks availability: the dashboard keeps answering with the last snapshot it has, [marked stale](gh:frontend/src/components/DataAge.tsx), rather than going blank, and the agent keeps collecting. The cost is consistency: history arrives late, and if the outage outlasts the queue (about ten minutes of snapshots, [agentRunner.ts](gh:agent/src/agentRunner.ts)), the oldest readings are <span class="tok tok-dropped"><i>○</i>dropped</span> for good ([queue.ts](gh:agent/src/queue.ts)). For a live dashboard, the newest data matters most.

<Sidenote id="liveness" lead="psst">The first health check I gave the backend on AWS asked "is the database answering?". During RDS's weekly maintenance that would have made AWS replace a perfectly healthy backend after about 90 seconds. It now asks "is the process alive?", and an outside monitor watches the database ([#425](gh:infra/aws/ecs.tf)).</Sidenote>

The figure's database toggle shows that split: with the database down, the backend stays up and says so, and nothing restarts it.

## The move to AWS

AWS's Free plan came with credits, so the backend moved to ECS Fargate (one small ARM task, with Cloudflare's tunnel beside it) and the database to RDS PostgreSQL ([ADR-0034](gh:docs-vault/wiki/decisions/0034-backend-on-aws.md)). The estimate was about $33 a month; a budget alarm fires at $40 ([variables.tf](gh:infra/aws/variables.tf)). Two rules shaped it: nothing in the app may depend on AWS, so leaving is as boring as arriving, and backups leave AWS entirely, to Backblaze B2 with a key that can write but not delete ([ADR-0035](gh:docs-vault/wiki/decisions/0035-backups-off-aws.md)).

Moving a live service is mostly about never being stuck. The [runbook](gh:docs-vault/wiki/runbooks/aws.md) breaks the move into five steps, and no step starts until the one before it checks out. Each has a rollback, and until the last one, the PC still has every byte. The <span class="tok tok-backup"><i>■</i>final backup</span> is the bridge: taken after writes stop, restored into RDS, and checked table by table before anything points at AWS. Only then does the <span class="tok tok-route"><i>━</i>route</span> for `api.satis-manager.com` move.

<CutoverFigure />

<details>
<summary>More detail: the AWS setup</summary>
<Aside>
- No load balancer, no NAT gateway and no inbound rules: the task only connects out, through the tunnel ([ADR-0034](gh:docs-vault/wiki/decisions/0034-backend-on-aws.md)).
- Secrets come from SSM Parameter Store through the task's role; no access key exists.
- One multi-architecture image runs on Fargate, on any VM, or on the PC, and a `compose.yaml` runs the whole stack on one machine, tested in CI.
- ECS checks liveness only; readiness, which includes the database, is for an external monitor ([ecs.tf](gh:infra/aws/ecs.tf)).
</Aside>
</details>

## What I'd do differently

The credits run out in a few months, and the exit is already written: the same image and `compose.yaml` on a cheap VM, with the data moving by `pg_dump` and `pg_restore`, the path the restore rehearsals use. If I did it again I'd build that exit first and treat AWS as the second home, not the first.

<details>
<summary>More detail: security and data</summary>
<Aside>
- Google sign-in (OpenID Connect with PKCE) is implemented and security-reviewed.
- Each server's API token is encrypted at rest (AES-256-GCM), and the backend refuses to call addresses it shouldn't (an SSRF guard).
- Hand-written, parameterised SQL with forward-only migrations, separate database roles, and an audit trail the app can't rewrite.
- Design decisions are recorded as [architecture decision records](https://github.com/Sour-Dev-Home/satisfactory-dash/tree/main/docs-vault/wiki/decisions).
</Aside>
</details>

## How it was built

I built satisfactory-dash with Claude Code, through [lanes](https://github.com/Sour-Dev-Home/lanes): one fresh session per GitHub issue, gated by required checks and reviewer agents, with every change reviewed by me before it merged. The [repository](https://github.com/Sour-Dev-Home/satisfactory-dash) is public.
```

Check before committing: the main read (outside `<details>`) is 900 to 1,100 words (`npx tsx -e` count, or paste into a counter); the `summary` frontmatter stays as is (≤ 125 characters); the `#425` link points at `infra/aws/ecs.tf` lines that mention #425 — if they don't, link the log entry `docs-vault/wiki/log.d/2026-10-17-issue-425-ecs-liveness.md` instead.

- [ ] **Step 6: Delete the stale files** — `git rm src/content/projects/satisfactory-dash/index.md public/diagrams/satisfactory-dash-deployment.svg`; remove any test or page that references the deleted diagram (`grep -rn "satisfactory-dash-deployment" src tests e2e`).

- [ ] **Step 7: Run the full gate**

Run: `npm run lint && npm run typecheck && npx vitest run --reporter=dot && npm run build && npm run test:dist && npx playwright test --reporter=line`
Expected: all PASS (visual comparisons skip locally).

- [ ] **Step 8: Commit**

```bash
git add -A src/content/projects/satisfactory-dash src/worlds src/layouts/CaseStudy.astro src/pages scripts/render-covers.ts public/covers public/og tests package.json package-lock.json
git commit -m "Rebuild the satisfactory-dash case study around the move to AWS"
```

### Task 11: Owner rounds: the draft, the sidenotes, the palette

**Files:**
- Modify: `src/content/projects/satisfactory-dash/index.mdx`, `src/worlds/satis/world.css`, `public/covers/satisfactory-dash.png`, `public/og/satisfactory-dash.png`

- [ ] **Step 1: Push the branch and open a draft PR** ("The satis-manager world"), body: what changed, the three rounds below, and the deferred minors still to come (Task 12).

```bash
git push -u origin design/satis-world
gh pr create --draft --title "The satis-manager world" --body-file <path to a body file in the job tmp dir>
```

- [ ] **Step 2: The draft review (about ten minutes for the owner).** Ask the owner to read the preview on phone and desktop and flag anything wrong or off-voice. Apply their changes; re-run `npx vitest run tests/dist/case-study.test.ts --reporter=dot` after `npm run build`.

- [ ] **Step 3: Sidenotes.** Show the owner the #425 sidenote and the two unconfirmed candidates from the spec (deleting the production tunnel instead of its route; the stale Terraform plan). Keep only the ones the owner approves, in the owner's words; place each right before the paragraph it's about (docs/STYLE.md).

- [ ] **Step 4: The palette round.** With the article and figures in place, open the companion and show two or three palettes for the world (each sets the `--satis-*` tokens, light and dark, and keeps the fixed roles: route, snapshot, error, dropped, backup, one tint per area; red only for failure). Apply the chosen one in `world.css`, check contrast (`npx playwright test e2e/a11y.spec.ts`), then re-render the stills (Task 10 Step 4) and read them.

- [ ] **Step 5: Commit**

```bash
git add src/content/projects/satisfactory-dash/index.mdx src/worlds/satis/world.css public/covers public/og
git commit -m "Apply the owner's review, sidenotes and the world palette"
```

### Task 12: PR #36's deferred minors

**Files:**
- Modify: `src/design/components/Sidenote.astro`, `src/design/motion.css`, `e2e/fonts.spec.ts`, `src/layouts/Shell.astro`, `src/components/Header.tsx` (+ `Header.test.tsx`), `src/design/prose.css`

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/Header.test.tsx — add:
it("marks the current page in the nav", () => {
  render(<Header current="/about" />);
  expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Work" })).not.toHaveAttribute("aria-current");
});
```

```ts
// e2e/sidenote.spec.ts — add:
test("the toggle's accessible name includes what it shows", async ({ page }) => {
  await page.goto("/kit");
  await expect(page.locator(".sidenote-checkbox").first()).toHaveAccessibleName(/psst/i);
});
```

In `e2e/fonts.spec.ts`, extend the measured box to width as well as height (`expect(after.width).toBe(before.width)` next to the height check). Add to `tests/dist/fonts.test.ts` a check that a case-study page preloads `/fonts/public-sans-latin-wght-italic.woff2`. Add to `tests/dist/motion.test.ts` (CSS check) that `.prose` has `display: flow-root` and that `.case-study-body > *` gets a staggered `--reveal-index`.

Run: `npm run build && npx vitest run src/components/Header.test.tsx tests/dist --reporter=dot && npx playwright test e2e/sidenote.spec.ts e2e/fonts.spec.ts --reporter=line` — Expected: the new checks FAIL.

- [ ] **Step 2: Implement**
  - `Sidenote.astro`: `aria-label="Show side note (psst)"` on the checkbox.
  - `Header.tsx`: accept `current?: string`; set `aria-current="page"` on the link whose `href` path equals it; `Shell.astro` passes `current={path}`.
  - `Shell.astro`: when `noteFont` (case studies and kit), also preload `public-sans-latin-wght-italic.woff2`.
  - `prose.css`: `.prose { display: flow-root; }`.
  - `motion.css`: `.case-study-body > :nth-child(-n + 6) { animation: reveal var(--dur-slow) var(--ease-out) both; animation-delay: calc(var(--reveal-index, 0) * 60ms); }` with `--reveal-index` 1 to 6 by `:nth-child`, and nothing under reduced motion (the existing `@media` block).

- [ ] **Step 3: Run the tests to verify they pass**, then the full gate (Task 10 Step 7 commands). Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/design src/components src/layouts e2e tests
git commit -m "Fold in PR #36's minors: psst label, aria-current, italic preload, flow-root, stagger"
```

### Task 13: Baselines, review and ready

- [ ] **Step 1: Regenerate the screenshots** — `gh workflow run "Update screenshots" --ref design/satis-world`; wait (`gh run watch <id> --exit-status`); download the `screenshots` artifact into the job tmp dir; read the case study and kit shots at 390 and 1280 (light and dark); copy into `e2e/__screenshots__/`; commit "Update screenshot baselines for the satis-manager world".
- [ ] **Step 2: Whole-branch review** — one fresh reviewer (most capable model) reads the spec, this plan and `git diff origin/main...HEAD`; fix each finding test-first.
- [ ] **Step 3: CI** — `gh pr checks <n> --watch`; all required checks green (verify, e2e, lighthouse; links also).
- [ ] **Step 4: Mark ready** — `gh pr ready <n>`; update the PR body (what changed, the owner rounds done, the review's findings and fixes); ask the owner to check the preview on phone and desktop and merge.
```
