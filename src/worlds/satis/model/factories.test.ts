import { describe, expect, it } from "vitest";
import { GROUPS, PROXIMITY_RADIUS, linksFor, ownersFor, proximitySites, sharesOf } from "./factories";

describe("the logical-factory example", () => {
  it("is one site under the proximity rule, though it makes two products", () => {
    const sites = proximitySites(GROUPS, PROXIMITY_RADIUS);
    expect(sites).toHaveLength(1);
    expect(sites[0]).toHaveLength(GROUPS.length);
  });

  it("gives a far ore farm to the product it feeds, not the one beside it", () => {
    expect(ownersFor(60).farm).toBe("A");
    expect(ownersFor(60).smelA).toBe("A");
    expect(ownersFor(60).partsB).toBe("B");
  });

  it("splits shares by the links' maximum rates", () => {
    const s = sharesOf(GROUPS, linksFor(60));
    expect(s.smelS!.A).toBeCloseTo(0.6);
    expect(s.smelS!.B).toBeCloseTo(0.4);
    expect(s.mineS!.A).toBeCloseTo(0.6);
  });

  it("marks a group shared under 95% to one product, and gives it up at 95%", () => {
    expect(ownersFor(60).smelS).toBe("shared");
    expect(ownersFor(94).smelS).toBe("shared");
    expect(ownersFor(95).smelS).toBe("A");
    expect(ownersFor(95).mineS).toBe("A");
    expect(ownersFor(5).smelS).toBe("B");
  });
});
