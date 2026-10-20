import { describe, expect, it } from "vitest";
import { framesOf, replayFixed } from "./storyboard";

const beat = (id: string, at: number, mids?: number[]) => ({ id, at, mids, teaches: "", caption: "", holds: () => true as const });

describe("framesOf", () => {
  it("numbers every still, mids before their beat", () => {
    expect(framesOf({ beats: [beat("a", 1), beat("b", 3, [2])] })).toEqual([
      { name: "01-a", at: 1 },
      { name: "02-b-mid1", at: 2 },
      { name: "03-b", at: 3 },
    ]);
  });

  it("refuses frames out of time order", () => {
    expect(() => framesOf({ beats: [beat("a", 5), beat("b", 3)] })).toThrow(/out of order at b/);
  });
});

describe("replayFixed", () => {
  it("steps at 60 Hz and applies each input when it is due", () => {
    const s = replayFixed(
      () => ({ t: 0, flag: -1 }),
      (st, dt) => void (st.t += dt),
      1,
      [{ at: 0.5, click: "", apply: (st) => void (st.flag = st.t) }],
    );
    expect(s.t).toBeCloseTo(1, 6);
    expect(s.flag).toBeCloseTo(0.5, 6);
  });
});
