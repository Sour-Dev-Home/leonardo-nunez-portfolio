# The lanes world (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the lanes case study.
- An interactive "one lane's path" figure, driven by a pure mirror of lanes' gate.
- A sourced article with a limits-and-trade-offs section.
- Card and link-preview stills.

**Architecture:**
- **Two pure models** in `src/worlds/lanes/model/`:
  - `gate.ts` mirrors `decideGate` and `requiredReviewers` from lanes' `scripts/lanes/lib.mjs`;
  - `path.ts` turns the reader's four switches into an ordered list of stops, with the gate's exact status text.
- **A small view** (`lane-view.ts`) moves a token along a drawn track between station icons. It reuses the figure kit
  in `src/design/figure/`: loop, controls, goals, lazy and responsive.
- **Integration:** the article is MDX, using the case-study route the satis world already uses.

**Tech Stack:** Astro 7.4 (static, MDX), TypeScript, Vitest, Playwright, sharp, `@playwright/test` (cover stills).

**Spec:** `docs/superpowers/specs/2026-10-18-lanes-world-design.md`

## Global Constraints

- **Gate:** CI, preview deploys and owner review. Lanes is not adopted in this repo (owner, 2026-10-18).
- **Git:**
  - never push to `main`;
  - work on branch `design/lanes-world`;
  - never commit personal information beyond the public branding, absolute local paths, or the workers.dev hostname.
- **Screenshot baselines** come only from the "Update screenshots" workflow.
- **JavaScript budget:** `projects/lanes.html` gets 15,000 gzipped bytes; `kit.html` stays at 15,000; every other page
  stays at 0.
- **Figure standard (as satis):**
  - icons, not boxes; labels never clip panel edges or collide with lines;
  - the token spawns behind stations;
  - eased motion, with dt clamped to 0.05 s;
  - no step numbers;
  - meanings belong in the prose, not in a legend.
- **Accessibility:**
  - figures are `role="img"`;
  - stations are not focusable; labelled toggle buttons are the keyboard path;
  - stepper and action buttons use `aria-disabled`, never `disabled`, so focus never drops to `<body>`.
- **Reduced motion:** no autoplay, a meaningful paused frame, and instant moves when played.
- **Phones (below 40rem):** a vertical composition, with labels to the right of the stations.
- **CI fonts:** CI's Linux fonts set labels wider than Windows does. Leave at least 20 units of clearance between any
  line and any label's estimated edge.
- **Claims:** every claim in the article links its source in `https://github.com/Sour-Dev-Home/lanes/blob/main/<path>`
  or satisfactory-dash, and is checked against that source before committing. A claim that doesn't hold is cut.
- **Article structure:** "Limits and trade-offs" sits in the main read, not inside a closed `<details>`, and names
  Conway's law.
- **Status strings** shown in the figure are lanes' own text, verbatim (`scripts/lanes/lib.mjs`, `decideGate`).

## Review Focus

1. **Toggling a switch mid-run:** the run restarts cleanly from the issue, with no stale token, no pending action
   left enabled, and no goal ticked by the abandoned run. Test: Task 5, "a switch mid-run restarts the lane".
2. **Pressing the action button twice quickly, or when nothing is waiting:** the second press is ignored and the path
   advances one stop. Test: Task 5, "the action button ignores presses with nothing waiting".
3. **Keyboard only:** Tab reaches every switch and the action button, and focus stays on the action button after it
   becomes `aria-disabled`. Test: Task 5, "keyboard only".
4. **Rotating a phone mid-run:** the figure remounts on the other drawing with exactly one token and no leftovers in
   the hidden drawing. Test: Task 6, "resizing across the breakpoint remounts once".
5. **CI's wider fonts:** no line crosses a label at any stop, on desktop or phones. Tests: Task 3, the layout unit
   test with an allowance of 1.3× the estimated label width; Task 5 and 6, the e2e collision tests.

---

### Task 0: Start from current main

**Files:** none.

- [ ] **Step 1:** Wait until the figure-minors PR #42 ("Figures: keep state across rotation, pause off-screen, tidy
  the cutover") is merged or closed. It changes the kit:
  - `mountResponsive<K>(root, mount: (root, kept: Partial<K>) => …)` now carries state across remounts. The lanes
    `mount(root)` below still fits, since it ignores `kept`;
  - `startLoop` requests no frames while paused or idle;
  - a new `whileOnScreen(el, loop)` suspends a loop off-screen.

  Task 5's view should call `whileOnScreen(root, loop)` after `startLoop`, and dispose of it on unmount, using its real
  return type. Then rebase this branch on `origin/main`:

```bash
git fetch origin
git rebase origin/main
```

- [ ] **Step 2:** Re-read the signatures this plan consumes:

```bash
grep -n "^export" src/design/figure/*.ts
```

Expected:
- `startLoop(onFrame, { autoplay })` returns a `Loop` (`play`, `pause`, `playing`, `setSpeed`, `destroy`);
- `wireControls(root, loop, onReset)` returns an unwire function;
- `tickGoal(root, id)`;
- `whenVisible(el, load)`;
- `mountResponsive(root, mount)`.

If the minors PR changed `mountResponsive` or `startLoop`, ledger a ruling and adapt Task 5's calls to the new
signature. Don't change the kit.

### Task 1: The gate model

**Files:**
- Create: `src/worlds/lanes/model/gate.ts`
- Test: `src/worlds/lanes/model/gate.test.ts`

**Interfaces:**
- Produces:
  - `type Tier = "skip" | "quick" | "full"`;
  - `interface PathClass { ui; sensitive; contract; owner; skipOnly: boolean }`;
  - `interface ReviewStatus { state: "success" | "failure"; sha: string }`;
  - `interface GateInputs { issue: number; labels: string[]; issueOpen: boolean; authorCanWrite: boolean; headRef: string; headSha: string; cls: PathClass; contractChange: "none" | "additive" | "breaking"; reviews: Record<string, ReviewStatus>; ownerApproved: boolean; owner?: string }`;
  - `type Stage = "contract" | "review" | "owner" | "ready"`;
  - `interface Decision { state: "success" | "failure" | "pending"; description: string; stage: Stage }`;
  - `requiredReviewers(tier: Tier, cls: PathClass): string[]`;
  - `decide(i: GateInputs): Decision`, which throws for `tier:full`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/worlds/lanes/model/gate.test.ts
import { describe, it, expect } from "vitest";
import { decide, requiredReviewers, type GateInputs, type PathClass } from "./gate";

const PLAIN: PathClass = { ui: false, sensitive: false, contract: false, owner: false, skipOnly: false };
const ok = (over: Partial<GateInputs> = {}): GateInputs => ({
  issue: 7,
  labels: ["tier:quick", "ready"],
  issueOpen: true,
  authorCanWrite: true,
  headRef: "issue-7-retry",
  headSha: "aaa",
  cls: PLAIN,
  contractChange: "none",
  reviews: { "test-hunter": { state: "success", sha: "aaa" } },
  ownerApproved: false,
  ...over,
});

// Each expectation quotes lanes' scripts/lanes/lib.mjs (decideGate, requiredReviewers) verbatim.
describe("requiredReviewers (lib.mjs requiredReviewers)", () => {
  it("adds nothing at tier skip, test-hunter always otherwise, then one reviewer per path class", () => {
    expect(requiredReviewers("skip", { ...PLAIN, ui: true })).toEqual([]);
    expect(requiredReviewers("quick", PLAIN)).toEqual(["test-hunter"]);
    expect(requiredReviewers("quick", { ...PLAIN, ui: true, sensitive: true, contract: true })).toEqual([
      "test-hunter",
      "ui-reviewer",
      "security-reviewer",
      "architecture-advisor",
    ]);
  });
});

