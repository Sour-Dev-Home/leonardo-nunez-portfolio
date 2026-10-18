import { describe, it, expect } from "vitest";
import { ease, lerp, squash } from "./ease";

describe("ease", () => {
  it("starts at 0, ends at 1, and is symmetric (slow in, slow out)", () => {
    for (const f of [ease.inOutCubic, ease.inOutSine]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
      expect(f(0.25) + f(0.75)).toBeCloseTo(1, 6);
      expect(f(0.1)).toBeLessThan(0.1); // slow in
    }
  });
  it("lerps", () => expect(lerp(10, 20, 0.25)).toBe(12.5));
  it("stretches with speed up to 1.25 and keeps area (sx * sy ≈ 1) when not wobbling", () => {
    const fast = squash(10_000, 9);
    expect(fast.sx).toBeCloseTo(1.25, 6);
    expect(fast.sx * fast.sy).toBeCloseTo(1, 6);
    expect(squash(0, 9)).toEqual({ sx: 1, sy: 1 });
  });
  it("wobbles after landing and settles within half a second", () => {
    expect(squash(0, 0).sx).toBeLessThan(1);
    expect(squash(0, 0.6)).toEqual({ sx: 1, sy: 1 });
  });
});
