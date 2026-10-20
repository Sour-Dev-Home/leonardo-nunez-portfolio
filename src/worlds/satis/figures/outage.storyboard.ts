// Figure 1's storyboard, written after the fact as the worked example for
// .claude/skills/storyboard-motion. The beats follow the figure's goals (OutageFigure.astro).
import { CAPACITY, initialOutage, setBackendUp, stepOutage, type OutageState } from "../model/outage";
import { seeded } from "../model/random";
import { replayFixed, type Input, type Storyboard } from "../../../design/figure/storyboard";
import { CAPTION } from "./outage-view";

const SEED = 4; // outage-view.ts: seeded(4)
const backend = 'button[data-toggle="backend"]';
const inputs: Input<OutageState>[] = [
  { at: 4, click: backend, apply: (s) => setBackendUp(s, false) },
  { at: 30, click: backend, apply: (s) => setBackendUp(s, true) },
];

export const outageStoryboard: Storyboard<OutageState> = {
  figure: "outage",
  page: "/projects/satisfactory-dash",
  seed: SEED,
  inputs,
  replay: (at, ins) => {
    const random = seeded(SEED);
    return replayFixed(initialOutage, (s, dt) => void stepOutage(s, dt, random), at, ins);
  },
  beats: [
    {
      id: "flowing",
      teaches: "Normally each snapshot is sent as soon as it is taken, so the queue stays short.",
      caption: CAPTION.ok,
      at: 3.5,
      holds: (s) => (s.backendUp && s.queue.length <= 2) || `queue ${s.queue.length}`,
    },
    {
      id: "waiting",
      teaches: "With the backend down, the error comes back and snapshots wait in the queue.",
      caption: CAPTION.be,
      at: 10,
      mids: [4.6],
      enter: { dur: "base", ease: "ease-out", reduced: "instant", moves: "the backend station turns red; the head snapshot bounces back from the tunnel" },
      holds: (s) => (!s.backendUp && s.queue.length >= 3 && s.failures >= 1) || `queue ${s.queue.length}, failures ${s.failures}`,
    },
    {
      id: "full",
      teaches: "A full queue drops its oldest snapshot: newest data matters most.",
      caption: CAPTION.be,
      at: 28,
      enter: { dur: 0.9, ease: "inOutCubic", reduced: "instant", moves: "the queue fills; the oldest orb falls away" },
      holds: (s) => s.queue.length === CAPACITY || `queue ${s.queue.length}`,
    },
    {
      id: "drained",
      teaches: "When it comes back, the agent finds out at its next retry and drains the backlog oldest first.",
      caption: CAPTION.ok,
      at: 48,
      mids: [36],
      enter: { dur: 0.4, ease: "inOutSine", reduced: "instant", moves: "orbs leave the head one after another, faster than they arrived" },
      holds: (s) => (s.backendUp && s.failures === 0 && s.queue.length <= 2) || `queue ${s.queue.length}, failures ${s.failures}`,
    },
  ],
};
