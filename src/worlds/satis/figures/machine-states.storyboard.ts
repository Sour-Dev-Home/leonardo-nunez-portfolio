// Figure 3's storyboard (machine states): one machine, the reader changes its input fill, output and
// power, and the figure says which state the dashboard gives it. The model is machineState.ts, a port of
// classifyBuilding; every rule below cites the dash's code, in Sour-Dev-Home/satisfactory-dash:
//   C = backend/src/modules/telemetry/services/classifyBuilding.ts
//   W = docs-vault/wiki/machine-states.md
// The beats follow the dash's own order of checks (C:39-48): paused, unpowered, idle, backed up,
// underfed, producing. The question: why does the dashboard call this machine what it calls it?
// The captions are the view's (machine-states-view.ts); this file imports them.
import { CAPTION } from "./machine-states-view";
import { classify, runningMachine, type Machine } from "../model/machineState";
import type { Input, Storyboard } from "../../../design/figure/storyboard";

const SEED = 0; // the model is not random; unused

/** The reader's actions on the figure's real controls (MachineStatesFigure.astro). Times are sim seconds.
 *  Sliders are dragged (`value`); the toggles are clicked, so their apply flips the field. */
const ctl = (k: string) => (k === "input" || k === "output" ? `input[data-ctl="${k}"]` : `button[data-ctl="${k}"]`);
const flip = (field: "outputFull" | "powered" | "paused" | "recipe") => (m: Machine) => void (m[field] = !m[field]);
const inputs: Input<Machine>[] = [
  { at: 7, click: ctl("input"), value: 40, apply: (m) => void (m.inputFill = 40) },
  { at: 7, click: ctl("output"), value: 40, apply: (m) => void (m.outputPercent = 40) },
  { at: 13, click: ctl("input"), value: 100, apply: (m) => void (m.inputFill = 100) },
  { at: 13, click: ctl("output"), value: 0, apply: (m) => void (m.outputPercent = 0) },
  { at: 13, click: ctl("slot"), apply: flip("outputFull") },
  { at: 19, click: ctl("slot"), apply: flip("outputFull") },
  { at: 19, click: ctl("output"), value: 10, apply: (m) => void (m.outputPercent = 10) },
  { at: 25, click: ctl("power"), apply: flip("powered") },
  { at: 29, click: ctl("power"), apply: flip("powered") },
  { at: 31, click: ctl("paused"), apply: flip("paused") },
  { at: 35, click: ctl("paused"), apply: flip("paused") },
  { at: 37, click: ctl("recipe"), apply: flip("recipe") },
];


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
      enter: { dur: "base", ease: "ease-in-out", reduced: "instant", moves: "the input buffer drains; the output gauge falls under the 95% mark" },
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
