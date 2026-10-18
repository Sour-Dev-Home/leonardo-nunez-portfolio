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
