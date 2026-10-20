// Figure 3's model: how the dashboard classifies ONE machine. A pure port of classifyBuilding in
// Sour-Dev-Home/satisfactory-dash; nothing here is time-based, and nothing is invented. Sources (the
// dash's repo, at origin/main when this was written):
//  - backend/src/modules/telemetry/services/classifyBuilding.ts
//      :18      UNDERFED_BELOW_PERCENT = 95 (percent of the machine's SET clock, so a fully fed
//               underclocked or overclocked machine reads about 100).
//      :39-48   the order: paused, unpowered, idle (no recipe), backedUp, underfed, producing.
//      :50-52   paused wins over everything.
//      :53-56   unpowered: not on a circuit (circuitGroupId < 0) or the fuse tripped.
//      :57-59   idle: no recipe.
//      :64-66   backedUp: the overflow signal (an output slot is at capacity), passed in.
//      :71-78   issue 201: best output percent below 95 with EVERY input full is backedUp, not
//               underfed; otherwise underfed, naming the ingredient with the lowest ConsPercent.
//      :79      producing.
//  - docs-vault/wiki/machine-states.md  :9-22 (the rules, in order), :45-55 (issue 201, and the
//    limitation: a fluid ingredient has no inventory slot, so a machine with a fluid input, such as a
//    refinery, is never "inputs full" and an output-throttled refinery still reads underfed).
//  - backend/src/modules/telemetry/services/classifyBuilding.test.ts  the cases the unit test mirrors.
// Left out on purpose: the "no state, never a guess" outcomes for missing data (an unknown fuse, a
// non-finite percent). A figure only shows machines whose data is all there.
// The figure's input fill is the machine's input buffers; "inputs full" is every ingredient at capacity
// (the dash's `inputsFull`, from FRM's InputInventory).

/** classifyBuilding.ts:18. */
export const UNDERFED_BELOW_PERCENT = 95;

export type MachineState = "paused" | "unpowered" | "idle" | "backedUp" | "underfed" | "producing";

/** The order the dash checks (classifyBuilding.ts:39-48): the first rule that matches decides. */
export const PRECEDENCE: readonly MachineState[] = ["paused", "unpowered", "idle", "backedUp", "underfed", "producing"];

export interface Machine {
  /** IsPaused. */
  paused: boolean;
  /** On a circuit with its fuse intact: the negation of (circuitGroupId < 0 || fuseTriggered). */
  powered: boolean;
  /** A recipe is set (recipe !== null). */
  recipe: boolean;
  /** How full the input buffers are, 0 to 100. Every ingredient at capacity is 100. */
  inputFill: number;
  /** A fluid ingredient has no inventory slot, so it can never count as full (machine-states.md:54-55). */
  fluidInput: boolean;
  /** Best averaged output percent of the set rate (bestOutputPercent), 0 to 100 and a bit over. */
  outputPercent: number;
  /** An output slot is at capacity (the `backedUp` flag classifyBuilding is given). */
  outputFull: boolean;
}

export interface Classification {
  state: MachineState;
  /** Which of the PRECEDENCE rules decided; the earlier ones did not match. */
  rule: number;
  /** For underfed: the input is what is short (the dash names the ingredient with the lowest ConsPercent). */
  missingInput?: true;
}

/** FRM's `inputsFull`: every input buffer at capacity, and a fluid input never is. */
export function inputsFull(m: Machine): boolean {
  return !m.fluidInput && m.inputFill >= 100;
}

export function classify(m: Machine): Classification {
  const at = (state: MachineState): Classification => ({ state, rule: PRECEDENCE.indexOf(state) });
  if (m.paused) return at("paused");
  if (!m.powered) return at("unpowered");
  if (!m.recipe) return at("idle");
  if (m.outputFull) return at("backedUp");
  if (m.outputPercent < UNDERFED_BELOW_PERCENT) {
    // Issue 201: a low percent with every input buffer full is throttled by its output, not short of input.
    if (inputsFull(m)) return at("backedUp");
    return { ...at("underfed"), missingInput: true };
  }
  return at("producing");
}

/** A powered, configured machine at full rate: each beat and test overrides what it varies. */
export function runningMachine(overrides: Partial<Machine> = {}): Machine {
  return { paused: false, powered: true, recipe: true, inputFill: 100, fluidInput: false, outputPercent: 100, outputFull: false, ...overrides };
}
