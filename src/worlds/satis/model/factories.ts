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

export interface Group {
  id: string;
  label: string;
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
  { id: "finalA", label: "Product A", at: { x: 70, y: 60 }, final: "A" },
  { id: "smelA", label: "Smelters", at: { x: 150, y: 60 } },
  { id: "farm", label: "Ore farm", at: { x: 420, y: 140 } },
  { id: "mineS", label: "Local miners", at: { x: 130, y: 205 } },
  { id: "smelS", label: "Shared smelters", at: { x: 190, y: 140 } },
  { id: "partsB", label: "Parts B", at: { x: 275, y: 140 } },
  { id: "finalB", label: "Product B", at: { x: 345, y: 190 }, final: "B" },
];

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

/** Where each group stands once grouped by what it feeds. */
export function factoryPlace(id: string, owner: Owner): { x: number; y: number } {
  const row1: Record<string, number> = { finalA: 45, smelA: 110, farm: 175, partsB: 390, finalB: 460 };
  if (id in row1) return { x: row1[id]!, y: 70 };
  if (owner === "A") return { x: id === "smelS" ? 110 : 175, y: 130 };
  if (owner === "B") return { x: id === "smelS" ? 390 : 320, y: 130 };
  return { x: id === "smelS" ? 305 : 215, y: 218 };
}
