// Figure 3's storyboard (machine states): one machine, the reader changes its input fill, output and
// power, and the figure says which state the dashboard gives it. The model is machineState.ts, a port of
// classifyBuilding; every rule below cites the dash's code, in Sour-Dev-Home/satisfactory-dash:
//   C = backend/src/modules/telemetry/services/classifyBuilding.ts
//   W = docs-vault/wiki/machine-states.md
// The beats follow the dash's own order of checks (C:39-48): paused, unpowered, idle, backed up,
// underfed, producing. The question: why does the dashboard call this machine what it calls it?
// The captions live here until the view exists; then the view owns them and this imports them.
import { classify, runningMachine, type Machine } from "../model/machineState";
import type { Input, Storyboard } from "../../../design/figure/storyboard";

const SEED = 0; // the model is not random; unused

/** Reader actions, as buttons for now (the sliders arrive with the view). Times are sim seconds. */
const btn = (what: string) => `button[data-set="${what}"]`;
const inputs: Input<Machine>[] = [
  { at: 7, click: btn("input-40"), apply: (m) => Object.assign(m, { inputFill: 40, outputPercent: 40 }) },
  { at: 13, click: btn("output-full"), apply: (m) => Object.assign(m, { inputFill: 100, outputPercent: 0, outputFull: true }) },
  { at: 19, click: btn("output-slow"), apply: (m) => Object.assign(m, { outputFull: false, outputPercent: 9.4 }) },
  { at: 25, click: btn("power-off"), apply: (m) => Object.assign(m, { powered: false }) },
  { at: 29, click: btn("power-on"), apply: (m) => Object.assign(m, { powered: true }) },
  { at: 31, click: btn("pause"), apply: (m) => Object.assign(m, { paused: true }) },
  { at: 35, click: btn("resume"), apply: (m) => Object.assign(m, { paused: false }) },
  { at: 37, click: btn("clear-recipe"), apply: (m) => Object.assign(m, { recipe: false }) },
];

export const CAPTION = {
  producing: "Inputs are in and the output runs at the set rate: producing.",
  underfed: "Input is short and the output is under 95% of the set rate: underfed, and the dash names the missing input.",
  backedUp: "An output slot is full: backed up, whatever the inputs are doing.",
  throttled: "Every input is full but the output is under 95%: the output is the bottleneck, so backed up, not underfed.",
  unpowered: "Off the grid, or the fuse tripped: unpowered, whatever the buffers hold.",
  paused: "Paused is checked first, so it beats even a power cut.",
  idle: "No recipe set: idle. Only paused and unpowered are checked before it.",
} as const;

/** A limit the stills print under a beat. W:54-55: a fluid ingredient has no inventory slot, so a machine with a
 *  fluid input (a refinery) is never "inputs full", and an output-throttled refinery still reads underfed. */
export const FOOTNOTES: Partial<Record<string, string>> = {
  throttled: "Limit: a fluid input has no slot, so it never counts as full. An output-throttled refinery still reads underfed.",
};

const is = (m: Machine, state: string): true | string => {
  const got = classify(m).state;
  return got === state || `classified ${got}, expected ${state}`;
};

export const machineStatesStoryboard: Storyboard<Machine> = {
  figure: "machine-states",
  page: "/projects/satisfactory-dash",
  seed: SEED,
  inputs,
  replay: (at, ins) => {
    const m = runningMachine();
    for (const i of [...ins].sort((a, b) => a.at - b.at)) if (i.at <= at) i.apply(m);
    return m;
  },
  beats: [
    {
      id: "producing",
      teaches: "A powered, configured machine whose output runs at 95% or more of its set rate is producing (C:71, C:79).",
      caption: CAPTION.producing,
      at: 3,
      holds: (m) => is(m, "producing"),
    },
    {
      id: "underfed",
      teaches: "Short of input, the output falls under 95% of the set rate: underfed (C:71-77).",
      caption: CAPTION.underfed,
      at: 9,
      enter: { dur: "base", ease: "ease-out", reduced: "instant", moves: "the input buffer drains; the output gauge falls under the 95% mark" },
      holds: (m) => (!m.outputFull && m.inputFill < 100 && m.outputPercent < 95 && classify(m).state === "underfed") || is(m, "underfed"),
    },
    {
      id: "backed-up",
      teaches: "A full output slot makes the machine backed up (C:64-66).",
      caption: CAPTION.backedUp,
      at: 15,
      enter: { dur: "base", ease: "ease-out", reduced: "instant", moves: "the output slot fills; the machine turns to backed up" },
      holds: (m) => (m.outputFull && classify(m).state === "backedUp") || is(m, "backedUp"),
    },
    {
      id: "throttled",
      teaches: "Newest rule (issue 201): every input full but the output under 95% is backed up, not underfed (C:71-75, W:45-50).",
      caption: CAPTION.throttled,
      at: 21,
      enter: { dur: "base", ease: "ease-in-out", reduced: "instant", moves: "the output slot opens a little; the gauge stays low while the inputs stay full" },
      holds: (m) => (!m.outputFull && m.inputFill >= 100 && m.outputPercent < 95 && classify(m).state === "backedUp") || is(m, "backedUp"),
    },
    {
      id: "unpowered",
      teaches: "No circuit, or a tripped fuse, makes it unpowered; this outranks the flow rules (C:53-56).",
      caption: CAPTION.unpowered,
      at: 27,
      enter: { dur: "base", ease: "ease-out", reduced: "instant", moves: "the power switch flips off; the housing goes dark" },
      holds: (m) => (!m.powered && classify(m).state === "unpowered") || is(m, "unpowered"),
    },
    {
      id: "paused",
      teaches: "Paused is checked before everything else (C:50-52).",
      caption: CAPTION.paused,
      at: 33,
      enter: { dur: "base", ease: "ease-out", reduced: "instant", moves: "power returns, then the pause mark lands on the housing" },
      holds: (m) => (m.paused && classify(m).state === "paused") || is(m, "paused"),
    },
    {
      id: "idle",
      teaches: "A machine with no recipe is idle, after paused and unpowered (C:57-59).",
      caption: CAPTION.idle,
      at: 39,
      enter: { dur: "base", ease: "ease-out", reduced: "instant", moves: "the pause lifts; the recipe window goes blank" },
      holds: (m) => (!m.recipe && classify(m).state === "idle") || is(m, "idle"),
    },
  ],
};
