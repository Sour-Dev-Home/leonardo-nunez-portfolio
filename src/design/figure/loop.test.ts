import { describe, it, expect } from "vitest";
import { MAX_DT, startLoop } from "./loop";

function fakeFrames() {
  let cb: FrameRequestCallback | null = null;
  let now = 0;
  return {
    raf: (f: FrameRequestCallback) => {
      cb = f;
      return 1;
    },
    caf: () => {
      cb = null;
    },
    now: () => now,
    frame(ms: number) {
      now += ms;
      const f = cb;
      cb = null;
      f?.(now);
    },
  };
}

describe("startLoop", () => {
  it("clamps a long gap (a background tab) to MAX_DT (Review Focus 1)", () => {
    const fr = fakeFrames();
    const dts: number[] = [];
    startLoop((dt) => dts.push(dt), { autoplay: true, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16);
    fr.frame(10_000);
    expect(Math.max(...dts)).toBeLessThanOrEqual(MAX_DT + 1e-9);
  });
  it("does not advance while paused, and resumes on play", () => {
    const fr = fakeFrames();
    let total = 0;
    const loop = startLoop((dt) => (total += dt), { autoplay: false, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16);
    fr.frame(16);
    expect(total).toBe(0);
    loop.play();
    fr.frame(16);
    fr.frame(16);
    expect(total).toBeGreaterThan(0);
  });
  it("eases speed toward its target instead of jumping", () => {
    const fr = fakeFrames();
    const dts: number[] = [];
    const loop = startLoop((dt) => dts.push(dt), { autoplay: true, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16);
    loop.setSpeed(3);
    fr.frame(16);
    fr.frame(16);
    expect(dts[1]).toBeGreaterThan(dts[0]);
    expect(dts[1]).toBeLessThan(0.016 * 3);
  });
});
