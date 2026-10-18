export const MAX_DT = 0.05;
export interface Loop {
  play(): void;
  pause(): void;
  playing(): boolean;
  setSpeed(target: number): void;
  destroy(): void;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One frame loop per figure: dt in seconds, clamped (a hidden tab doesn't fast-forward), scaled by a speed
 *  that eases toward the slider's value, and stopped entirely while paused. */
export function startLoop(
  onFrame: (dt: number) => void,
  opts: { autoplay: boolean; raf?: (cb: FrameRequestCallback) => number; now?: () => number; caf?: (id: number) => void },
): Loop {
  const raf = opts.raf ?? requestAnimationFrame.bind(window);
  const caf = opts.caf ?? cancelAnimationFrame.bind(window);
  const now = opts.now ?? (() => performance.now());
  let playing = opts.autoplay;
  let speed = 1;
  let target = 1;
  let last = now();
  let id = 0;
  let alive = true;
  const frame = (ts: number) => {
    if (!alive) return;
    const real = Math.min(MAX_DT, Math.max(0, (ts - last) / 1000));
    last = ts;
    speed += (target - speed) * Math.min(1, real * 6);
    if (playing) onFrame(real * speed);
    id = raf(frame);
  };
  id = raf(frame);
  return {
    play() {
      playing = true;
      last = now();
    },
    pause() {
      playing = false;
    },
    playing: () => playing,
    setSpeed(t) {
      target = t;
    },
    destroy() {
      alive = false;
      caf(id);
    },
  };
}
