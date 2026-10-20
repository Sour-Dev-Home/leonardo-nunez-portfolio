import { describe, expect, it } from "vitest";
import { framesOf } from "../../../design/figure/storyboard";
import { outageStoryboard as board } from "./outage.storyboard";

describe("outage storyboard", () => {
  for (const beat of board.beats) {
    it(`the model reaches "${beat.id}" at ${beat.at} s`, () => {
      expect(beat.holds(board.replay(beat.at, board.inputs))).toBe(true);
    });
  }

  it("lists its stills in time order, mid-transitions first", () => {
    expect(framesOf(board).map((f) => f.name)).toEqual(["01-flowing", "02-waiting-mid1", "03-waiting", "04-full", "05-drained-mid1", "06-drained"]);
  });
});
