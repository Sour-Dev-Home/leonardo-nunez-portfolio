import { describe, it, expect } from "vitest";
import { nearestAlong, STEP } from "./nearest";
import { LANES } from "./layouts";
import { STATIONS } from "../model/path";
import type { Pt } from "./layouts";

// A stand-in for SVGPathElement.getPointAtLength: the layouts' tracks as polylines (the desktop's rounded corners
// cut square, which is close enough to exercise the search).
function polyline(pts: Pt[]) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = seg.reduce((a, b) => a + b, 0);
  const at = (d: number): Pt => {
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const k = Math.min(1, d / seg[i]);
        return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
      }
      d -= seg[i];
    }
    return pts[pts.length - 1];
  };
  return { total, at };
}

// What lane-view.ts used to do: sample every STEP units and keep the first nearest.
function brute(at: (d: number) => Pt, total: number, x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let d = 0; d <= total; d += STEP) {
    const p = at(d);
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist < bestD) [best, bestD] = [d, dist];
  }
  return best;
}

const TRACKS = {
  desktop: [
    { x: 80, y: 70 },
    { x: 740, y: 70 },
    { x: 740, y: 215 },
    { x: 80, y: 215 },
  ],
  phone: [
    { x: 60, y: 50 },
    { x: 60, y: 652 },
  ],
};

describe("nearestAlong", () => {
  for (const name of ["desktop", "phone"] as const) {
    it(`${name}: finds the same point as sampling the whole track, with far fewer samples`, () => {
      const { total, at } = polyline(TRACKS[name]);
      let calls = 0;
      const counted = (d: number) => {
        calls += 1;
        return at(d);
      };
      for (const id of STATIONS) {
        const { x, y } = LANES[name].at[id];
        expect(nearestAlong(counted, total, x, y), id).toBe(brute(at, total, x, y));
      }
      expect(calls).toBeLessThan((total / STEP) * STATIONS.length * 0.2);
    });
  }
  it("matches off the track and at its ends too", () => {
    const { total, at } = polyline(TRACKS.desktop);
    for (const [x, y] of [
      [0, 0],
      [80, 70],
      [80, 215],
      [760, 140],
      [400, 140],
      [333, 71],
    ])
      expect(nearestAlong(at, total, x, y), `${x},${y}`).toBe(brute(at, total, x, y));
  });
});
