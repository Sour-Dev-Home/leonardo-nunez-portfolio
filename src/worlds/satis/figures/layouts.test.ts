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
  it("cutover: both routes start behind the tunnel's disc and end at their backend", () => {
    for (const l of [CUTOVER.desktop, CUTOVER.phone]) {
      for (const to of ["pc", "aws"] as const) {
        const [, x, y] = routePath(l, to).match(/^M(\d+) (\d+)/)!.map(Number);
        expect(Math.hypot(x - l.tunnel.x, y - l.tunnel.y), to).toBeLessThan(34); // orbs never jump in the open
      }
    }
    // Desktop enters each backend from the side facing the tunnel (phones use the right-hand margin).
    const l = CUTOVER.desktop;
    expect(routePath(l, "aws")).toMatch(new RegExp(`H${l.awsBackend.x - 24}$`));
    expect(routePath(l, "pc")).toMatch(new RegExp(`H${l.pcBackend.x + 24}$`));
  });
  // CI's Linux fonts set "CLOUDFLARE" a few units wider than Windows does: allow 100 units for it.
  it("cutover (desktop): no route climbs through the right-aligned CLOUDFLARE label", () => {
    const l = CUTOVER.desktop;
    const label = l.panels.cf.label;
    const left = label.x - 100;
    for (const to of ["pc", "aws"] as const) {
      let x = 0;
      let y = 0;
      for (const [, cmd, args] of routePath(l, to).matchAll(/([MHVQ])([^MHVQ]*)/g)) {
        const n = args.trim().split(/\s+/).map(Number);
        if (cmd === "V" && Math.min(y, n[0]) < label.y + 4 && Math.max(y, n[0]) > label.y - 12) {
          expect(x, `${to} climbs at x=${x}`).toBeLessThanOrEqual(left - 8);
        }
        if (cmd === "M") [x, y] = n;
        if (cmd === "H") x = n[0];
        if (cmd === "V") y = n[0];
        if (cmd === "Q") [x, y] = n.slice(2);
      }
    }
  });
});
