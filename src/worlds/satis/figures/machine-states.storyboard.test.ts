import { describe, expect, it } from "vitest";
import { framesOf } from "../../../design/figure/storyboard";
import { classify } from "../model/machineState";
import { captionFor } from "./machine-states-view";
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

  it("shows, at every beat, the caption the view gives that state", () => {
    for (const b of board.beats) expect(b.caption).toBe(captionFor(classify(board.replay(b.at, board.inputs))));
  });

  it("has a motion spec into every beat after the first: CSS tokens, and an instant cut under reduced motion", () => {
    expect(board.beats[0].enter).toBeUndefined();
    for (const b of board.beats.slice(1)) {
      expect(b.enter?.dur).toMatch(/^(fast|base|slow)$/);
      expect(b.enter?.ease).toMatch(/^ease-(out|in-out)$/);
      expect(b.enter?.reduced).toBe("instant");
    }
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
