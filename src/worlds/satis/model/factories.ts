// Figure 4's rules, from Sour-Dev-Home/satisfactory-dash: docs-vault/wiki/decisions/0055-planner-logical-factories.md.
//  - A machine group is assigned by its share of output to each final product, computed from the machines'
//    maximum rates (no live belt-rate polling). A group under 95% to one product is marked shared.
//  - A "site" in the old view was every machine within 150 m of another, joined into one (single-link).
// The graph here is a made-up seven-group example, not a real save. Coordinates are drawing units, with
// PROXIMITY_RADIUS standing in for the 150 m rule.
export type Product = "A" | "B";
export type Owner = Product | "shared";
export const SHARE_THRESHOLD = 0.95;
export const PROXIMITY_RADIUS = 95;

/** The game's building icon a group is drawn with: `public/images/satis/<icon>.webp` (see the NOTICE there). */
export type Icon = "assembler" | "manufacturer" | "smelter" | "miner-mk1" | "miner-mk2" | "constructor";

export interface Group {
  id: string;
  label: string;
  icon: Icon;
  /** Where it stands in the world. */
  at: { x: number; y: number };
  /** Set on the two final-product groups. */
  final?: Product;
}
export interface Link {
  from: string;
  to: string;
  /** Maximum rate the link can carry (items/min); a group splits its output across its links by this. */
  rate: number;
}

export const GROUPS: readonly Group[] = [
  // Placed so every link runs clear of every name (the layout test checks it), and each group stays within
  // PROXIMITY_RADIUS of another: one site under the old rule.
  { id: "finalA", label: "Product A", icon: "assembler", at: { x: 55, y: 60 }, final: "A" },
  { id: "smelA", label: "Smelters", icon: "smelter", at: { x: 150, y: 60 } },
  { id: "farm", label: "Ore farm", icon: "miner-mk2", at: { x: 420, y: 140 } },
  // Level with the shared smelters it feeds, so its link runs sideways, not up through their name.
  { id: "mineS", label: "Local miners", icon: "miner-mk1", at: { x: 85, y: 140 } },
  { id: "smelS", label: "Shared smelters", icon: "smelter", at: { x: 200, y: 140 } },
  { id: "partsB", label: "Parts B", icon: "constructor", at: { x: 285, y: 140 } },
  { id: "finalB", label: "Product B", icon: "manufacturer", at: { x: 355, y: 190 }, final: "B" },
];

/** The drawing's size and the factory cards (drawing units), shared by the figure and its overlap test. */
export const VIEW = { w: 520, h: 270 };
export const CARDS: Record<Owner, { x: number; y: number; w: number; h: number; label: string }> = {
  A: { x: 10, y: 34, w: 240, h: 140, label: "Product A factory" },
  B: { x: 285, y: 34, w: 225, h: 140, label: "Product B factory" },
  shared: { x: 150, y: 190, w: 230, h: 70, label: "Shared" },
};
/** A group's icon chip is 2 × NODE_R square; its name sits under it, at LABEL_DY below the centre, LABEL_PX tall. */
export const NODE_R = 17;
export const LABEL_PX = 11;
export const LABEL_DY = NODE_R + 12;
/** A conservative width per character at LABEL_PX (the text face averages nearer 0.55 em). */
export const LABEL_CHAR_W = LABEL_PX * 0.6;

/** The links, with the shared smelters' output split `toA` : 100 - `toA` between the two products. */
export function linksFor(toA: number): Link[] {
  return [
    { from: "farm", to: "smelA", rate: 100 },
    { from: "smelA", to: "finalA", rate: 100 },
    { from: "mineS", to: "smelS", rate: 100 },
    { from: "smelS", to: "finalA", rate: toA },
    { from: "smelS", to: "partsB", rate: 100 - toA },
    { from: "partsB", to: "finalB", rate: 100 },
  ];
}

