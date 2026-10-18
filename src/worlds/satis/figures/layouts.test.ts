import { describe, it, expect } from "vitest";
import { CUTOVER, OUTAGE, routePath } from "./layouts";

describe("figure layouts", () => {
  it("outage: the queue sits clear of the PC disc and the tunnel disc (r 34)", () => {
    for (const l of [OUTAGE.desktop]) {
      expect(l.pill.x - (l.pc.x + 34)).toBeGreaterThanOrEqual(20);
      expect(l.tunnel.x - 34 - (l.pill.x + l.pill.w)).toBeGreaterThanOrEqual(20);
    }
  });
  it("cutover: every station sits inside its panel with 15 units to spare for its sub-label", () => {
    for (const l of [CUTOVER.desktop, CUTOVER.phone]) {
      const inside = (p: { x: number; y: number }, z: keyof typeof l.panels, half = 66) =>
        p.x - half >= l.panels[z].x + 15 - 1e-9 && p.x + half <= l.panels[z].x + l.panels[z].w - 15 + 1e-9;
      expect(inside(l.pcDb, "pc")).toBe(true);
      expect(inside(l.pcBackend, "pc", 40)).toBe(true);
      expect(inside(l.b2, "off", 62)).toBe(true); // "final dump + row counts" measures ~61 units half-width (prototype v5)
      expect(inside(l.awsBackend, "aws", 56)).toBe(true);
      expect(inside(l.rds, "aws", 50)).toBe(true);
    }
  });
  it("cutover: both routes start at the tunnel's exit and end at their backend", () => {
    const l = CUTOVER.desktop;
    expect(routePath(l, "pc")).toBe("M378 236 V180 Q378 176 374 176 H259 Q255 176 255 172 V86 Q255 82 251 82 H239");
    expect(routePath(l, "pc").startsWith(`M${l.routeExit.x} ${l.routeExit.y}`)).toBe(true);
    expect(routePath(l, "aws")).toMatch(new RegExp(`H${l.awsBackend.x - 24}$`));
    expect(routePath(l, "pc")).toMatch(new RegExp(`H${l.pcBackend.x + 24}$`));
  });
});
