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
