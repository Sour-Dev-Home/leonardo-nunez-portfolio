// Moves the token along the drawn track from stop to stop (../model/path.ts). It dwells at each stop, and waits at
// one with an action until the reader presses the action button. A switch restarts the lane. Under reduced motion,
// moves are instant and nothing plays until the reader presses Play.
import { ACTION_LABEL, journey, NO_SWITCHES, reviewersFor, STATIONS, type Stop, type Switches } from "../model/path";
import { ease } from "../../../design/figure/ease";
import { prefersReducedMotion, startLoop, whileOnScreen } from "../../../design/figure/loop";
import { tickGoal, wireControls } from "../../../design/figure/controls";

const SPEED = 170; // track units per second
// Where the token rests at a station: this far along the track before its centre, just clear of the disc (r 34)
// for the token (r 7), so it stays in sight without covering the icon. It passes behind the icons in between.
const REST = 44;
const DWELL: Record<Stop["kind"], number> = { pass: 1.4, wait: 2.2, fail: 2.2 };

function visibleSvg(root: HTMLElement): SVGSVGElement {
  return [...root.querySelectorAll<SVGSVGElement>("svg[data-layout]")].find((s) => !s.hasAttribute("hidden"))!;
}

/** What survives a remount (rotating a phone): the reader's pause. The switches keep theirs in aria-pressed. */
export interface LanesKept {
  playing: boolean;
}

export function mount(root: HTMLElement, kept: Partial<LanesKept> = {}): () => void {
  const svg = visibleSvg(root);
  const reduced = prefersReducedMotion();
  const track = svg.querySelector<SVGPathElement>('[data-path="track"]')!;
  const token = svg.querySelector<SVGCircleElement>(".lanes-token")!;
  const caption = root.querySelector<HTMLElement>(".fig-caption")!;
  const act = root.querySelector<HTMLButtonElement>("[data-act]")!;
  const switches = [...root.querySelectorAll<HTMLButtonElement>("[data-switch]")];
  const stationEl = (id: string) => svg.querySelector<SVGGElement>(`[data-station="${id}"]`)!;
  const reviewersSub = stationEl("reviewers").querySelector("[data-sub]")!;

  // Where each station sits along the track: the sampled point nearest its centre.
  const total = track.getTotalLength();
  const along: Record<string, number> = {};
  for (const id of STATIONS) {
    const g = stationEl(id).transform.baseVal.consolidate()!.matrix;
    let best = 0;
    let bestD = Infinity;
    for (let d = 0; d <= total; d += 2) {
      const p = track.getPointAtLength(d);
      const dist = Math.hypot(p.x - g.e, p.y - g.f);
      if (dist < bestD) [best, bestD] = [d, dist];
    }
    along[id] = best;
  }
  // Short of the station; the first one, at the very start of the track, rests just past it instead.
  const rest = (id: string) => (along[id] >= REST ? along[id] - REST : along[id] + REST);

  // The switches' state lives on their buttons, so a remount (rotating a phone) picks it up.
  let sw: Switches = { ...NO_SWITCHES };
  for (const b of switches) sw = { ...sw, [b.dataset.switch as keyof Switches]: b.getAttribute("aria-pressed") === "true" };
  let stops: Stop[] = [];
  let i = 0;
  let phase: "travel" | "dwell" | "await" | "done" = "dwell";
  let from = 0;
  let to = 0;
  let t = 0;

  const place = (d: number) => {
    const p = track.getPointAtLength(d);
    token.setAttribute("transform", `translate(${p.x} ${p.y})`);
  };
  function show(stop: Stop) {
    caption.textContent = stop.caption;
    for (const id of STATIONS) stationEl(id).setAttribute("class", `lst${id === stop.at ? ` ${stop.kind === "pass" ? "now" : stop.kind}` : ""}`);
    token.setAttribute("class", `lanes-token${stop.kind === "pass" ? "" : ` ${stop.kind}`}`);
    const waiting = stop.action !== undefined;
    act.setAttribute("aria-disabled", String(!waiting));
    act.textContent = waiting ? ACTION_LABEL[stop.action!] : "No action needed";
    phase = waiting ? "await" : "dwell";
    t = 0;
  }
  function restart() {
    stops = journey(sw);
    reviewersSub.textContent = reviewersFor(sw).join(", ");
    i = 0;
    from = to = rest("issue");
    place(from);
    show(stops[0]);
    loop.wake();
  }
  function leave() {
    const goal = stops[i].goal;
    if (goal) tickGoal(root, goal);
    if (i === stops.length - 1) {
      phase = "done";
      return;
    }
    i += 1;
    from = to;
    to = rest(stops[i].at);
    if (to === from || reduced) {
      place(to);
      show(stops[i]);
    } else {
      phase = "travel";
      t = 0;
    }
  }

  // Returns false when nothing will move until the reader acts, so the loop stops asking for frames.
  function frame(dt: number): boolean {
    if (phase === "await" || phase === "done") return false;
    t += dt;
    if (phase === "travel") {
      const p = Math.min(1, t / (Math.abs(to - from) / SPEED));
      place(from + (to - from) * ease.inOutSine(p));
      if (p >= 1) show(stops[i]);
    } else if (t >= DWELL[stops[i].kind]) {
      leave();
    }
    return true;
  }

  const loop = startLoop(frame, { autoplay: kept.playing ?? !reduced });
  const offScreen = whileOnScreen(root, loop);
  const unwire = wireControls(root, loop, restart);
  const onAct = () => {
    if (phase !== "await") return; // nothing waiting, or already pressed (Review Focus 2)
    leave();
    loop.wake();
  };
  const offs = switches.map((b) => {
    const fn = () => {
      const key = b.dataset.switch as keyof Switches;
      sw = { ...sw, [key]: !sw[key] };
      b.setAttribute("aria-pressed", String(sw[key]));
      restart(); // Review Focus 1: a changed lane starts over
    };
    b.addEventListener("click", fn);
    return () => b.removeEventListener("click", fn);
  });
  act.addEventListener("click", onAct);
  restart();
  act.setAttribute("data-ready", "");
  return () => {
    kept.playing = loop.playing();
    loop.destroy();
    offScreen();
    unwire();
    offs.forEach((f) => f());
    act.removeEventListener("click", onAct);
    place(rest("issue"));
  };
}
