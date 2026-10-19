// How far along a track a point sits: the sample nearest to it, every STEP units. Samples coarsely first, then every
// STEP units only around the best coarse sample, so a track ~1,400 units long takes ~90 samples instead of ~700.
// Same answer as sampling the whole track every STEP units, for points on or near a track that doesn't double back
// within COARSE units of them (the lanes tracks don't).
export const STEP = 2;
const COARSE = 10 * STEP;

interface Pt {
  x: number;
  y: number;
}

export function nearestAlong(pointAt: (d: number) => Pt, total: number, x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  const scan = (from: number, to: number, step: number) => {
    for (let d = from; d <= to; d += step) {
      const p = pointAt(d);
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < bestD) [best, bestD] = [d, dist];
    }
  };
  scan(0, total, COARSE);
  const around = best;
  [best, bestD] = [0, Infinity];
  scan(Math.max(0, around - COARSE), Math.min(total, around + COARSE), STEP);
  return best;
}
