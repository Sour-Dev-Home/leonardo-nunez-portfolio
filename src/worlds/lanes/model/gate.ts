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
