import { describe, expect, it } from "vitest";
import { framesOf } from "../../../design/figure/storyboard";
import { classify } from "../model/machineState";
import { machineStatesStoryboard as board } from "./machine-states.storyboard";

describe("machine-states storyboard", () => {
  for (const beat of board.beats) {
    it(`the model reaches "${beat.id}" at ${beat.at} s`, () => {
      expect(beat.holds(board.replay(beat.at, board.inputs))).toBe(true);
    });
  }

  it("shows the six states, the newest rule among them", () => {
    const states = board.beats.map((b) => classify(board.replay(b.at, board.inputs)).state);
    expect(states).toEqual(["producing", "underfed", "backedUp", "backedUp", "unpowered", "paused", "idle"]);
  });

  it("lists its stills in time order", () => {
    expect(framesOf(board).map((f) => f.name)).toEqual([
      "01-producing",
      "02-underfed",
      "03-backed-up",
      "04-throttled",
      "05-unpowered",
      "06-paused",
      "07-idle",
    ]);
  });
});
