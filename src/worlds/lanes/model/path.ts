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
      {
        at: "reviewers",
        kind: "fail",
        caption: `${gate({ reviews: failed }).description}: it found a bug. The lane has to fix it.`,
        action: "fix",
        goal: "bug",
      },
      {
        at: "reviewers",
        kind: "wait",
        caption: `New commit ${FIXED}: ${gate({ headSha: FIXED, reviews: failed }).description}. A verdict covers only the commit it names.`,
      },
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
      caption:
        "Another PR merged first. The queue tests the combined commit, and the gate decides again from live inputs, never from the green status already on the PR.",
      goal: "race",
    });
  }
  stops.push(
    { at: "queue", kind: "pass", caption: "The merge queue runs the required checks on the merged commit: verify, security, lanes/gate." },
    { at: "main", kind: "pass", caption: "Merged to main.", goal: "merged" },
  );
  return stops;
}
