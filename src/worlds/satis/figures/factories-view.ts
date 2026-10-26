// Draws figure 4 from the factory model (../model/factories.ts). The model decides who owns what; this file
// only moves the groups there and reads the controls. Groups travel between places, so they ease in and out
// (inOutCubic, 0.6 s); colours and cards fade through CSS on the design tokens. Under prefers-reduced-motion
// everything lands at once. The slider moves nothing while it is dragged (only its readout follows); the drawing
// changes once, when it is let go (`change`), so a drag never restarts the move on every step.
import { GROUPS, NODE_R, SHARE_THRESHOLD, factoryPlace, linksFor, ownersFor, type Owner } from "../model/factories";
import { ease, lerp } from "../../../design/figure/ease";
import { prefersReducedMotion } from "../../../design/figure/loop";
import { tickGoal } from "../../../design/figure/controls";

export { NODE_R };
export const TRAVEL_SECONDS = 0.6;
export const DEFAULT_SPLIT = 60;
const PCT = Math.round(SHARE_THRESHOLD * 100);

export const CAPTION = {
  distance:
    "Grouped by distance, every machine group is within reach of another: one site, though it makes two products.",
  feeds:
    "Grouped by what it feeds, the ore farm joins Product A, which it supplies, though it stands beside Product B's parts.",
} as const;

export function captionFor(mode: "distance" | "feeds", toA: number): string {
  if (mode === "distance") return CAPTION.distance;
  const o = ownersFor(toA).smelS;
  if (o === "shared") return `${CAPTION.feeds} The smelters send ${toA}% to A and ${100 - toA}% to B, under ${PCT}% to either, so they are shared.`;
  const share = o === "A" ? toA : 100 - toA;
  return `${CAPTION.feeds} The smelters send ${share}% to Product ${o}, ${PCT}% or more, so they join its factory, and so do the miners that feed only them.`;
}

type Pt = { x: number; y: number };

export function mount(root: HTMLElement): () => void {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const svg = q<SVGSVGElement>("svg");
  const caption = q<HTMLElement>(".fig-caption");
  const range = q<HTMLInputElement>('input[data-ctl="split"]');
  const rangeText = q<HTMLElement>("[data-split-text]");
  const bDist = q<HTMLButtonElement>('button[data-ctl="distance"]');
  const bFeeds = q<HTMLButtonElement>('button[data-ctl="feeds"]');
  const nodes = new Map(GROUPS.map((g) => [g.id, q<SVGGElement>(`[data-group="${g.id}"]`)]));
  const lines = [...root.querySelectorAll<SVGLineElement>("[data-link]")];
  let mode: "distance" | "feeds" = "distance";
  let toA = DEFAULT_SPLIT;
  const cur = new Map<string, Pt>(GROUPS.map((g) => [g.id, { ...g.at }]));
  let from = new Map(cur);
  let to = new Map(cur);
  let elapsed = TRAVEL_SECONDS;
  let raf = 0;
  let last = 0;

  const targets = () => {
    const owners = ownersFor(toA);
    return new Map(GROUPS.map((g) => [g.id, mode === "distance" ? { ...g.at } : factoryPlace(g.id, owners[g.id]!)]));
  };

  function draw() {
    const p = ease.inOutCubic(Math.min(1, elapsed / TRAVEL_SECONDS));
    for (const g of GROUPS) {
      const a = from.get(g.id)!;
      const b = to.get(g.id)!;
      const pt = { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
      cur.set(g.id, pt);
      nodes.get(g.id)!.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    }
    for (const ln of lines) {
      const a = cur.get(ln.dataset.from!)!;
      const b = cur.get(ln.dataset.to!)!;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / d;
      const uy = (b.y - a.y) / d;
      ln.setAttribute("x1", (a.x + ux * NODE_R).toFixed(1));
      ln.setAttribute("y1", (a.y + uy * NODE_R).toFixed(1));
      ln.setAttribute("x2", (b.x - ux * (NODE_R + 3)).toFixed(1));
      ln.setAttribute("y2", (b.y - uy * (NODE_R + 3)).toFixed(1));
    }
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    draw();
    raf = elapsed < TRAVEL_SECONDS ? requestAnimationFrame(frame) : 0;
  }

  function retarget() {
    from = new Map(cur);
    to = targets();
    elapsed = 0;
    if (prefersReducedMotion()) {
      elapsed = TRAVEL_SECONDS;
      draw();
      return;
    }
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function render() {
    const owners = ownersFor(toA);
    root.dataset.mode = mode;
    svg.dataset.mode = mode;
    svg.toggleAttribute("data-tray", Object.values(owners).includes("shared"));
    for (const g of GROUPS) nodes.get(g.id)!.dataset.owner = owners[g.id] as Owner;
    for (const ln of lines) {
      const l = linksFor(toA).find((x) => x.from === ln.dataset.from && x.to === ln.dataset.to)!;
      ln.style.opacity = l.rate === 0 ? "0" : "";
    }
    bDist.setAttribute("aria-pressed", String(mode === "distance"));
    bFeeds.setAttribute("aria-pressed", String(mode === "feeds"));
    range.style.setProperty("--p", `${toA}%`);
    rangeText.textContent = `${toA}% to A, ${100 - toA}% to B`;
    const text = captionFor(mode, toA);
    if (caption.textContent !== text) caption.textContent = text;
    if (mode === "feeds") tickGoal(root, "feeds");
    if (mode === "feeds" && owners.smelS !== "shared") tickGoal(root, "handover");
  }

  const off: (() => void)[] = [];
  const on = (el: Element, type: string, fn: () => void) => {
    el.addEventListener(type, fn);
    off.push(() => el.removeEventListener(type, fn));
  };
  const setMode = (m: "distance" | "feeds") => () => {
    if (m === mode) return;
    mode = m;
    render();
    retarget();
  };
  on(bDist, "click", setMode("distance"));
  on(bFeeds, "click", setMode("feeds"));
  // While dragging, only the readout follows; the groups, colours and caption change on release.
  on(range, "input", () => {
    range.style.setProperty("--p", `${range.value}%`);
    rangeText.textContent = `${range.value}% to A, ${100 - +range.value}% to B`;
  });
  on(range, "change", () => {
    if (+range.value === toA) return;
    toA = +range.value;
    render();
    retarget();
  });
  on(q("[data-reset]"), "click", () => {
    mode = "distance";
    toA = DEFAULT_SPLIT;
    range.value = String(DEFAULT_SPLIT);
    render();
    retarget();
  });
  render();
  draw();
  q("[data-ready-mark]").setAttribute("data-ready", "");
  return () => {
    off.forEach((f) => f());
    if (raf) cancelAnimationFrame(raf);
  };
}
