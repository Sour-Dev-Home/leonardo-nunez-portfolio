import { describe, it, expect, vi } from "vitest";
import { MAX_DT, startLoop, whileOnScreen, type Loop } from "./loop";

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
    pending: () => cb !== null,
    advance(ms: number) {
      now += ms;
    },
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

describe("startLoop: no frames when nothing moves", () => {
  it("requests no frames while paused, and starts again on play", () => {
    const fr = fakeFrames();
    const loop = startLoop(() => {}, { autoplay: true, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16);
    loop.pause();
    expect(fr.pending()).toBe(false);
    loop.play();
    expect(fr.pending()).toBe(true);
  });

  it("stops while suspended (off-screen) and resumes without un-pausing a reader's pause", () => {
    const fr = fakeFrames();
    let total = 0;
    const loop = startLoop((dt) => (total += dt), { autoplay: true, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16);
    loop.suspend();
    expect(fr.pending()).toBe(false);
    const before = total;
    fr.frame(16);
    expect(total).toBe(before);
    expect(loop.playing()).toBe(true); // suspended is not paused: the reader didn't press anything
    loop.resume();
    fr.frame(16);
    expect(total).toBeGreaterThan(before);

    loop.pause();
    loop.suspend();
    loop.resume();
    expect(loop.playing()).toBe(false);
    expect(fr.pending()).toBe(false);
  });

  it("doesn't count the time it was suspended", () => {
    const fr = fakeFrames();
    const dts: number[] = [];
    const loop = startLoop((dt) => dts.push(dt), { autoplay: true, raf: fr.raf, caf: fr.caf, now: fr.now });
    fr.frame(16);
    loop.suspend();
    fr.advance(5000);
    loop.resume();
    fr.frame(16);
    expect(dts.at(-1)).toBeCloseTo(0.016, 5);
  });

  it("sleeps when a frame reports it's idle, and wakes on wake()", () => {
    const fr = fakeFrames();
    let busy = true;
    let n = 0;
    const loop = startLoop(
      () => {
        n++;
        return busy;
      },
      { autoplay: true, raf: fr.raf, caf: fr.caf, now: fr.now },
    );
    fr.frame(16);
    busy = false;
    fr.frame(16);
    expect(fr.pending()).toBe(false);
    expect(n).toBe(2);
    busy = true;
    loop.wake();
    fr.frame(16);
    expect(n).toBe(3);
    expect(fr.pending()).toBe(true);
  });
});

describe("whileOnScreen", () => {
  it("suspends the loop when its element leaves the viewport and resumes it when it returns", () => {
    let cb: IntersectionObserverCallback | null = null;
    let disconnected = false;
    class FakeIO {
      constructor(f: IntersectionObserverCallback) {
        cb = f;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);
    const calls: string[] = [];
    const loop = { suspend: () => calls.push("suspend"), resume: () => calls.push("resume") } as unknown as Loop;
    const stop = whileOnScreen(document.createElement("div"), loop);
    const fire = (isIntersecting: boolean) => cb!([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    fire(false);
    fire(true);
    expect(calls).toEqual(["suspend", "resume"]);
    stop();
    expect(disconnected).toBe(true);
    vi.unstubAllGlobals();
  });
});
