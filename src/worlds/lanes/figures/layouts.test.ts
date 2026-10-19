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