/** Each group's share of its output that ends up in each final product. A final product is all its own. */
export function sharesOf(groups: readonly Group[], links: readonly Link[]): Record<string, Record<Product, number>> {
  const out = new Map<string, Link[]>();
  for (const l of links) out.set(l.from, [...(out.get(l.from) ?? []), l]);
  const memo = new Map<string, Record<Product, number>>();
  const byId = new Map(groups.map((g) => [g.id, g]));
  const visit = (id: string): Record<Product, number> => {
    const known = memo.get(id);
    if (known) return known;
    const g = byId.get(id)!;
    const s: Record<Product, number> = { A: 0, B: 0 };
    if (g.final) s[g.final] = 1;
    else {
      const ls = out.get(id) ?? [];
      const total = ls.reduce((n, l) => n + l.rate, 0);
      for (const l of ls) {
        if (total === 0) break;
        const child = visit(l.to);
        s.A += (l.rate / total) * child.A;
        s.B += (l.rate / total) * child.B;
      }
    }
    memo.set(id, s);
    return s;
  };
  return Object.fromEntries(groups.map((g) => [g.id, visit(g.id)]));
}

export function ownerOf(share: Record<Product, number>): Owner {
  if (share.A >= SHARE_THRESHOLD) return "A";
  if (share.B >= SHARE_THRESHOLD) return "B";
  return "shared";
}

export function ownersFor(toA: number): Record<string, Owner> {
  const s = sharesOf(GROUPS, linksFor(toA));
  return Object.fromEntries(GROUPS.map((g) => [g.id, ownerOf(s[g.id]!)]));
}

/** The old proximity rule: groups within `radius` of each other (directly or through a chain) are one site. */
export function proximitySites(groups: readonly Group[], radius: number): string[][] {
  const parent = groups.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) {
      const d = Math.hypot(groups[i]!.at.x - groups[j]!.at.x, groups[i]!.at.y - groups[j]!.at.y);
      if (d <= radius) parent[find(i)] = find(j);
    }
  const sites = new Map<number, string[]>();
  groups.forEach((g, i) => sites.set(find(i), [...(sites.get(find(i)) ?? []), g.id]));
  return [...sites.values()];
}

/**
 * Where each group stands once grouped by what it feeds. The shared smelters and the local miners always land in one
 * row together (the miners feed only the smelters, so they share an owner), far enough apart for both names.
 */
export function factoryPlace(id: string, owner: Owner): { x: number; y: number } {
  const row1: Record<string, number> = { finalA: 45, smelA: 110, farm: 175, partsB: 390, finalB: 460 };
  if (id in row1) return { x: row1[id]!, y: 70 };
  if (owner === "A") return { x: id === "smelS" ? 105 : 205, y: 130 };
  if (owner === "B") return { x: id === "smelS" ? 455 : 350, y: 130 };
  return { x: id === "smelS" ? 320 : 210, y: 222 };
}

const TOP_ROW = new Set(["finalA", "smelA", "farm", "partsB", "finalB"]);

/**
 * Which side of its icon a group's name sits on. Grouped by what it feeds, the top row is fed from below, so its names
 * go above the icons and the arrows arrive clear of them; everywhere else the name sits under the icon.
 */
export function labelSide(id: string, mode: "distance" | "feeds"): "above" | "below" {
  return mode === "feeds" && TOP_ROW.has(id) ? "above" : "below";
}
/** A name's baseline, from its icon's centre. Above: as far over the icon as below is under it, less the descent. */
export const labelDy = (side: "above" | "below"): number => (side === "below" ? LABEL_DY : -(NODE_R + 5));

/** The box a group's name takes, centred on its icon (drawing units; `y` is the top). */
export function labelBox(label: string, at: { x: number; y: number }, side: "above" | "below" = "below"): { x: number; y: number; w: number; h: number } {
  const w = label.length * LABEL_CHAR_W;
  return { x: at.x - w / 2, y: at.y + labelDy(side) - LABEL_PX, w, h: LABEL_PX + 3 };
}
