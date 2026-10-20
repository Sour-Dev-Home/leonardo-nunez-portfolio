// A figure's storyboard, as data: the beats a figure must reach, checked against its pure model (Vitest)
// and captured as stills from the built page (e2e/frames.spec.ts). Nothing here ships to the browser:
// only tests import a storyboard. See .claude/skills/storyboard-motion/SKILL.md.

/** Duration tokens, as in src/design/tokens.css (--dur-fast, --dur, --dur-slow), or a sim length in seconds. */
export type Dur = "fast" | "base" | "slow" | number;
/** CSS tokens (tokens.css) for DOM transitions; ease.ts curves for movement a view computes per frame. */
export type Easing = "ease-out" | "ease-in-out" | "inOutCubic" | "inOutSine" | "outQuad" | "linear";
/** What a transition becomes under prefers-reduced-motion: an instant cut, or a held still the reader steps. */
export type Reduced = "instant" | "hold";

export interface Transition {
  dur: Dur;
  ease: Easing;
  reduced: Reduced;
  /** Optional: what moves, in one line ("the head snapshot travels to the tunnel and back"). */
  moves?: string;
}

/** A reader's action, at a sim time: a click on `click` inside the figure, and the same action on the model. */
export interface Input<S> {
  at: number;
  click: string;
  /** For a range input: the value the reader drags it to (capture sets it and fires "input" instead of clicking). */
  value?: number;
  apply: (s: S) => void;
}

export interface Beat<S> {
  /** kebab-case, stable: the still's file name. */
  id: string;
  /** The one idea this beat teaches, from the script. */
  teaches: string;
  /** The caption the figure shows at this beat, word for word. */
  caption: string;
  /** Sim seconds since the figure mounted. */
  at: number;
  /** Extra sim times to capture on the way into this beat (mid-transition stills). */
  mids?: number[];
  /** Into this beat from the one before. The first beat has none. */
  enter?: Transition;
  /** True when the model state is this beat; a string says what is wrong. */
  holds: (s: S) => true | string;
}

export interface Storyboard<S> {
  /** The figure's data-figure attribute. */
  figure: string;
  /** A built page that shows the figure. */
  page: string;
  /** The seed the view passes to seeded() (src/worlds/satis/model/random.ts). */
  seed: number;
  inputs: Input<S>[];
  beats: Beat<S>[];
  /** Runs the pure model from its initial state to `at`, applying every input due by then. */
  replay: (at: number, inputs: Input<S>[]) => S;
}

/** One still to capture, in time order. */
export interface Frame {
  name: string;
  at: number;
}

/** What frame capture needs from any storyboard, whatever its model type. */
export interface Capturable {
  figure: string;
  page: string;
  inputs: readonly { at: number; click: string; value?: number }[];
  beats: readonly { id: string; at: number; mids?: number[] }[];
}

/** Every still a storyboard asks for: each beat, preceded by its mid-transition frames, numbered in order. */
export function framesOf(board: Pick<Capturable, "beats">): Frame[] {
  const out: { id: string; at: number }[] = [];
  for (const b of board.beats) {
    (b.mids ?? []).forEach((at, i) => out.push({ id: `${b.id}-mid${i + 1}`, at }));
    out.push({ id: b.id, at: b.at });
  }
  for (let i = 1; i < out.length; i++) if (out[i].at < out[i - 1].at) throw new Error(`storyboard frames out of order at ${out[i].id}`);
  return out.map((f, i) => ({ name: `${String(i + 1).padStart(2, "0")}-${f.id}`, at: f.at }));
}

/** Fixed-step replay for a time-driven model: `step(s, dt)` at 60 Hz until `at`, inputs applied when due. */
export function replayFixed<S>(init: () => S, step: (s: S, dt: number) => void, at: number, inputs: Input<S>[]): S {
  const s = init();
  const due = [...inputs].sort((a, b) => a.at - b.at);
  const dt = 1 / 60;
  let t = 0;
  while (t < at - 1e-9) {
    while (due.length && due[0].at <= t + 1e-9) due.shift()!.apply(s);
    step(s, dt);
    t += dt;
  }
  return s;
}
