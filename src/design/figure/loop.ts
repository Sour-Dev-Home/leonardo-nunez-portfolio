export const MAX_DT = 0.05;
export interface Loop {
  play(): void;
  pause(): void;
  /** The reader's choice: true unless they paused it. Being off-screen or idle doesn't change it. */
  playing(): boolean;
  setSpeed(target: number): void;
  /** Off-screen: stop asking for frames until resume(). A reader's pause still holds after resume(). */
  suspend(): void;
  resume(): void;
  /** Starts frames again after a frame reported it had nothing left to move. */
  wake(): void;
  destroy(): void;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One frame loop per figure: dt in seconds, clamped (a hidden tab doesn't fast-forward), scaled by a speed
 *  that eases toward the slider's value. It asks for no frames while paused, suspended (off-screen), or
 *  asleep: a frame that returns false has nothing left to move, and the loop waits for wake(). */
export function startLoop(
  onFrame: (dt: number) => unknown, // `false` (exactly) means idle; anything else keeps it running
  opts: { autoplay: boolean; raf?: (cb: FrameRequestCallback) => number; now?: () => number; caf?: (id: number) => void },
): Loop {
  const raf = opts.raf ?? requestAnimationFrame.bind(window);
  const caf = opts.caf ?? cancelAnimationFrame.bind(window);
  const now = opts.now ?? (() => performance.now());
  let playing = opts.autoplay;
  let suspended = false;
  let asleep = false;
  let alive = true;
  let speed = 1;
  let target = 1;
  let last = now();
  let id = 0;
  let scheduled = false;
  const running = () => alive && playing && !suspended && !asleep;
  const frame = (ts: number) => {
    scheduled = false;
    if (!running()) return;
    const real = Math.min(MAX_DT, Math.max(0, (ts - last) / 1000));
    last = ts;
    speed += (target - speed) * Math.min(1, real * 6);
    if (onFrame(real * speed) === false) asleep = true;
    schedule();
  };
  const schedule = () => {
    if (scheduled || !running()) return;
    scheduled = true;
    id = raf(frame);
  };
  // Starting again after a stop: the time spent stopped isn't a frame's worth of motion.
  const restart = () => {
    if (!scheduled) last = now();
    schedule();
  };
  const cancel = () => {
    scheduled = false;
    caf(id);
  };
  schedule();
  return {
    play() {
      playing = true;
      restart();
    },
    pause() {
      playing = false;
      cancel();
    },
    playing: () => playing,
    setSpeed(t) {
      target = t;
    },
    suspend() {
      suspended = true;
      cancel();
    },
    resume() {
      suspended = false;
      restart();
    },
    wake() {
      asleep = false;
      restart();
    },
    destroy() {
      alive = false;
      cancel();
    },
  };
}

/** Suspends `loop` while `el` is off-screen, so a figure scrolled past costs nothing. */
export function whileOnScreen(el: Element, loop: Loop): () => void {
  if (typeof IntersectionObserver !== "function") return () => {};
  const io = new IntersectionObserver((entries) => {
    if (entries[entries.length - 1].isIntersecting) loop.resume();
    else loop.suspend();
  });
  io.observe(el);
  return () => io.disconnect();
}
