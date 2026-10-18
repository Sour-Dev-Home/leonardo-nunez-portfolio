export interface Pt {
  x: number;
  y: number;
}
export interface OutageLayout {
  w: number;
  h: number;
  pc: Pt;
  pill: { x: number; y: number; w: number; h: number };
  headX: number;
  gap: number;
  out: number;
  tunnel: Pt;
  backend: Pt;
  db: Pt;
  axis: "x" | "y";
}
export interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  label: Pt;
  anchor: "start" | "end";
}
export interface CutoverLayout {
  w: number;
  h: number;
  shift: number;
  panels: Record<"pc" | "off" | "cf" | "aws", Panel>;
  pcDb: Pt;
  pcBackend: Pt;
  b2: Pt;
  awsBackend: Pt;
  rds: Pt;
  agent: Pt;
  tunnel: Pt;
  routeExit: Pt;
  gutter: number;
  dump: string;
  restore: string;
  /** The agent's link to the tunnel. */
  agentWire: string;
  /** Hand-drawn routes where the computed one would cross a station (phones). */
  routes?: { pc: string; aws: string };
}

// Outage: left to right on desktop (prototype v6); top to bottom on phones, the queue a vertical pill.
// On phones `headX` and `gap` run along y (the flow axis).
export const OUTAGE: { desktop: OutageLayout; phone: OutageLayout } = {
  desktop: {
    w: 720, h: 160, axis: "x",
    pc: { x: 60, y: 70 }, pill: { x: 140, y: 54, w: 208, h: 32 }, headX: 330, gap: 16, out: 348,
    tunnel: { x: 420, y: 70 }, backend: { x: 540, y: 70 }, db: { x: 660, y: 70 },
  },
  phone: {
    w: 320, h: 640, axis: "y",
    pc: { x: 160, y: 50 }, pill: { x: 144, y: 110, w: 32, h: 208 }, headX: 300, gap: 16, out: 318,
    tunnel: { x: 160, y: 380 }, backend: { x: 160, y: 480 }, db: { x: 160, y: 580 },
  },
};

// Cutover: panels side by side on desktop (prototype v5, drawn 16 units down for the panel labels);
// stacked on phones: Gaming PC, Cloudflare, Off-site backups, AWS.
export const CUTOVER: { desktop: CutoverLayout; phone: CutoverLayout } = {
  desktop: {
    w: 764, h: 360, shift: 16,
    panels: {
      pc: { x: 12, y: 30, w: 280, h: 320, label: { x: 24, y: 47 }, anchor: "start" },
      off: { x: 318, y: 30, w: 156, h: 154, label: { x: 330, y: 47 }, anchor: "start" },
      cf: { x: 318, y: 208, w: 156, h: 142, label: { x: 462, y: 225 }, anchor: "end" },
      aws: { x: 500, y: 30, w: 252, h: 154, label: { x: 512, y: 47 }, anchor: "start" },
    },
    pcDb: { x: 95, y: 82 }, pcBackend: { x: 215, y: 82 }, b2: { x: 396, y: 82 }, awsBackend: { x: 575, y: 82 }, rds: { x: 685, y: 82 },
    agent: { x: 95, y: 254 }, tunnel: { x: 396, y: 254 }, routeExit: { x: 378, y: 236 }, gutter: 176,
    dump: "M95 52 V44 Q95 40 99 40 H392 Q396 40 396 44 V52",
    restore: "M396 52 V44 Q396 40 400 40 H681 Q685 40 685 44 V52",
    agentWire: "M95 254 H396",
  },
  // Phones: panels stacked, drawn without a shift. The backends sit on the right of each area so both
  // routes can come up or down the right-hand margin and enter from the side, never crossing a station.
  phone: {
    w: 340, h: 780, shift: 0,
    panels: {
      pc: { x: 8, y: 30, w: 324, h: 262, label: { x: 20, y: 47 }, anchor: "start" },
      cf: { x: 8, y: 308, w: 324, h: 140, label: { x: 320, y: 325 }, anchor: "end" },
      off: { x: 8, y: 464, w: 324, h: 140, label: { x: 20, y: 481 }, anchor: "start" },
      aws: { x: 8, y: 620, w: 324, h: 150, label: { x: 20, y: 637 }, anchor: "start" },
    },
    pcDb: { x: 95, y: 100 }, pcBackend: { x: 245, y: 100 }, agent: { x: 95, y: 215 }, tunnel: { x: 170, y: 370 },
    b2: { x: 170, y: 525 }, rds: { x: 95, y: 680 }, awsBackend: { x: 245, y: 680 },
    routeExit: { x: 152, y: 352 }, gutter: 300,
    dump: "M61 100 H18 Q14 100 14 104 V521 Q14 525 18 525 H136",
    restore: "M136 525 H18 Q14 525 14 529 V676 Q14 680 18 680 H61",
    agentWire: "M95 215 H166 Q170 215 170 219 V370",
    routes: {
      pc: "M152 352 V304 Q152 300 156 300 H281 Q285 300 285 296 V104 Q285 100 281 100 H269",
      aws: "M188 352 H318 Q322 352 322 356 V676 Q322 680 318 680 H269",
    },
  },
};

/** The route from the tunnel to a backend: up to the gutter, across, up beside the backend, in from the
 *  side facing the tunnel. Always clear of labels (e2e collision test). */
export function routePath(l: CutoverLayout, to: "pc" | "aws"): string {
  if (l.routes) return l.routes[to];
  const b = to === "pc" ? l.pcBackend : l.awsBackend;
  const side = b.x < l.tunnel.x ? 1 : -1; // enter from the side facing the tunnel
  const bx = b.x + side * 40;
  const end = b.x + side * 24;
  const { x: rx, y: ry } = l.routeExit;
  const g = l.gutter;
  const up1 = Math.sign(g - ry) || -1; // tunnel exit → gutter
  const h = Math.sign(bx - rx) || 1; // along the gutter
  const up2 = Math.sign(b.y - g) || -1; // gutter → backend
  return `M${rx} ${ry} V${g - up1 * 4} Q${rx} ${g} ${rx + h * 4} ${g} H${bx - h * 4} Q${bx} ${g} ${bx} ${g + up2 * 4} V${b.y - up2 * 4} Q${bx} ${b.y} ${bx - side * 4} ${b.y} H${end}`;
}
