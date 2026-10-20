// Draws figure 1 from the outage model. The model decides everything; this file only places orbs,
// eases their movement (slow in and out, squash and stretch, a damped settle) and handles input.
import { initialOutage, setBackendUp, setDbUp, stepOutage, SCALED, type OutageState, type Target } from "../model/outage";
import { seeded } from "../model/random";
import { ease, lerp, squash } from "../../../design/figure/ease";
import { prefersReducedMotion, startLoop, whileOnScreen } from "../../../design/figure/loop";
import { tickGoal, wireControls } from "../../../design/figure/controls";
import { OUTAGE, type OutageLayout } from "./layouts";

const NS = "http://www.w3.org/2000/svg";
export const CAPTION = {
  ok: "The agent sends each snapshot as it's taken; the backend stores it in PostgreSQL.",
  waking: "It's back, but the agent doesn't know yet: it finds out at its next retry, then sends the backlog oldest first.",
  be: "The backend is unreachable, so Cloudflare answers with an error. The snapshot keeps its place at the front of the queue; each retry waits longer, with jitter. When the queue is full, the oldest is dropped.",
  db: "The database is down. The backend is alive, so ECS leaves it running (it only checks liveness), but it can't store anything and answers with an error.",
};
interface Orb {
  el: SVGCircleElement;
  pos: number; // along the flow axis
  prev: number;
  off: number; // across it (falling away)
  landedAt: number;
  life?: number;
  vy?: number;
}

/** The figure's drawing that's showing: desktop or phone (Task 9 adds the phone one). */
export function visibleSvg(root: HTMLElement): SVGSVGElement {
  const all = [...root.querySelectorAll<SVGSVGElement>("svg[data-layout]")];
  return all.find((s) => !s.hasAttribute("hidden") && getComputedStyle(s).display !== "none") ?? all[0];
}

/** What survives a remount (rotating a phone): the stations the reader took down, and their pause. */
export interface OutageKept {
  backendDown: boolean;
  dbDown: boolean;
  playing: boolean;
}

