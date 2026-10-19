import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CASES, failureText, WIDTHS } from "./cases";

describe("the figure's cases", () => {
  it("are the four from the spec, in order", () => {
    expect(CASES.map((c) => c.id)).toEqual(["fonts", "hero", "media", "line"]);
    expect(WIDTHS).toEqual([360, 390, 768, 1280]);
  });

  // #35's body: the case study's video and diagrams "had no size … grew from 0 px and pushed the text down",
  // fixed along with the loading tests. That bug shipped, so it is a miss, not guarded.
  it("call only #40 a catch, and #38 and #35 misses", () => {
    expect(CASES.filter((c) => c.verdict === "caught").map((c) => c.pr)).toEqual([40]);
    expect(CASES.filter((c) => c.verdict === "missed").map((c) => c.pr)).toEqual([38, 35]);
  });

  it("fail at the widths the spec names", () => {
    expect(Object.fromEntries(CASES.map((c) => [c.id, c.failsAt]))).toEqual({
      fonts: [768],
      hero: [768, 1280],
      media: [360, 390, 768, 1280],
      line: [360],
    });
  });

  it("quote each guarding e2e test by its exact title", () => {
    for (const c of CASES) expect(readFileSync(c.test.file, "utf-8"), c.id).toContain(c.test.title);
  });

  it("word a failure with its widths and the test's title", () => {
    const hero = CASES[1];
    expect(failureText(hero, [768, 1280], "the title doesn't start at the content's left edge")).toBe(
      "Fails at 768 and 1280 px. CI's test “the page title starts at the left edge of the content”: the title doesn't start at the content's left edge.",
    );
    expect(failureText(hero, [360, 390, 768], "x")).toBe(
      "Fails at 360, 390 and 768 px. CI's test “the page title starts at the left edge of the content”: x.",
    );
  });
});
