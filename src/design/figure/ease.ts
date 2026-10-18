export const ease = {
  inOutCubic: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  inOutSine: (p: number) => (1 - Math.cos(Math.PI * p)) / 2,
  outQuad: (p: number) => 1 - (1 - p) * (1 - p),
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Squash and stretch: stretch along the motion with speed (≤ 1.25), and a damped wobble after a landing. */
export function squash(speedPxPerS: number, sinceLanding: number): { sx: number; sy: number } {
  const stretch = Math.min(0.25, Math.abs(speedPxPerS) / 1800);
  const w = sinceLanding >= 0 && sinceLanding < 0.5 ? 0.22 * Math.exp(-sinceLanding * 9) * Math.cos(sinceLanding * 28) : 0;
  if (stretch === 0 && w === 0) return { sx: 1, sy: 1 };
  return { sx: (1 + stretch) * (1 - w), sy: (1 / (1 + stretch)) * (1 + w) };
}