export function mount(root: HTMLElement, kept: Partial<OutageKept> = {}): () => void {
  const svg = visibleSvg(root);
  const L: OutageLayout = svg.dataset.layout === "phone" ? OUTAGE.phone : OUTAGE.desktop;
  const dots = svg.querySelector<SVGGElement>("[data-dots]")!;
  const ghost = svg.querySelector<SVGCircleElement>("[data-ghost]")!;
  const caption = root.querySelector<HTMLElement>(".fig-caption")!;
  const reduced = prefersReducedMotion();
  const random = seeded(4); // deterministic, so a paused frame is the same every time
  const axisOf = (p: { x: number; y: number }) => (L.axis === "x" ? p.x : p.y);
  const start = axisOf(L.pc);
  const slot = (i: number) => L.headX - i * L.gap;
  const stationAt = (t: Target) => axisOf(L[t]);

  let s: OutageState = initialOutage();
  let orbs = new Map<number, Orb>();
  let falling: Orb[] = [];
  let sawBacklog = false;

  const mk = (): Orb => {
    const el = document.createElementNS(NS, "circle");
    el.setAttribute("r", "5.5");
    el.setAttribute("fill", "var(--satis-snapshot)");
    dots.appendChild(el);
    return { el, pos: start, prev: start, off: 0, landedAt: -9 };
  };
  const fallAway = (o: Orb) => {
    o.el.setAttribute("fill", "none");
    o.el.setAttribute("stroke", "var(--satis-dropped)");
    o.el.setAttribute("stroke-width", "1.5");
    o.life = 1;
    o.vy = -40;
    falling.push(o);
  };

  function apply(dt: number) {
    stepOutage(s, dt, random);
    for (const e of s.events) {
      const o = orbs.get(e.id);
      if (e.kind === "sampled") orbs.set(e.id, mk());
      else if (e.kind === "dropped") {
        if (!s.backendUp || !s.dbUp) tickGoal(root, "drop");
        if (!e.inFlight && o) {
          fallAway(o);
          orbs.delete(e.id);
        }
      } else if (e.kind === "error" && o) {
        o.el.setAttribute("fill", "var(--satis-error)");
        o.landedAt = s.t; // impact
        if (e.at === "backend") tickGoal(root, "db");
      } else if (e.kind === "requeued" && o) {
        o.el.setAttribute("fill", "var(--satis-snapshot)");
        o.landedAt = s.t;
      } else if (e.kind === "discarded" && o) {
        fallAway(o);
        orbs.delete(e.id);
      } else if (e.kind === "stored" && o) {
        o.el.remove();
        orbs.delete(e.id);
      }
    }
    if (!s.backendUp && s.queue.length >= 3) tickGoal(root, "wait");
    if (s.queue.length >= 3) sawBacklog = true;
    const waitDone = (root.previousElementSibling ?? root).querySelector('[data-goal="wait"].done');
    if (s.backendUp && s.dbUp && sawBacklog && s.queue.length <= 1 && waitDone) tickGoal(root, "drain");
  }

  function draw(dt: number) {
    const k = reduced || dt === 0 ? 1 : 1 - Math.exp(-dt * 10);
    s.queue.forEach((q, i) => {
      const o = orbs.get(q.id);
      if (!o || s.flight?.id === q.id) return;
      if (q.seatedAt === null) o.pos = lerp(start, slot(i), reduced ? 1 : ease.inOutCubic(Math.min(1, (s.t - q.takenAt) / SCALED.arrive)));
      else o.pos += (slot(i) - o.pos) * k;
    });
    const f = s.flight;
    if (f) {
      const o = orbs.get(f.id);
      if (o) {
        const p = Math.min(1, (s.t - f.startedAt) / f.duration);
        const from = f.phase === "out" ? slot(0) : stationAt(f.target);
        const to = f.phase === "out" ? stationAt(f.target) : slot(0);
        o.pos = lerp(from, to, reduced ? 1 : ease.inOutSine(p));
      }
    }
    // The head's held place: shown while its snapshot is away (and still has a place to come back to).
    ghost.setAttribute("opacity", f && !f.dropped ? "0.7" : "0");
    for (const d of falling) {
      d.vy! += dt * 260;
      d.off += d.vy! * dt;
      d.life! -= dt * 0.9;
    }
    falling = falling.filter((d) => {
      if (d.life! > 0) return true;
      d.el.remove();
      return false;
    });
    for (const o of [...orbs.values(), ...falling]) {
      const speed = dt > 0 ? (o.pos - o.prev) / dt : 0;
      o.prev = o.pos;
      const { sx, sy } = reduced ? { sx: 1, sy: 1 } : squash(speed, s.t - o.landedAt);
      const t = L.axis === "x" ? `translate(${o.pos} ${L.pc.y + o.off}) scale(${sx} ${sy})` : `translate(${L.pc.x + o.off} ${o.pos}) scale(${sy} ${sx})`;
      o.el.setAttribute("transform", t);
      if (o.life !== undefined) o.el.setAttribute("opacity", String(Math.max(0, o.life)));
    }
    const mode = !s.backendUp ? "be" : !s.dbUp ? "db" : s.failures > 0 ? "waking" : "ok";
    if (caption.textContent !== CAPTION[mode]) caption.textContent = CAPTION[mode];
  }

  const loop = startLoop(
    (dt) => {
      apply(dt);
      draw(dt);
    },
    { autoplay: kept.playing ?? !reduced },
  );
  const offScreen = whileOnScreen(root, loop);
  if (reduced) {
    // A meaningful paused frame: a few snapshots on their way, the same every time.
    for (let i = 0; i < 160; i++) apply(0.025);
    draw(0);
  }

  const setStation = (which: "backend" | "db", down: boolean) => {
    if (which === "backend") setBackendUp(s, !down);
    else setDbUp(s, !down);
    kept[which === "backend" ? "backendDown" : "dbDown"] = down;
    const st = svg.querySelector(`[data-station="${which}"]`)!;
    st.classList.toggle("down", down);
    st.classList.toggle("live", !down);
    st.querySelector("[data-sub]")!.textContent = which === "backend" ? (down ? "unreachable" : "ECS Fargate") : down ? "not answering" : "RDS";
    st.querySelectorAll(".led").forEach((l) => l.setAttribute("fill", down ? "var(--satis-error)" : "var(--satis-ok)"));
    root.querySelector(`button[data-toggle="${which}"]`)!.setAttribute("aria-pressed", String(down));
    if (!loop.playing()) draw(0);
  };
  const toggle = (which: "backend" | "db") => setStation(which, which === "backend" ? s.backendUp : s.dbUp);
  const off: (() => void)[] = [];
  const on = (el: EventTarget, type: string, fn: (e: Event) => void) => {
    el.addEventListener(type, fn);
    off.push(() => el.removeEventListener(type, fn));
  };
  for (const which of ["backend", "db"] as const) {
    on(root.querySelector(`button[data-toggle="${which}"]`)!, "click", () => toggle(which));
    on(svg.querySelector(`[data-station="${which}"]`)!, "click", () => toggle(which)); // the toggle button is the keyboard way
  }
  setStation("backend", kept.backendDown ?? false);
  setStation("db", kept.dbDown ?? false);
  const unwire = wireControls(root, loop, () => {
    dots.replaceChildren();
    orbs = new Map();
    falling = [];
    sawBacklog = false;
    s = initialOutage();
    setStation("backend", false);
    setStation("db", false);
    draw(0);
  });
  root.querySelector("[data-playpause]")?.setAttribute("data-ready", "");
  return () => {
    kept.playing = loop.playing();
    offScreen();
    loop.destroy();
    unwire();
    off.forEach((f) => f());
    dots.replaceChildren();
  };
}
