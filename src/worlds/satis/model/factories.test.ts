import { describe, expect, it } from "vitest";
import { CARDS, GROUPS, NODE_R, PROXIMITY_RADIUS, VIEW, factoryPlace, labelBox, linksFor, ownersFor, proximitySites, sharesOf } from "./factories";

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

type Box = { x: number; y: number; w: number; h: number };
const GAP = 4;
const hits = (a: Box, b: Box) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, b: Box) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const chip = (at: { x: number; y: number }): Box => ({ x: at.x - NODE_R, y: at.y - NODE_R, w: 2 * NODE_R, h: 2 * NODE_R });
/** A card's name, 13 px semibold, set just above its top edge. */
const cardLabel = (c: (typeof CARDS)[keyof typeof CARDS]): Box => ({ x: c.x, y: c.y - 19, w: c.label.length * 13 * 0.62, h: 16 });

/** Every resting layout the figure can show: by distance, and by what it feeds at each slider value. */
function layouts() {
  const out: { name: string; place: Record<string, { x: number; y: number }>; feeds: boolean; owners: Record<string, string> }[] = [];
  out.push({ name: "by distance", place: Object.fromEntries(GROUPS.map((g) => [g.id, g.at])), feeds: false, owners: ownersFor(60) });
  for (let toA = 0; toA <= 100; toA++) {
    const owners = ownersFor(toA);
    out.push({ name: `feeds at ${toA}%`, place: Object.fromEntries(GROUPS.map((g) => [g.id, factoryPlace(g.id, owners[g.id]!)])), feeds: true, owners });
  }
  return out;
}

describe("the figure's layout (no text overlaps anywhere along the slider)", () => {
  for (const l of layouts()) {
    it(`${l.name}: names never overlap each other or another group's icon, and stay in the drawing`, () => {
      const names = GROUPS.map((g) => ({ id: g.id, box: labelBox(g.label, l.place[g.id]!) }));
      for (const [i, a] of names.entries()) {
        expect(inside(a.box, { x: 0, y: 0, w: VIEW.w, h: VIEW.h }), `${a.id}'s name leaves the drawing`).toBe(true);
        for (const b of names.slice(i + 1)) expect(hits(a.box, b.box), `${a.id} and ${b.id}'s names overlap`).toBe(false);
        for (const g of GROUPS) {
          if (g.id !== a.id) expect(hits(a.box, chip(l.place[g.id]!)), `${a.id}'s name covers ${g.id}'s icon`).toBe(false);
        }
      }
    });
    if (l.feeds) {
      it(`${l.name}: every group and its name sit inside its factory's card, clear of the card names`, () => {
        for (const g of GROUPS) {
          const card = CARDS[l.owners[g.id] as keyof typeof CARDS];
          const at = l.place[g.id]!;
          expect(inside(chip(at), card), `${g.id}'s icon is outside its card`).toBe(true);
          expect(inside(labelBox(g.label, at), card), `${g.id}'s name is outside its card`).toBe(true);
          for (const c of Object.values(CARDS)) expect(hits(labelBox(g.label, at), cardLabel(c)), `${g.id}'s name meets "${c.label}"`).toBe(false);
        }
      });
    }
  }
});
