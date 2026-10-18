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
    expect(decide(ok({ labels: ["ready"] }))).toEqual({
      state: "failure",
      description: "issue #7 needs exactly one tier:skip|quick|full label",
      stage: "contract",
    });
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
    expect(decide(ok({ reviews: { "test-hunter": { state: "failure", sha: "aaa" } } }))).toEqual({
      state: "failure",
      description: "review/test-hunter is failure",
      stage: "review",
    });
  });
  it("sends an owner-only path to the owner, and lets the owner's approval through", () => {
    const rules = ok({
      cls: { ...PLAIN, sensitive: true, owner: true },
      reviews: { "test-hunter": { state: "success", sha: "aaa" }, "security-reviewer": { state: "success", sha: "aaa" } },
    });
    expect(decide(rules)).toEqual({ state: "pending", description: "waiting for a code-owner review in GitHub (owner-only path)", stage: "owner" });
    expect(decide({ ...rules, ownerApproved: true, owner: "SourE-dev" })).toEqual({
      state: "success",
      description: "approved by code owner @SourE-dev",
      stage: "ready",
    });
  });
  it("passes a clean quick lane unattended", () => {
    expect(decide(ok())).toEqual({ state: "success", description: "unattended-eligible (tier:quick), reviews in", stage: "ready" });
  });
  it("refuses tier:full, which the figure doesn't model", () => {
    expect(() => decide(ok({ labels: ["tier:full", "ready"] }))).toThrow(/not modelled/);
  });
});