describe("decide (lib.mjs decideGate), in lanes' order", () => {
  it("needs exactly one tier label", () => {
    expect(decide(ok({ labels: ["ready"] }))).toEqual({ state: "failure", description: "issue #7 needs exactly one tier:skip|quick|full label", stage: "contract" });
  });
  it("needs the ready label", () => {
    expect(decide(ok({ labels: ["tier:quick"] })).description).toBe("issue #7 is not labelled ready; a maintainer must approve it first");
  });
  it("needs an open issue opened by someone with write access", () => {
    expect(decide(ok({ issueOpen: false })).description).toBe("issue #7 is not open");
    expect(decide(ok({ authorCanWrite: false })).description).toBe("issue #7 was not opened by someone with write access to the repository");
  });
  it("needs the lane's branch name", () => {
    expect(decide(ok({ headRef: "my-branch" })).description).toBe("the PR head branch must match issue-7-*");
  });
  it("checks the skip tier and the contract declaration", () => {
    expect(decide(ok({ labels: ["tier:skip", "ready"] })).description).toBe("tier:skip but the diff changes files outside the skip paths");
    expect(decide(ok({ cls: { ...PLAIN, contract: true } })).description).toBe("contract files changed but 'Contract changes' says none");
  });
  it("waits for a reviewer with no verdict on this commit, and fails on a failing one", () => {
    expect(decide(ok({ reviews: {} }))).toEqual({ state: "pending", description: "waiting for review/test-hunter", stage: "review" });
    // A verdict covers only the commit it names: lanes reads statuses on the PR's head sha.
    expect(decide(ok({ headSha: "bbb" })).description).toBe("waiting for review/test-hunter");
    expect(decide(ok({ reviews: { "test-hunter": { state: "failure", sha: "aaa" } } }))).toEqual({ state: "failure", description: "review/test-hunter is failure", stage: "review" });
  });
  it("sends an owner-only path to the owner, and lets the owner's approval through", () => {
    const rules = ok({ cls: { ...PLAIN, sensitive: true, owner: true }, reviews: { "test-hunter": { state: "success", sha: "aaa" }, "security-reviewer": { state: "success", sha: "aaa" } } });
    expect(decide(rules)).toEqual({ state: "pending", description: "waiting for a code-owner review in GitHub (owner-only path)", stage: "owner" });
    expect(decide({ ...rules, ownerApproved: true, owner: "SourE-dev" })).toEqual({ state: "success", description: "approved by code owner @SourE-dev", stage: "ready" });
  });
  it("passes a clean quick lane unattended", () => {
    expect(decide(ok())).toEqual({ state: "success", description: "unattended-eligible (tier:quick), reviews in", stage: "ready" });
  });
  it("refuses tier:full, which the figure doesn't model", () => {
    expect(() => decide(ok({ labels: ["tier:full", "ready"] }))).toThrow(/not modelled/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/worlds/lanes/model/gate.test.ts --reporter=dot`
Expected: FAIL (cannot resolve `./gate`).

- [ ] **Step 3: Write the model**

```ts
// src/worlds/lanes/model/gate.ts
// A pure mirror of the part of lanes' gate the figure shows: scripts/lanes/lib.mjs `decideGate` (its order and its
// status text, verbatim) and `requiredReviewers`. Simplified on purpose, and only here: tier:quick and tier:skip
// (tier:full's owner wait, fullTierBlocker, isn't drawn), no blockers, no workflow handover, no module map, no
// outside-Scope note, and a complete PR template.
export type Tier = "skip" | "quick" | "full";
export type Stage = "contract" | "review" | "owner" | "ready";
export interface Decision {
  state: "success" | "failure" | "pending";
  description: string;
  stage: Stage;
}
export interface PathClass {
  ui: boolean;
  sensitive: boolean;
  contract: boolean;
  owner: boolean;
  skipOnly: boolean;
}
export interface ReviewStatus {
  state: "success" | "failure";
  sha: string;
}
export interface GateInputs {
  issue: number;
  labels: string[];
  issueOpen: boolean;
  authorCanWrite: boolean;
  headRef: string;
  headSha: string;
  cls: PathClass;
  contractChange: "none" | "additive" | "breaking";
  reviews: Record<string, ReviewStatus>;
  ownerApproved: boolean;
  owner?: string;
}

export function requiredReviewers(tier: Tier, cls: PathClass): string[] {
  if (tier === "skip") return [];
  const out = ["test-hunter"];
  if (cls.ui) out.push("ui-reviewer");
  if (cls.sensitive) out.push("security-reviewer");
  if (cls.contract) out.push("architecture-advisor");
  return out;
}

function tierOf(labels: string[]): Tier | null {
  const tiers = labels.filter((l) => l.startsWith("tier:")).map((l) => l.slice(5));
  return tiers.length === 1 && ["skip", "quick", "full"].includes(tiers[0]) ? (tiers[0] as Tier) : null;
}

export function decide(i: GateInputs): Decision {
  const fail = (description: string, stage: Stage = "contract"): Decision => ({ state: "failure", description, stage });
  const n = i.issue;
  const tier = tierOf(i.labels);
  if (tier === null) return fail(`issue #${n} needs exactly one tier:skip|quick|full label`);
  if (tier === "full") throw new Error("tier:full is not modelled (lib.mjs fullTierBlocker)");
  if (!i.labels.includes("ready")) return fail(`issue #${n} is not labelled ready; a maintainer must approve it first`);
  if (!i.issueOpen) return fail(`issue #${n} is not open`);
  // Fails closed: anything but a literal true is untrusted.
  if (i.authorCanWrite !== true) return fail(`issue #${n} was not opened by someone with write access to the repository`);
  if (!new RegExp(`^issue-${n}-`).test(i.headRef)) return fail(`the PR head branch must match issue-${n}-*`);
  if (tier === "skip" && !i.cls.skipOnly) return fail("tier:skip but the diff changes files outside the skip paths");
  if (i.contractChange === "none" && i.cls.contract) return fail("contract files changed but 'Contract changes' says none");
  if (i.contractChange === "breaking" && !i.labels.includes("contract:breaking")) {
    return fail("a breaking contract change needs the issue label contract:breaking");
  }
  for (const name of requiredReviewers(tier, i.cls)) {
    const s = i.reviews[name];
    // A verdict counts only on the commit it names: the gate reads the statuses of the PR's head sha.
    if (!s || s.sha !== i.headSha) return { state: "pending", description: `waiting for review/${name}`, stage: "review" };
    if (s.state !== "success") return fail(`review/${name} is ${s.state}`, "review");
  }
  const waitOwner = (reason: string): Decision =>
    i.ownerApproved
      ? { state: "success", description: `approved by code owner${i.owner ? ` @${i.owner}` : ""}`, stage: "ready" }
      : { state: "pending", description: `waiting for a code-owner review in GitHub (${reason})`, stage: "owner" };
  if (i.cls.owner) return waitOwner("owner-only path");
  if (tier === "quick" && i.cls.contract) return waitOwner("contract change");
  return { state: "success", description: `unattended-eligible (tier:${tier}), reviews in`, stage: "ready" };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/worlds/lanes/model/gate.test.ts --reporter=dot`
Expected: PASS (9 tests). Then compare each string against `../lanes/scripts/lanes/lib.mjs` lines 1431–1494, by eye.

- [ ] **Step 5: Commit**

```bash
git add src/worlds/lanes/model/gate.ts src/worlds/lanes/model/gate.test.ts
git commit -m "Model lanes' gate for the lanes figure, mirroring decideGate"
```

### Task 2: The path model

**Files:**
- Create: `src/worlds/lanes/model/path.ts`
- Test: `src/worlds/lanes/model/path.test.ts`

**Interfaces:**
- Consumes: Task 1's `decide`, `requiredReviewers`, `GateInputs`, `PathClass`.
- Produces:
  - `STATIONS` (`["issue", "contract", "lane", "pr", "reviewers", "gate", "queue", "main"] as const`);
  - `type StationId`;
  - `interface Switches { sloppy; bug; rules; raced: boolean }`;
  - `type Action = "complete" | "fix" | "approve"`;
  - `type GoalId = "merged" | "form" | "bug" | "rules" | "race"`;
  - `interface Stop { at: StationId; kind: "pass" | "fail" | "wait"; caption: string; action?: Action; goal?: GoalId }`;
  - `journey(sw: Switches): Stop[]`;
  - `reviewersFor(sw: Switches): string[]`;
  - `ACTION_LABEL: Record<Action, string>`;
  - `NO_SWITCHES`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/worlds/lanes/model/path.test.ts
import { describe, it, expect } from "vitest";
import { journey, NO_SWITCHES, reviewersFor, STATIONS } from "./path";

describe("journey", () => {
  it("walks a clean lane through every station once, ending merged", () => {
    const stops = journey(NO_SWITCHES);
    expect([...new Set(stops.map((s) => s.at))]).toEqual([...STATIONS]);
    expect(stops.every((s) => !s.action)).toBe(true);
    expect(stops.find((s) => s.at === "gate")!.caption).toBe("lanes/gate: unattended-eligible (tier:quick), reviews in.");
    expect(stops.at(-1)).toMatchObject({ at: "main", goal: "merged" });
  });
  it("stations only move forward, so the token never runs backwards", () => {
    for (const sw of [NO_SWITCHES, { sloppy: true, bug: true, rules: true, raced: true }]) {
      const idx = journey(sw).map((s) => STATIONS.indexOf(s.at));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  });
  it("a sloppy form stops at the contract check until the reader completes it", () => {
    const stop = journey({ ...NO_SWITCHES, sloppy: true }).find((s) => s.at === "contract")!;
    expect(stop).toMatchObject({ kind: "fail", action: "complete", goal: "form" });
    expect(stop.caption).toMatch(/^Task contract incomplete, so this issue is not ready: missing: scope/);
  });
  it("a bug fails test-hunter, and after the fix the new commit waits for fresh verdicts", () => {
    const at = journey({ ...NO_SWITCHES, bug: true }).filter((s) => s.at === "reviewers");
    expect(at.map((s) => s.kind)).toEqual(["wait", "fail", "wait"]);
    expect(at[1]).toMatchObject({ action: "fix", goal: "bug" });
    expect(at[1].caption).toContain("review/test-hunter is failure");
    expect(at[2].caption).toContain("waiting for review/test-hunter");
  });
  it("touching the rules adds the security reviewer and waits for the owner at the gate", () => {
    expect(reviewersFor({ ...NO_SWITCHES, rules: true })).toEqual(["test-hunter", "security-reviewer"]);
    const gate = journey({ ...NO_SWITCHES, rules: true }).filter((s) => s.at === "gate");
    expect(gate[0]).toMatchObject({ kind: "wait", action: "approve", goal: "rules" });
    expect(gate[0].caption).toBe("lanes/gate: waiting for a code-owner review in GitHub (owner-only path).");
    expect(gate[1].caption).toBe("lanes/gate: approved by code owner @SourE-dev.");
  });
  it("a race makes the queue decide again before merging", () => {
    const queue = journey({ ...NO_SWITCHES, raced: true }).filter((s) => s.at === "queue");
    expect(queue[0]).toMatchObject({ kind: "wait", goal: "race" });
    expect(queue[0].caption).toContain("decides again");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/worlds/lanes/model/path.test.ts --reporter=dot`
Expected: FAIL (cannot resolve `./path`).

- [ ] **Step 3: Write the model**

```ts
// src/worlds/lanes/model/path.ts
// One lane's path, as stops: the reader's switches decide where it stops and why. Gate captions come from decide()
// (gate.ts), so they are lanes' own status text; the other captions describe the real steps (scripts/lanes/start.mjs,
// issue-contract.mjs, the merge queue). The token only moves forward.
import { decide, requiredReviewers, type Decision, type GateInputs, type PathClass, type ReviewStatus } from "./gate";

export const STATIONS = ["issue", "contract", "lane", "pr", "reviewers", "gate", "queue", "main"] as const;
export type StationId = (typeof STATIONS)[number];
export interface Switches {
  sloppy: boolean;
  bug: boolean;
  rules: boolean;
  raced: boolean;
}
export type Action = "complete" | "fix" | "approve";
export type GoalId = "merged" | "form" | "bug" | "rules" | "race";
export interface Stop {
  at: StationId;
  kind: "pass" | "fail" | "wait";
  caption: string;
  action?: Action;
  goal?: GoalId;
}
export const NO_SWITCHES: Switches = { sloppy: false, bug: false, rules: false, raced: false };
export const ACTION_LABEL: Record<Action, string> = { complete: "Complete the form", fix: "Fix and push", approve: "Approve as code owner" };

const ISSUE = 482;
const FIRST = "a1c9e07";
const FIXED = "5be2f14";
const OWNER = "SourE-dev";
const PLAIN: PathClass = { ui: false, sensitive: false, contract: false, owner: false, skipOnly: false };
// lanes.config.json and .github/ are both sensitive (the security reviewer) and owner-only (the owner's review).
const RULES: PathClass = { ...PLAIN, sensitive: true, owner: true };

export function reviewersFor(sw: Switches): string[] {
  return requiredReviewers("quick", sw.rules ? RULES : PLAIN);
}

export function journey(sw: Switches): Stop[] {
  const base: GateInputs = {
    issue: ISSUE,
    labels: ["tier:quick", "ready"],
    issueOpen: true,
    authorCanWrite: true,
    headRef: `issue-${ISSUE}-retry-budget`,
    headSha: FIRST,
    cls: sw.rules ? RULES : PLAIN,
    contractChange: "none",
    reviews: {},
    ownerApproved: false,
    owner: OWNER,
  };
  const gate = (over: Partial<GateInputs>): Decision => decide({ ...base, ...over });
  const reviewers = reviewersFor(sw);
  const passing = (sha: string): Record<string, ReviewStatus> => Object.fromEntries(reviewers.map((n) => [n, { state: "success", sha }]));
  const stops: Stop[] = [
    { at: "issue", kind: "pass", caption: "A task issue: Goal, Acceptance criteria, Interface contract, Scope, Blocked by, Tier." },
  ];
  if (sw.sloppy) {
    stops.push({
      at: "contract",
      kind: "fail",
      caption: "Task contract incomplete, so this issue is not ready: missing: scope. No lane launches.",
      action: "complete",
      goal: "form",
    });
  }
  stops.push(
    { at: "contract", kind: "pass", caption: "Task contract complete: tier quick, 3 acceptance criteria. Labelled ready." },
    { at: "lane", kind: "pass", caption: "A fresh Claude session in its own worktree writes the failing test first, then the code." },
    { at: "pr", kind: "pass", caption: `The lane opens a PR from issue-${ISSUE}-retry-budget that says Closes #${ISSUE}.` },
    { at: "reviewers", kind: "wait", caption: `${gate({}).description}: fresh reviewers (${reviewers.join(", ")}) read the diff.` },
  );
  let head = FIRST;
  if (sw.bug) {
    const failed: Record<string, ReviewStatus> = { ...passing(FIRST), "test-hunter": { state: "failure", sha: FIRST } };
    stops.push(
      { at: "reviewers", kind: "fail", caption: `${gate({ reviews: failed }).description}: it found a bug. The lane has to fix it.`, action: "fix", goal: "bug" },
      { at: "reviewers", kind: "wait", caption: `New commit ${FIXED}: ${gate({ headSha: FIXED, reviews: failed }).description}. A verdict covers only the commit it names.` },
    );
    head = FIXED;
  }
  const reviewed = { headSha: head, reviews: passing(head) };
  const decision = gate(reviewed);
  if (decision.state === "pending") {
    stops.push(
      { at: "gate", kind: "wait", caption: `lanes/gate: ${decision.description}.`, action: "approve", goal: "rules" },
      { at: "gate", kind: "pass", caption: `lanes/gate: ${gate({ ...reviewed, ownerApproved: true }).description}.` },
    );
  } else {
    stops.push({ at: "gate", kind: "pass", caption: `lanes/gate: ${decision.description}.` });
  }
  if (sw.raced) {
    stops.push({
      at: "queue",
      kind: "wait",
      caption: "Another PR merged first. The queue tests the combined commit, and the gate decides again from live inputs, never from the green status already on the PR.",
      goal: "race",
    });
  }
  stops.push(
    { at: "queue", kind: "pass", caption: "The merge queue runs the required checks on the merged commit: verify, security, lanes/gate." },
    { at: "main", kind: "pass", caption: "Merged to main.", goal: "merged" },
  );
  return stops;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/worlds/lanes/model --reporter=dot`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/worlds/lanes/model/path.ts src/worlds/lanes/model/path.test.ts
git commit -m "Model one lane's path: the reader's switches, as stops with the gate's own text"
```

### Task 3: World tokens, stations and layouts

**Files:**
- Create: `src/worlds/lanes/world.css`, `src/worlds/lanes/LaneStation.astro`, `src/worlds/lanes/figures/layouts.ts`
- Test: `src/worlds/lanes/figures/layouts.test.ts`

**Interfaces:**
- Consumes: Task 2's `STATIONS`, `StationId`.
- Produces:
  - `interface Pt { x: number; y: number }`;
  - `interface LaneLayout { w: number; h: number; labels: "below" | "right"; at: Record<StationId, Pt>; track: string }`;
  - `LANES: { desktop: LaneLayout; phone: LaneLayout }`;
  - the `LaneStation` props `{ kind: StationId; x; y; label; sub; labels? }`;
  - CSS classes `.world-lanes`, `.lst` (with `.now`, `.fail`, `.wait`), `.lanes-token`.

- [ ] **Step 1: Write the failing layout test**

```ts
// src/worlds/lanes/figures/layouts.test.ts
import { describe, it, expect } from "vitest";
import { LANES } from "./layouts";
import { STATIONS } from "../model/path";

// Rough label half-width: 12 px semibold at ~6.6 units per character, times 1.3 for CI's wider Linux fonts.
const half = (text: string) => (text.length * 6.6 * 1.3) / 2;
const LONGEST_SUB = "test-hunter, security-reviewer";

describe("lanes layouts", () => {
  it("place every station, inside the drawing", () => {
    for (const l of [LANES.desktop, LANES.phone]) {
      for (const id of STATIONS) {
        const p = l.at[id];
        expect(p.x - 34, id).toBeGreaterThanOrEqual(0);
        expect(p.x + 34, id).toBeLessThanOrEqual(l.w);
      }
    }
  });
  it("desktop: sub-labels below a station clear the track's right-hand turn and the drawing's edges", () => {
    const l = LANES.desktop;
    const turnX = Math.max(...[...l.track.matchAll(/[HV](\d+)|Q(\d+)/g)].map((m) => Number(m[1] ?? m[2])).filter((x) => x > 600));
    for (const id of ["pr", "reviewers"] as const) expect(turnX - (l.at[id].x + half(LONGEST_SUB))).toBeGreaterThanOrEqual(20);
    for (const id of STATIONS) expect(l.at[id].x - half(LONGEST_SUB)).toBeGreaterThanOrEqual(-60); // the leftmost labels may be short ("Task issue")
  });
  it("phone: labels on the right fit inside the drawing", () => {
    const l = LANES.phone;
    for (const id of STATIONS) expect(l.at[id].x + 46 + 2 * half(LONGEST_SUB)).toBeLessThanOrEqual(l.w + 40);
  });
});
```

The phone check allows 40 units of overflow only for the single longest sub-label. Task 6's e2e "nothing clipped"
test is the real guard.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/worlds/lanes/figures/layouts.test.ts --reporter=dot`
Expected: FAIL (cannot resolve `./layouts`).

- [ ] **Step 3: Write the layouts**

```ts
// src/worlds/lanes/figures/layouts.ts
// One lane's path, drawn two ways. Desktop: two rows, the top left to right and the bottom right to left, joined on
// the right, well clear of the labels. Phones: one column, labels to the right.
import type { StationId } from "../model/path";

export interface Pt {
  x: number;
  y: number;
}
export interface LaneLayout {
  w: number;
  h: number;
  labels: "below" | "right";
  at: Record<StationId, Pt>;
  track: string;
}

export const LANES: { desktop: LaneLayout; phone: LaneLayout } = {
  desktop: {
    w: 764,
    h: 300,
    labels: "below",
    at: {
      issue: { x: 80, y: 70 },
      contract: { x: 250, y: 70 },
      lane: { x: 420, y: 70 },
      pr: { x: 590, y: 70 },
      reviewers: { x: 590, y: 215 },
      gate: { x: 420, y: 215 },
      queue: { x: 250, y: 215 },
      main: { x: 80, y: 215 },
    },
    track: "M80 70 H732 Q740 70 740 78 V207 Q740 215 732 215 H80",
  },
  phone: {
    w: 340,
    h: 700,
    labels: "right",
    at: {
      issue: { x: 60, y: 50 },
      contract: { x: 60, y: 136 },
      lane: { x: 60, y: 222 },
      pr: { x: 60, y: 308 },
      reviewers: { x: 60, y: 394 },
      gate: { x: 60, y: 480 },
      queue: { x: 60, y: 566 },
      main: { x: 60, y: 652 },
    },
    track: "M60 50 V652",
  },
};
```

- [ ] **Step 4: Write the station and the world tokens** (placeholder colours until the palette round, Task 8)

```astro
---
// src/worlds/lanes/LaneStation.astro — one station of the lanes figure: an opaque disc that hides the track and
// the token behind it, a flat icon, a label and a sub-label. Not focusable (the figure's buttons are the keyboard path).
import type { StationId } from "./model/path";
interface Props {
  kind: StationId;
  x: number;
  y: number;
  label: string;
  sub: string;
  labels?: "below" | "right";
}
const { kind, x, y, label, sub, labels = "below" } = Astro.props;
const side = labels === "right";
---

<g class="lst" data-station={kind} transform={`translate(${x} ${y})`}>
  <circle class="halo" r="34"></circle>
  {kind === "issue" && (<><circle class="ring" r="16" /><circle class="dotc" r="4" /></>)}
  {kind === "contract" && (<><rect class="body" x="-14" y="-18" width="28" height="36" rx="3" /><rect class="body" x="-7" y="-22" width="14" height="7" rx="2" /><path class="mark" d="M-7 2 l5 5 l9 -10" /></>)}
  {kind === "lane" && (<><rect class="body" x="-22" y="-16" width="44" height="32" rx="4" /><path class="mark" d="M-14 -6 l6 5 l-6 5" /><path class="mark" d="M-4 5 H8" /></>)}
  {kind === "pr" && (<><circle class="ring" cx="-9" cy="-14" r="4.5" /><circle class="ring" cx="-9" cy="14" r="4.5" /><circle class="ring" cx="10" cy="14" r="4.5" /><path class="mark" d="M-9 -9.5 V9.5 M10 9.5 V-2 Q10 -8 4 -8 H-2" /></>)}
  {kind === "reviewers" && (<><circle class="ring" cx="-4" cy="-4" r="11" /><path class="mark" d="M4 4 L15 15" /></>)}
  {kind === "gate" && (<><rect class="body" x="-22" y="-4" width="44" height="8" rx="2" /><rect class="body" x="-24" y="-18" width="6" height="36" rx="2" /><rect class="body" x="18" y="-18" width="6" height="36" rx="2" /></>)}
  {kind === "queue" && (<><rect class="body" x="-18" y="-15" width="36" height="7" rx="2" /><rect class="body" x="-18" y="-3.5" width="36" height="7" rx="2" /><rect class="body" x="-18" y="8" width="36" height="7" rx="2" /></>)}
  {kind === "main" && (<><path class="mark" d="M-20 0 H20" /><circle class="dotc" r="6" /></>)}
  {label && <text class:list={["lbl", { side }]} x={side ? 46 : 0} y={side ? -3 : 52}>{label}</text>}
  {sub && <text class:list={["lbl dim", { side }]} data-sub x={side ? 46 : 0} y={side ? 11 : 66}>{sub}</text>}
</g>
```

```css
/* src/worlds/lanes/world.css — the lanes world. PLACEHOLDER colours until the palette round (plan Task 8).
   Roles are fixed: the token, pass, fail (red is failure only), wait-on-owner, and the track. */
.world-lanes {
  --lanes-bg: #182028;
  --lanes-body: #26313b;
  --lanes-line: #4d5b68;
  --lanes-ink: #e8eef3;
  --lanes-dim: #9eabb7;
  --lanes-token: #5ec8e5;
  --lanes-pass: #6fd49a;
  --lanes-fail: #ef5350;
  --lanes-wait: #e9c46a;
  --fig-bg: var(--lanes-bg);
  --fig-ink: var(--lanes-ink);
  --fig-dim: var(--lanes-dim);
  --fig-rule: #56636f;
  --fig-bar: #1f2830;
  --fig-btn: #33404b;
  --fig-btn-hover: #42505c;
  --fig-accent: var(--lanes-token);
  --fig-on-accent: #0e1a20;
  --fig-done: var(--lanes-pass);
  --fig-on: var(--lanes-pass);
  --fig-off: var(--lanes-fail);
  --fig-off-bg: #4a2628;
}
.lst .halo {
  fill: var(--fig-bg);
}
.lst .body {
  fill: var(--lanes-body);
  stroke: var(--lanes-line);
  stroke-width: 1.5;
}
.lst .ring {
  fill: none;
  stroke: var(--lanes-line);
  stroke-width: 2;
}
.lst .dotc {
  fill: var(--lanes-line);
}
.lst .mark {
  fill: none;
  stroke: var(--lanes-dim);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.lst .lbl {
  fill: var(--lanes-ink);
  font: 600 12px var(--font-text);
  text-anchor: middle;
}
.lst .lbl.dim {
  fill: var(--lanes-dim);
  font-weight: 500;
  font-size: 10.5px;
}
.lst .lbl.side {
  text-anchor: start;
}
.lst > * {
  transition: stroke var(--dur), fill var(--dur);
}
.lst.now .body,
.lst.now .ring {
  stroke: var(--lanes-token);
}
.lst.fail .body,
.lst.fail .ring {
  stroke: var(--lanes-fail);
  stroke-dasharray: 4 3;
}
.lst.wait .body,
.lst.wait .ring {
  stroke: var(--lanes-wait);
}
.lanes-token {
  fill: var(--lanes-token);
  transition: fill var(--dur);
}
.lanes-token.fail {
  fill: var(--lanes-fail);
}
.lanes-token.wait {
  fill: var(--lanes-wait);
}
.world-lanes .fig .wire {
  stroke: var(--lanes-line);
  stroke-width: 2;
  fill: none;
  stroke-dasharray: 2 5;
  stroke-linecap: round;
}
/* Inline words in the prose that name the figure's marks, in their colour; 4.5:1 on --paper in each theme. */
.world-lanes .tok {
  font-weight: 700;
  white-space: nowrap;
}
.world-lanes .tok-pass {
  color: #22744a;
}
.world-lanes .tok-fail {
  color: #b0342a;
}
.world-lanes .tok-wait {
  color: #7a5d0e;
}
@media (prefers-color-scheme: dark) {
  .world-lanes .tok-pass {
    color: #6fd49a;
  }
  .world-lanes .tok-fail {
    color: #ff7b72;
  }
  .world-lanes .tok-wait {
    color: #e9c46a;
  }
}
```

Run `npx prettier --write src/worlds/lanes/LaneStation.astro` only if the repo already formats `.astro` files with
prettier. Otherwise expand the one-line icon fragments by hand to match the style of `src/worlds/satis/Station.astro`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/worlds/lanes --reporter=dot && npm run typecheck`
Expected: PASS; typecheck 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/worlds/lanes/world.css src/worlds/lanes/LaneStation.astro src/worlds/lanes/figures/layouts.ts src/worlds/lanes/figures/layouts.test.ts
git commit -m "Add the lanes world's stations, tokens and two layouts"
```

### Task 4: JavaScript budget for the lanes page

**Files:**
- Modify: `tests/dist/budget.ts`, `tests/dist/case-study.test.ts` (the data-only test), `e2e/pages.ts`

**Interfaces:**
- Produces: `BUDGETS["projects/lanes.html"] = 15_000`. Task 5 is the first task whose build gives the lanes page any
  JavaScript.

- [ ] **Step 1: Write the failing tests**

In `tests/dist/case-study.test.ts`, replace the data-only test:

```ts
describe("data-only projects", () => {
  it("get no page", () => {
    expect(distFileExists("projects/home-lab.html")).toBe(false);
  });
});

describe("lanes case study", () => {
  it("has its page", () => {
    expect(distFileExists("projects/lanes.html")).toBe(true);
  });
});
```

In `tests/dist/budget.ts`:

```ts
export const BUDGETS: Record<string, number> = {
  "projects/satisfactory-dash.html": 15_000,
  "projects/lanes.html": 15_000,
  "kit.html": 15_000,
};
```

In `e2e/pages.ts`, add `{ name: "lanes", path: "/projects/lanes", status: 200 }` after the case-study entry.

Run: `npm run build && npm run test:dist`
Expected: FAIL on "has its page". The lanes entry has no body until Task 7. Task 7 makes this pass, so commit these
test changes in Task 7's commit, not here. Mark this step done when the failure is the expected one.

### Task 5: The figure on desktop

**Files:**
- Create: `src/worlds/lanes/figures/LanePathDrawing.astro`, `src/worlds/lanes/figures/LanePathFigure.astro`,
  `src/worlds/lanes/figures/lane-view.ts`
- Modify: `src/pages/kit.astro` (a `world-lanes` section with `<LanePathFigure />`)
- Test: `e2e/lanes-figure.spec.ts`

**Interfaces:**
- Consumes:
  - Task 2: `journey`, `NO_SWITCHES`, `ACTION_LABEL`, `STATIONS`, `Stop`, `Switches`, `GoalId`;
  - Task 3: `LANES`, `LaneStation`;
  - the kit: `startLoop`, `prefersReducedMotion`, `wireControls`, `tickGoal`, `whenVisible`, `mountResponsive`,
    `ease`, `Goals`, `Controls`.
- Produces:
  - DOM hooks: `figure[data-figure="lanes"]`, `button[data-switch="sloppy|bug|rules|raced"]` (aria-pressed),
    `button[data-act]` (aria-disabled, `data-ready` once mounted), `.fig-caption`, `[data-goal="merged|form|bug|rules|race"]`;
  - `mount(root): () => void`.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// e2e/lanes-figure.spec.ts
import { expect, test, type Page } from "@playwright/test";
import { labelCollisions } from "./figures";

const FIG = 'figure[data-figure="lanes"]';

async function ready(page: Page, speed = "3") {
  await page.goto("/kit");
  await page.locator(FIG).scrollIntoViewIfNeeded();
  await expect(page.locator(`${FIG} button[data-act]`)).toHaveAttribute("data-ready", "");
  await page.locator(`${FIG} input[data-speed]`).fill(speed);
}
const caption = (page: Page) => page.locator(`${FIG} .fig-caption`);
const act = (page: Page) => page.locator(`${FIG} button[data-act]`);

test.describe("lanes figure", () => {
  test("a clean lane reaches main and ticks its goal", async ({ page }) => {
    await ready(page);
    await expect(caption(page)).toHaveText("Merged to main.", { timeout: 30_000 });
    await expect(page.locator('[data-goal="merged"]')).toHaveClass(/done/);
  });

  test("a sloppy form stops at the contract check until completed", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await expect(act(page)).toHaveAttribute("aria-disabled", "false");
    await expect(act(page)).toHaveText("Complete the form");
    await act(page).click();
    await expect(page.locator('[data-goal="form"]')).toHaveClass(/done/);
  });

  test("a bug fails test-hunter, and the fix waits for fresh verdicts", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="bug"]`).click();
    await expect(caption(page)).toContainText("review/test-hunter is failure", { timeout: 20_000 });
    await act(page).click();
    await expect(caption(page)).toContainText("A verdict covers only the commit it names", { timeout: 10_000 });
    await expect(page.locator('[data-goal="bug"]')).toHaveClass(/done/);
  });

  test("touching the rules waits for the owner at the gate", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="rules"]`).click();
    await expect(caption(page)).toHaveText("lanes/gate: waiting for a code-owner review in GitHub (owner-only path).", { timeout: 25_000 });
    await act(page).click();
    await expect(caption(page)).toHaveText("lanes/gate: approved by code owner @SourE-dev.", { timeout: 5_000 });
    await expect(page.locator('[data-goal="rules"]')).toHaveClass(/done/);
  });

  test("a race makes the queue decide again", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="raced"]`).click();
    await expect(caption(page)).toContainText("decides again", { timeout: 30_000 });
    await expect(page.locator('[data-goal="race"]')).toHaveClass(/done/, { timeout: 10_000 });
  });

  test("a switch mid-run restarts the lane (Review Focus 1)", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="bug"]`).click();
    await expect(caption(page)).toContainText("review/test-hunter is failure", { timeout: 20_000 });
    await page.locator(`${FIG} button[data-switch="bug"]`).click(); // off again, mid-run
    await expect(caption(page)).toContainText("A task issue");
    await expect(act(page)).toHaveAttribute("aria-disabled", "true");
    expect(await page.locator(`${FIG} svg[data-layout]:visible .lanes-token`).count()).toBe(1);
    await expect(page.locator('[data-goal="bug"]')).not.toHaveClass(/done/);
  });

  test("the action button ignores presses with nothing waiting (Review Focus 2)", async ({ page }) => {
    await ready(page, "0.4");
    await act(page).click({ force: true });
    await expect(caption(page)).toContainText("A task issue");
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await act(page).dblclick();
    await expect(caption(page)).toContainText("Task contract complete"); // one stop on, not two
  });

  test("keyboard only: Tab reaches the switches and the action, and focus stays put (Review Focus 3)", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} .fig-bar button`).first().focus();
    for (let i = 0; i < 10 && !(await page.evaluate(() => document.activeElement?.getAttribute("data-switch") === "sloppy")); i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator(`${FIG} button[data-switch="sloppy"]`)).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 10 && !(await page.evaluate(() => document.activeElement?.hasAttribute("data-act"))); i++) await page.keyboard.press("Tab");
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect(act(page)).toBeFocused();
    await expect(act(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("opens paused under reduced motion, on a meaningful frame", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/kit");
    await page.locator(FIG).scrollIntoViewIfNeeded();
    await expect(page.locator(`${FIG} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
    await expect(caption(page)).toContainText("A task issue");
    expect(await page.locator(`${FIG} svg[data-layout]:visible .lanes-token`).count()).toBe(1);
  });

  test("no line crosses a label at any stop", async ({ page }) => {
    await ready(page);
    for (const sw of ["rules", "bug"]) await page.locator(`${FIG} button[data-switch="${sw}"]`).click();
    for (let i = 0; i < 6; i++) {
      expect(await labelCollisions(page, FIG)).toEqual([]);
      await page.waitForTimeout(1500);
      if ((await act(page).getAttribute("aria-disabled")) === "false") await act(page).click();
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build && npx playwright test e2e/lanes-figure.spec.ts --project=desktop-1280 --reporter=line`
Expected: FAIL (no `figure[data-figure="lanes"]` on /kit).

- [ ] **Step 3: Write the drawing and the figure**

```astro
---
// src/worlds/lanes/figures/LanePathDrawing.astro — the figure's drawing for one layout (layouts.ts). The token is
// drawn before the stations, so it slides out from behind one and into the next.
import LaneStation from "../LaneStation.astro";
import { LANES } from "./layouts";
import { STATIONS, reviewersFor, NO_SWITCHES } from "../model/path";

interface Props {
  layout: "desktop" | "phone";
}
const { layout } = Astro.props;
const d = LANES[layout];
const LABEL: Record<(typeof STATIONS)[number], [string, string]> = {
  issue: ["Task issue", "the form"],
  contract: ["Contract check", "issue-contract"],
  lane: ["Lane", "fresh session"],
  pr: ["Pull request", "Closes #482"],
  reviewers: ["Reviewers", reviewersFor(NO_SWITCHES).join(", ")],
  gate: ["Gate", "lanes/gate"],
  queue: ["Merge queue", "re-checks"],
  main: ["main", "deployed"],
};
---

<svg data-layout={layout} viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-label="One lane's path from a task issue to main, through its checks.">
  <path class="wire" data-path="track" d={d.track}></path>
  <g data-dots><circle class="lanes-token" r="7" transform={`translate(${d.at.issue.x} ${d.at.issue.y})`}></circle></g>
  {STATIONS.map((id) => <LaneStation kind={id} x={d.at[id].x} y={d.at[id].y} label={LABEL[id][0]} sub={LABEL[id][1]} labels={d.labels} />)}
</svg>
```

```astro
---
// src/worlds/lanes/figures/LanePathFigure.astro — one lane's path (../model/path.ts, from lanes' gate). The first
// frame is static markup; lane-view.ts animates whichever drawing is showing once the figure scrolls into view.
import LanePathDrawing from "./LanePathDrawing.astro";
import Goals from "../../../design/figure/Goals.astro";
import Controls from "../../../design/figure/Controls.astro";
import { journey, NO_SWITCHES } from "../model/path";
import "../../../design/figure/figure.css";
import "../world.css";
const first = journey(NO_SWITCHES)[0].caption;
---

<Goals
  goals={[
    { id: "merged", text: "Watch a clean lane reach main with nobody watching." },
    { id: "form", text: "Send a sloppy task form, then complete it." },
    { id: "bug", text: "Let a reviewer find a bug, and push the fix." },
    { id: "rules", text: "Touch the rules, and approve the PR yourself." },
    { id: "race", text: "Merge another PR first, and watch the queue re-check." },
  ]}
/>
<figure class="fig" data-figure="lanes">
  <LanePathDrawing layout="desktop" />
  <LanePathDrawing layout="phone" />
  <Controls label="Lane figure controls">
    <button class="fig-tbtn" type="button" data-switch="sloppy" aria-pressed="false">Sloppy form</button>
    <button class="fig-tbtn" type="button" data-switch="bug" aria-pressed="false">A bug</button>
    <button class="fig-tbtn" type="button" data-switch="rules" aria-pressed="false">Touch the rules</button>
    <button class="fig-tbtn" type="button" data-switch="raced" aria-pressed="false">Another PR first</button>
    <button class="fig-tbtn primary" type="button" data-act aria-disabled="true">No action needed</button>
  </Controls>
  <p class="fig-caption" aria-live="polite">{first}</p>
</figure>

<script>
  import { whenVisible } from "../../../design/figure/lazy";
  import { mountResponsive } from "../../../design/figure/responsive";
  for (const el of document.querySelectorAll<HTMLElement>('figure[data-figure="lanes"]')) {
    whenVisible(el, () => {
      void import("./lane-view").then((m) => mountResponsive(el, m.mount));
    });
  }
</script>
```

The four switches are `aria-pressed` toggles. figure.css styles a pressed toggle as "down" (a red dot on a dark-red
ground). For lanes, a pressed switch means "on", not "failed", so add this to `src/worlds/lanes/world.css`:

```css
.world-lanes .fig-tbtn[data-switch][aria-pressed="true"] {
  background: color-mix(in srgb, var(--lanes-token) 22%, var(--fig-btn));
}
.world-lanes .fig-tbtn[data-switch][aria-pressed]::before {
  background: var(--lanes-dim);
}
.world-lanes .fig-tbtn[data-switch][aria-pressed="true"]::before {
  background: var(--lanes-token);
}
```

- [ ] **Step 4: Write the view**

```ts
// src/worlds/lanes/figures/lane-view.ts
// Moves the token along the drawn track from stop to stop (../model/path.ts). It dwells at each stop, and waits at
// one with an action until the reader presses the action button. A switch restarts the lane. Under reduced motion,
// moves are instant and nothing plays until the reader presses Play.
import { ACTION_LABEL, journey, NO_SWITCHES, STATIONS, type Stop, type Switches } from "../model/path";
import { ease } from "../../../design/figure/ease";
import { prefersReducedMotion, startLoop } from "../../../design/figure/loop";
import { tickGoal, wireControls } from "../../../design/figure/controls";

const SPEED = 170; // track units per second
const DWELL: Record<Stop["kind"], number> = { pass: 1.4, wait: 2.2, fail: 2.2 };

function visibleSvg(root: HTMLElement): SVGSVGElement {
  return [...root.querySelectorAll<SVGSVGElement>("svg[data-layout]")].find((s) => !s.hasAttribute("hidden"))!;
}

export function mount(root: HTMLElement): () => void {
  const svg = visibleSvg(root);
  const reduced = prefersReducedMotion();
  const track = svg.querySelector<SVGPathElement>('[data-path="track"]')!;
  const token = svg.querySelector<SVGCircleElement>(".lanes-token")!;
  const caption = root.querySelector<HTMLElement>(".fig-caption")!;
  const act = root.querySelector<HTMLButtonElement>("[data-act]")!;
  const switches = [...root.querySelectorAll<HTMLButtonElement>("[data-switch]")];
  const stationEl = (id: string) => svg.querySelector<SVGGElement>(`[data-station="${id}"]`)!;

  // Where each station sits along the track: the sampled point nearest its centre.
  const total = track.getTotalLength();
  const along: Record<string, number> = {};
  for (const id of STATIONS) {
    const g = stationEl(id).transform.baseVal.consolidate()!.matrix;
    let best = 0;
    let bestD = Infinity;
    for (let d = 0; d <= total; d += 2) {
      const p = track.getPointAtLength(d);
      const dist = Math.hypot(p.x - g.e, p.y - g.f);
      if (dist < bestD) [best, bestD] = [d, dist];
    }
    along[id] = best;
  }

  let sw: Switches = { ...NO_SWITCHES };
  let stops: Stop[] = [];
  let i = 0;
  let phase: "travel" | "dwell" | "await" | "done" = "dwell";
  let from = 0;
  let to = 0;
  let t = 0;

  const place = (d: number) => {
    const p = track.getPointAtLength(d);
    token.setAttribute("transform", `translate(${p.x} ${p.y})`);
  };
  function show(stop: Stop) {
    caption.textContent = stop.caption;
    for (const id of STATIONS) stationEl(id).setAttribute("class", `lst${id === stop.at ? ` ${stop.kind === "pass" ? "now" : stop.kind}` : ""}`);
    token.setAttribute("class", `lanes-token${stop.kind === "pass" ? "" : ` ${stop.kind}`}`);
    const waiting = stop.action !== undefined;
    act.setAttribute("aria-disabled", String(!waiting));
    act.textContent = waiting ? ACTION_LABEL[stop.action!] : "No action needed";
    phase = waiting ? "await" : "dwell";
    t = 0;
  }
  function restart() {
    stops = journey(sw);
    i = 0;
    from = to = along.issue;
    place(from);
    show(stops[0]);
  }
  function leave() {
    const goal = stops[i].goal;
    if (goal) tickGoal(root, goal);
    if (i === stops.length - 1) {
      phase = "done";
      return;
    }
    i += 1;
    from = to;
    to = along[stops[i].at];
    if (to === from || reduced) {
      place(to);
      show(stops[i]);
    } else {
      phase = "travel";
      t = 0;
    }
  }

  function frame(dt: number) {
    t += dt;
    if (phase === "travel") {
      const span = Math.abs(to - from) / SPEED;
      const p = Math.min(1, t / span);
      place(from + (to - from) * ease.inOutSine(p));
      if (p >= 1) show(stops[i]);
    } else if (phase === "dwell" && t >= DWELL[stops[i].kind]) {
      // The last stop (main) ticks its goal, then rests.
      leave();
    }
  }

  const loop = startLoop(frame, { autoplay: !reduced });
  const unwire = wireControls(root, loop, restart);
  const onAct = () => {
    if (phase !== "await") return; // nothing waiting, or already pressed (Review Focus 2)
    leave();
  };
  const onSwitch = (b: HTMLButtonElement) => () => {
    const key = b.dataset.switch as keyof Switches;
    sw = { ...sw, [key]: !sw[key] };
    b.setAttribute("aria-pressed", String(sw[key]));
    restart(); // Review Focus 1: a changed lane starts over
  };
  const offs = switches.map((b) => {
    const fn = onSwitch(b);
    b.addEventListener("click", fn);
    return () => b.removeEventListener("click", fn);
  });
  act.addEventListener("click", onAct);
  restart();
  act.setAttribute("data-ready", "");
  return () => {
    loop.destroy();
    unwire();
    offs.forEach((f) => f());
    act.removeEventListener("click", onAct);
    place(along.issue);
  };
}
```

Each switch's goal ticks when the token leaves the stop that carries it. "race" carries its goal on its wait stop.

A switch pressed back off restarts the run before any goal of that run has ticked, so Review Focus 1's "no goal from
the abandoned run" holds. The reason is that goals tick on *leaving* a stop: the bug goal sits on the fail stop, which
only ticks after the action is pressed.

- [ ] **Step 5: Put the figure on /kit**

In `src/pages/kit.astro`, import `LanePathFigure` and add a section after the satis world's section:

```astro
<section class="kit-writing page reveal world-lanes">
  <div class="section-head"><p class="kicker">World · lanes</p><h2>Figure</h2></div>
  <LanePathFigure />
</section>
```

- [ ] **Step 6: Run the tests**

Run:

```bash
npm run build && npx playwright test e2e/lanes-figure.spec.ts --project=desktop-1280 --reporter=line
npx playwright test e2e/a11y.spec.ts e2e/loading.spec.ts e2e/figures.spec.ts --reporter=line
npm run test:dist
```

Expected:
- all PASS;
- the kit stays within 15,000 bytes (the test:dist budget test);
- axe shows no serious or critical violations in light or dark.

- [ ] **Step 7: Commit**

```bash
git add src/worlds/lanes src/pages/kit.astro e2e/lanes-figure.spec.ts
git commit -m "Add the lanes figure: one lane's path through its checks, with four switches"
```

- [ ] **Step 8: Owner review round (gate)**

Put desktop screenshots of the figure in the visual companion: one per switch, plus the clean run. Wait for the
owner's yes or changes before Task 6. The rules from the satis rounds apply: icons, spacing, clear labels, motion
that reads well.

### Task 6: Phones

**Files:**
- Modify: `e2e/lanes-figure.spec.ts`, and `src/worlds/lanes/figures/layouts.ts` only if the review asks for it

- [ ] **Step 1: Write the failing phone tests** (append to `e2e/lanes-figure.spec.ts`)

```ts
test.describe("lanes figure on phones", () => {
  test("uses the vertical drawing below 40rem, readable and collision-free", async ({ page, viewport }) => {
    test.skip(viewport!.width > 640, "phones only");
    await page.goto("/kit");
    await page.locator(FIG).scrollIntoViewIfNeeded();
    await expect(page.locator(`${FIG} svg[data-layout="phone"]`)).toBeVisible();
    await expect(page.locator(`${FIG} svg[data-layout="desktop"]`)).toBeHidden();
    const smallest = await page.locator(`${FIG} svg[data-layout="phone"] text`).evaluateAll((ts) => Math.min(...ts.map((t) => t.getBoundingClientRect().height)));
    expect(smallest).toBeGreaterThanOrEqual(9);
    expect(await labelCollisions(page, FIG)).toEqual([]);
    const clipped = await page.locator(FIG).evaluate((fig) => {
      const f = fig.getBoundingClientRect();
      return [...fig.querySelectorAll(".fig-bar button, svg[data-layout='phone'] text")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < f.left - 0.5 || r.right > f.right + 0.5); })
        .map((el) => el.textContent?.trim());
    });
    expect(clipped).toEqual([]);
  });

  test("resizing across the breakpoint remounts once (Review Focus 4)", async ({ page, viewport }) => {
    test.skip(viewport!.width !== 1280, "one run is enough");
    await ready(page);
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(800);
    expect(await page.locator(`${FIG} svg[data-layout="desktop"] .lanes-token`).count()).toBe(1);
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(page.locator(`${FIG} button[data-switch="sloppy"]`)).toHaveAttribute("aria-pressed", "true"); // one listener, not two
  });
});
```

- [ ] **Step 2: Run them**

Run: `npm run build && npx playwright test e2e/lanes-figure.spec.ts --reporter=line`
Expected:
- the phone tests pass on phone-360 and phone-390;
- the control bar fits, since its buttons wrap; if one is clipped, see Step 3;
- the resize test passes.

- [ ] **Step 3: Fix what fails**

The likely fix is the control bar on phones. Five buttons wrap inside `.fig-bar`, but if one is clipped, give the
switches their own full-width row, the same way satis's `.fig-track` does under `@media (max-width: 40rem)`:

```css
@media (max-width: 40rem) {
  .world-lanes .fig-bar [data-switch] {
    flex: 1 1 calc(50% - 8px);
  }
  .world-lanes .fig-bar [data-act] {
    flex: 1 1 100%;
  }
}
```

Re-run Step 2 until green.

- [ ] **Step 4: Commit, then owner review (gate)**

```bash
git add e2e/lanes-figure.spec.ts src/worlds/lanes
git commit -m "Fit the lanes figure to phones"
```

Put screenshots at 360 and 390 in the companion, and wait for the owner's yes before Task 7.

### Task 7: The article, the cover and the stills

**Files:**
- Create:
  - `src/content/projects/lanes/index.mdx`, which replaces `index.md` (`git rm` the `.md`);
  - `src/worlds/lanes/Cover.astro`;
  - `src/worlds/index.ts`;
  - `tests/dist/lanes.test.ts`.
- Modify:
  - `scripts/render-covers.mjs`, so it takes a list of covers;
  - `src/pages/projects/[slug].astro`, so the world's name comes from `src/worlds/index.ts`;
  - `src/pages/kit.astro`, adding `<div class="kit-still"><LanesCover still /></div>`;
  - `tests/dist/media.test.ts`, adding the lanes stills;
  - Task 4's test changes, included in this commit.

**Interfaces:**
- Produces:
  - `WORLDS: Record<string, string>` in `src/worlds/index.ts` (`{ "satisfactory-dash": "satis", lanes: "lanes" }`);
  - `#lanes-cover-still`;
  - `public/covers/lanes.png` (1600 × 900) and `public/og/lanes.png` (1200 × 630).

- [ ] **Step 1: Write the failing dist tests**

```ts
// tests/dist/lanes.test.ts
import { describe, it, expect } from "vitest";
import { SITE, page, metaContent, hrefs, distFileExists } from "./helpers";
import { RUNNABLE_SCRIPTS } from "./budget";

const GH = "https://github.com/Sour-Dev-Home/lanes/blob/main/";

describe("lanes case study", () => {
  const doc = page("projects/lanes.html");

  it("renders its sections, limits and trade-offs in the main read", () => {
    expect(doc.querySelector("h1")?.text).toBe("lanes");
    expect(doc.querySelectorAll(".case-study-body h2").map((h) => h.text.trim())).toEqual([
      "The problem",
      "How a lane ships",
      "What it refuses",
      "Results",
      "Limits and trade-offs",
      "How it was built",
    ]);
    const limits = doc.querySelectorAll(".case-study-body h2").find((h) => h.text.trim() === "Limits and trade-offs")!;
    expect(limits.closest("details")).toBeNull();
    expect(doc.querySelector(".case-study-body")!.text).toMatch(/Conway’s law|Conway's law/);
  });

  it("places its figure in a lanes world", () => {
    expect(doc.querySelector('.world-lanes figure[data-figure="lanes"]')).not.toBeNull();
  });

  it("links each claim's source", () => {
    const links = hrefs(doc);
    for (const path of [
      "scripts/lanes/lib.mjs",
      "scripts/lanes/gate.mjs",
      "docs/SECURITY.md",
      "docs/history/2026-09-29-lanes-v0.1.0-snapshot.md",
      "docs/history/2026-09-30-lane-size-and-cost.md",
      "docs/history/2026-10-02-lanes-depends-on-the-owners-machine.md",
      "docs/history/2026-10-01-retire-solo-profile.md",
    ]) {
      expect(links.some((h) => h.startsWith(GH + path)), path).toBe(true);
    }
    expect(links).toContain("/projects/satisfactory-dash");
  });

  it("keeps deeper material in closed 'More detail' sections", () => {
    const more = doc.querySelectorAll(".case-study-body details").filter((d) => /More detail/.test(d.querySelector("summary")?.text ?? ""));
    expect(more.length).toBeGreaterThanOrEqual(1);
    for (const d of doc.querySelectorAll(".case-study-body details")) expect(d.hasAttribute("open")).toBe(false);
  });

  it("runs only module scripts, and previews with its own still", () => {
    for (const s of doc.querySelectorAll(RUNNABLE_SCRIPTS)) expect(s.getAttribute("type")).toBe("module");
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(`${SITE}/og/lanes.png`);
    expect(distFileExists("covers/lanes.png")).toBe(true);
  });
});
```

Add to `tests/dist/media.test.ts`, inside the existing describe:

```ts
it("ships the lanes cover stills at their sizes", async () => {
  const card = await sharp(join(process.cwd(), "dist/covers/lanes.png")).metadata();
  const og = await sharp(join(process.cwd(), "dist/og/lanes.png")).metadata();
  expect([card.width, card.height, og.width, og.height]).toEqual([1600, 900, 1200, 630]);
});
```

Run: `npm run build && npm run test:dist`
Expected: FAIL (no lanes page, no stills).

- [ ] **Step 2: The world registry and the route**

```ts
// src/worlds/index.ts — which world a case study belongs to, by its slug. Each world's CSS travels with its figures.
export const WORLDS: Record<string, string> = { "satisfactory-dash": "satis", lanes: "lanes" };
```

In `src/pages/projects/[slug].astro`:
- add `import { WORLDS } from "../../worlds";`
- change `world={entry.data.world ? "satis" : undefined}` to `world={entry.data.world ? WORLDS[entry.id] : undefined}`.

- [ ] **Step 3: The cover**

`src/worlds/lanes/Cover.astro` is a copy of `src/worlds/satis/Cover.astro`'s structure, with these changes:
- root id `lanes-cover-still`;
- classes `lanes-cover world-lanes`;
- imports `./world.css` and `./LaneStation.astro`;
- kicker "Case study · in use";
- title "lanes";
- subtitle "Parallel AI sessions that ship to main unattended, behind required checks.";
- the drawing: three stations with their labels, `issue` ("Task issue", "one per lane") → `gate` ("Gate", "lanes/gate") → `main` ("main", "merged");
- a `wire` path `M70 60 H450` in a `viewBox="0 0 520 140"`, at x 70, 260 and 450, y 60;
- the token animated with `offset-path` along that path, with the same reduced-motion fallback;
- the hazard strip uses `var(--lanes-token)`.

Copy the satis file and change exactly those values. The CSS rules keep the same names with a `lanes-` prefix in
place of `satis-`.

- [ ] **Step 4: The stills**

Change `scripts/render-covers.mjs`'s `shots` to come from a list of covers:

```js
const covers = [
  { id: "satis-cover-still", name: "satisfactory-dash" },
  { id: "lanes-cover-still", name: "lanes" },
];
const shots = covers.flatMap(({ id, name }) => [
  [id, `public/covers/${name}.png`, 800, 450, 2],
  [id, `public/og/${name}.png`, 800, 420, 1.5],
]);
```

In the loop, destructure `[id, out, w, h, scale]` and locate `#${id}`. Add the lanes still to /kit's lanes section.

Then:
1. build;
2. start `npx astro preview --host 127.0.0.1 --port 4321` in the background;
3. run `npm run render:covers`;
4. run `npx astro preview stop`.

Read both new PNGs to check them. Re-rendering the satis stills must leave them visually unchanged.

- [ ] **Step 5: The article** — create `src/content/projects/lanes/index.mdx`

The frontmatter keeps `name`, `summary` (≤ 125 characters), `stack`, `repoUrl`, `emphasis` and `order`, and adds
`world: true`, `cover: { src: /covers/lanes.png }` and `ogImage: /og/lanes.png`.

Rewrite `description` from the facts below. The current one is stale: "158 tests as of PR #7", "a GitHub App is
planned", "Still a pilot".

**Before writing, re-count and check every number** against its source (the spec's "Claims and their sources"
table). Use the counts you get, not the ones below.

```bash
gh pr list -R Sour-Dev-Home/lanes --state merged --search "head:issue-" --limit 1000 --json number --jq length
gh pr list -R Sour-Dev-Home/satisfactory-dash --state merged --search "head:issue-" --limit 300 --json number --jq length
ls ../lanes/docs/adr | wc -l
```

Body (links written `[text](lanes:<path>)` here; **expand every `lanes:` to
`https://github.com/Sour-Dev-Home/lanes/blob/main/<path>`**):

```mdx
import LanePathFigure from "../../../worlds/lanes/figures/LanePathFigure.astro";
import Aside from "../../../design/components/Aside.astro";

## The problem

I build with several Claude Code sessions at once. Each is fast, and none of them should be trusted with `main`, which deploys. Nobody watches at night. So the question lanes answers is narrow: how can AI sessions ship to `main` unattended without ever breaking it?

The answer is to make GitHub's required checks the only gatekeeper. No session can merge by being persuasive; a change merges only when the checks say so.

## How a lane ships

A lane is one fresh Claude session for one GitHub issue, in its own worktree. It reads a task contract, writes the failing test first, then the code, and opens a pull request. Fresh reviewer agents read the diff: [test-hunter always, and the security, UI and architecture reviewers when the files call for them](lanes:scripts/lanes/lib.mjs). Then [`lanes/gate`](lanes:scripts/lanes/gate.mjs) decides, and the merge queue checks the merged result once more.

<LanePathFigure />

Each switch in the figure is a real rule, and every status line is the gate's own text.

## What it refuses

The gate fails closed: an unread input, an unknown permission or a list that might be cut short all count as "no". A verdict covers only the commit it names, so a lane can't fix a bug and keep its old approval. The files that decide the rules themselves (the workflows, the config) always wait for my review.

It is honest about what it can't do. It stops honest mistakes and strangers, not a lane that turns hostile, and it doesn't certify the code it merges ([SECURITY.md](lanes:docs/SECURITY.md)).

## Results

lanes was built with itself: <N lanes> lane PRs merged into the lanes repository between September 27 and October 18. It then ran [satisfactory-dash](/projects/satisfactory-dash), where <N sd> lane PRs merged in four days.

A measurement of 76 lanes showed what a lane costs: from a median of 2.4M tokens for changes under 50 lines to 17.1M for 500 to 1,000, with reviewers' serious findings steady at about 0.2 per 100 changed lines whatever the size ([lane size and cost](lanes:docs/history/2026-09-30-lane-size-and-cost.md)).

## Limits and trade-offs

lanes is not a general answer, and its own history says so.

**Conway's law.** Lanes talk to each other only through issues, and each sees only its own files, so the system was built in file-sized slices. Changes that needed a holistic view were split, then queued one after another anyway, and I had to merge issues back together by hand ([v0.1.0 snapshot](lanes:docs/history/2026-09-29-lanes-v0.1.0-snapshot.md)). The tool's structure shaped the work's structure. One ~200-line change became four serial lanes costing about 15M tokens, against 6 to 8M as one. I changed the rule: issues are now split by size, about 100 to 300 changed lines, not by module ([decision](lanes:docs/history/2026-09-30-lane-size-and-cost.md)).

**A fixed cost per lane.** Every lane pays to read its context and run its reviewers. Under 50 changed lines, that costs four to five times more per line. Small, tightly coupled work is cheaper in one session.

**Guards as a patch chain.** Filtering what a session types into a shell can always be dodged; each fix closed the gap the last review found, and the chain had no natural end ([snapshot](lanes:docs/history/2026-09-29-lanes-v0.1.0-snapshot.md)). That is why the real gate judges results on GitHub, not intentions in a terminal.

**One machine.** The queue and every lane run on my computer. When it sleeps, nothing new starts or gets fixed ([recorded, deferred](lanes:docs/history/2026-10-02-lanes-depends-on-the-owners-machine.md)).

**Not hands-off.** Approvals, launches and upgrades stay with me by design. An early mode that let lanes act as me was retired because it caused more bugs than it saved ([retired](lanes:docs/history/2026-10-01-retire-solo-profile.md)).

**When not to use it.** This site. It is small, static and mine alone, and its CI and my reviews are enough, so I chose not to install lanes here.

<details>
<summary>More detail: the parts of a lane</summary>
<Aside>
- A task issue form with Goal, Acceptance criteria, Interface contract, Scope, Blocked by and Tier, checked by issue-contract before any lane launches.
- Tiers: skip (docs and tests only), quick and full; reviewers are chosen by tier and by the files changed.
- Lanes act as a GitHub App, never as me; my approval is a native code-owner review.
- A token budget per night and per lane, read from local records and sent nowhere.
</Aside>
</details>

## How it was built

lanes was built through lanes: its own changes went through its own gate, which is how most of the trade-offs above were found. It is open source on [GitHub](https://github.com/Sour-Dev-Home/lanes).
```

Replace `<N lanes>` and `<N sd>` with the re-counted numbers before committing. These are the only two values
deliberately left for execution time, because they change daily.

Check all of these before committing:
- every linked file exists at that path in lanes' `main` (`gh api repos/Sour-Dev-Home/lanes/contents/<path> --silent`);
- each sentence matches its source;
- the "More detail" bullets match `../lanes/README.md` and `docs/USING.md`;
- the main read (outside `<details>`) is 700 to 1,000 words.

- [ ] **Step 6: Run the full gate**

Run:

```bash
npm run lint && npm run typecheck && npx vitest run --reporter=dot && npm run build && npm run test:dist && npx playwright test --reporter=line
```

Expected: all PASS (screenshot comparisons skip locally). The new `lanes` entry in `e2e/pages.ts` adds the page to
the axe, layout, loading and font suites.

- [ ] **Step 7: Commit**

```bash
git rm src/content/projects/lanes/index.md
git add src/content/projects/lanes src/worlds src/pages scripts/render-covers.mjs public/covers public/og tests e2e/pages.ts
git commit -m "Add the lanes case study: the figure, the trade-offs, and its cover"
```

### Task 8: Owner rounds: the draft, the palette, the sidenotes

**Files:**
- Modify: `src/content/projects/lanes/index.mdx`, `src/worlds/lanes/world.css`, `public/covers/lanes.png`,
  `public/og/lanes.png`

- [ ] **Step 1:** Push, and open a draft PR "The lanes world". The body says what changed and the rounds still to come.
- [ ] **Step 2: The draft read.** Send the owner the preview link for `/projects/lanes`. Apply their changes, then
  re-run `npm run build && npx vitest run --config vitest.dist.config.ts tests/dist/lanes.test.ts --reporter=dot`.
- [ ] **Step 3: Sidenotes.** Ask whether any story deserves a sidenote, in the owner's words. Add only the ones they
  approve, each placed right before its paragraph.
- [ ] **Step 4: The palette round.**
  - Render the real figure under 2–3 candidate `--lanes-*` palettes, using the satis palette script's approach:
    inject CSS and screenshot the figure in each state.
  - Show them in the companion. Each palette must be distinct from satis's amber, and red means failure only.
  - Apply the chosen one, check contrast with `npx playwright test e2e/a11y.spec.ts`, re-render the stills and read
    them.
- [ ] **Step 5: Commit**

```bash
git add src/content/projects/lanes/index.mdx src/worlds/lanes/world.css public/covers/lanes.png public/og/lanes.png
git commit -m "Apply the owner's review and the lanes palette"
```

### Task 9: Baselines, review and ready

- [ ] **Step 1: Baselines.**
  1. Run `gh workflow run "Update screenshots" --ref design/lanes-world`, then `gh run watch <id> --exit-status`.
  2. Download the `screenshots` artifact into the job tmp dir.
  3. Copy only the four viewport folders into `e2e/__screenshots__/`.
  4. Read the lanes and kit shots at 390 and 1280, light and dark.
  5. Commit "Update screenshot baselines for the lanes world".
- [ ] **Step 2: Whole-branch review.** Send a fresh reviewer, on the most capable model, the spec, this plan, the
  ledger's rulings and `git diff origin/main...HEAD`. Fix each Critical or Important finding test-first.
- [ ] **Step 3: CI.** Run `gh pr checks <n> --watch` and wait until all checks are green.
- [ ] **Step 4: Ready.** Run `gh pr ready <n>` and update the PR body with the rounds and the review's findings and
  fixes. Then ask the owner to check the preview and merge.
