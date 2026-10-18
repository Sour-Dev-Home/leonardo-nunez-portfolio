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
