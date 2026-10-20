import { describe, expect, it } from "vitest";
import { classify, inputsFull, runningMachine, UNDERFED_BELOW_PERCENT, type Machine, type MachineState } from "./machineState";

// Mirrors the cases in the dash's classifyBuilding.test.ts (backend/src/modules/telemetry/services).
describe("classify (the dash's classifyBuilding)", () => {
  it.each<[string, Partial<Machine>, MachineState]>([
    ["paused", { paused: true }, "paused"],
    ["paused wins over unpowered", { paused: true, powered: false }, "paused"],
    ["paused wins over backed up", { paused: true, outputFull: true }, "paused"],
    ["unpowered: not connected, or the fuse tripped", { powered: false }, "unpowered"],
    ["unpowered wins over backed up", { powered: false, outputFull: true }, "unpowered"],
    ["unpowered wins over no recipe", { powered: false, recipe: false }, "unpowered"],
    ["idle: no recipe", { recipe: false, inputFill: 0, outputPercent: 0 }, "idle"],
    ["backed up", { outputPercent: 0, outputFull: true }, "backedUp"],
    ["backed up with a low percent stays backed up", { outputPercent: 40, outputFull: true }, "backedUp"],
    ["underfed: nothing coming out", { inputFill: 0, outputPercent: 0 }, "underfed"],
    ["underfed: slow because inputs are short (24.7 percent)", { inputFill: 40, outputPercent: 24.7 }, "underfed"],
    ["producing: full rate", {}, "producing"],
  ])("%s", (_name, overrides, expected) => {
    expect(classify(runningMachine(overrides)).state).toBe(expected);
  });

  it("is the owner's 95 percent of the set clock", () => {
    expect(UNDERFED_BELOW_PERCENT).toBe(95);
  });

  it("splits exactly at the threshold: below is underfed, at it is producing", () => {
    const at = (outputPercent: number) => classify(runningMachine({ inputFill: 50, outputPercent })).state;
    expect(at(94.9)).toBe("underfed");
    expect(at(UNDERFED_BELOW_PERCENT - 0.001)).toBe("underfed");
    expect(at(UNDERFED_BELOW_PERCENT)).toBe("producing");
    expect(at(UNDERFED_BELOW_PERCENT + 0.001)).toBe("producing");
  });

  it("flags the missing input only when underfed", () => {
    expect(classify(runningMachine({ inputFill: 50, outputPercent: 9.4 })).missingInput).toBe(true);
    expect(classify(runningMachine()).missingInput).toBeUndefined();
  });

  describe("output-throttled machines (issue 201): full inputs with a low percent are backedUp, not underfed", () => {
    const at = (outputPercent: number, inputFull: boolean) => classify(runningMachine({ inputFill: inputFull ? 100 : 40, outputPercent })).state;

    it("the 9.4 percent assembler with full input buffers reads backedUp", () => {
      expect(at(9.4, true)).toBe("backedUp");
      expect(at(0, true)).toBe("backedUp");
    });
    it("splits at the underfed threshold: just below is backedUp, at it is producing", () => {
      expect(at(UNDERFED_BELOW_PERCENT - 0.001, true)).toBe("backedUp");
      expect(at(UNDERFED_BELOW_PERCENT, true)).toBe("producing");
      expect(at(100, true)).toBe("producing");
    });
    it("partial input stays underfed", () => {
      expect(at(9.4, false)).toBe("underfed");
    });
    it("does not outrank paused, unpowered or idle", () => {
      expect(classify(runningMachine({ outputPercent: 9.4, paused: true })).state).toBe("paused");
      expect(classify(runningMachine({ outputPercent: 9.4, powered: false })).state).toBe("unpowered");
      expect(classify(runningMachine({ outputPercent: 9.4, recipe: false })).state).toBe("idle");
    });
  });

  it("limitation: a fluid input has no slot, so it is never full and an output-throttled refinery reads underfed", () => {
    const refinery = runningMachine({ fluidInput: true, outputPercent: 9.4 });
    expect(inputsFull(refinery)).toBe(false);
    expect(classify(refinery).state).toBe("underfed");
  });

  it("reports which rule decided, in the dash's order", () => {
    expect(classify(runningMachine({ paused: true })).rule).toBe(0);
    expect(classify(runningMachine()).rule).toBe(5);
  });
});
