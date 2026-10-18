// Draws figure 2 from the cutover model: each step's state, the backup and restore carried along their
// arcs, the route retracting from one backend and drawing out to the other, and snapshots whenever the
// agent runs. Under reduced motion every move is instant; the stepper still steps.
import { COPY, LAST_STEP, viewAt, type CutoverView } from "../model/cutover";
import { ease } from "../../../design/figure/ease";
import { prefersReducedMotion, startLoop } from "../../../design/figure/loop";
import { tickGoal } from "../../../design/figure/controls";
import { visibleSvg } from "./outage-view";
import { CUTOVER, type CutoverLayout } from "./layouts";

const NS = "http://www.w3.org/2000/svg";
type P = [number, number];
const ZONE: Record<string, string> = { pcBackend: "pc", pcDb: "pc", agent: "pc", b2: "off", awsBackend: "aws", rds: "aws" };
const SWITCH_S = 1.1;
const CARRY_S = 1.3;
const SNAP_S = 2.0;

export function mount(root: HTMLElement): () => void {
  const svg = visibleSvg(root);
  const L: CutoverLayout = svg.dataset.layout === "phone" ? CUTOVER.phone : CUTOVER.desktop;
  const reduced = prefersReducedMotion();
  const $ = <T extends Element = Element>(sel: string) => svg.querySelector<T>(sel)!;
  const dots = $<SVGGElement>("[data-dots]");
  const routes = { pc: $<SVGPathElement>("#routePc"), aws: $<SVGPathElement>("#routeAws") };
  const LEN = { pc: routes.pc.getTotalLength(), aws: routes.aws.getTotalLength() };
  for (const k of ["pc", "aws"] as const) {
    routes[k].style.strokeDasharray = `${LEN[k]} ${LEN[k]}`;
    routes[k].style.opacity = "1";
  }
  const prev = root.querySelector<HTMLButtonElement>("[data-prev]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-next]")!;
  const reset = root.querySelector<HTMLButtonElement>("[data-reset]")!;
  const caption = root.querySelector<HTMLElement>(".fig-caption")!;
  const rollback = root.querySelector<HTMLElement>(".fig-rollback")!;

  let step = 0;
  let t = 0;
  let r = 0; // 0: the route goes to the PC backend; 1: to the AWS backend
  let rTween: { from: number; to: number; t0: number } | null = null;
  let carry: { path: SVGPathElement; el: SVGRectElement; t0: number; done: () => void } | null = null;
  let flows: { el: SVGCircleElement; t0: number }[] = [];
  let nextFlow = 0;

  function render(s: number) {
    const v: CutoverView = viewAt(s);
    const set = (id: string, mode: string, sub: string) => {
      const g = $(`[data-station="${id}"]`);
      g.setAttribute("class", `st st-${ZONE[id]} ${mode}`);
      g.querySelector("[data-sub]")!.textContent = sub;
    };
    set("agent", v.agent, v.agentNote);
    set("pcBackend", v.pcBackend, v.pcBackendNote);
    set("pcDb", v.pcDb, v.pcDbNote);
    set("b2", "", v.b2Note);
    set("rds", v.rds, v.rdsNote);
    set("awsBackend", v.awsBackend, v.awsBackendNote);
    for (const [id, m] of [["pcBackend", v.pcBackend], ["awsBackend", v.awsBackend]] as const)
      $(`[data-station="${id}"]`).querySelectorAll(".led").forEach((l) => l.setAttribute("fill", m === "live" ? "var(--satis-ok)" : "#3a3f44"));
    $(`[data-station="agent"] [data-power]`).setAttribute("fill", v.sending ? "var(--satis-snapshot)" : "#3a3f44");
    $(`[data-station="b2"] [data-fill]`).setAttribute("opacity", v.b2HasDump ? "1" : "0");
    $(`[data-station="rds"] [data-fill]`).setAttribute("opacity", v.countsMatch ? "0.9" : "0");
    $("[data-check]").classList.toggle("on", v.countsMatch);
    $("#wPc").classList.toggle("idle", v.pcBackend !== "live");
    $("#wAws").classList.toggle("idle", v.awsBackend !== "live");
    $("#wAgent").classList.toggle("idle", v.agent !== "live");
    const to = v.route === "aws" ? 1 : 0;
    if (reduced) r = to;
    else if (to !== r && rTween?.to !== to) rTween = { from: r, to, t0: t };
    caption.textContent = COPY[s].caption;
    rollback.innerHTML = s ? `<b>↶ Rollback:</b> ${COPY[s].rollback}` : "";
    root.querySelectorAll(".fig-track .stp").forEach((li, i) => (li.className = "stp" + (i + 1 < s ? " done" : i + 1 === s ? " now" : "")));
    root.querySelectorAll(".fig-track .conn").forEach((c, i) => c.classList.toggle("on", s >= i + 2));
    prev.disabled = s === 0;
    next.disabled = s === LAST_STEP;
    if (s === LAST_STEP) tickGoal(root, "switch");
  }

  // The final dump (and then the restore) travels along its arc; Next and Roll back wait for it to land.
  function carryAlong(pathSel: string, done: () => void) {
    const path = $<SVGPathElement>(pathSel);
    if (reduced) return done();
    path.classList.add("on");
    const el = document.createElementNS(NS, "rect");
    for (const [k, val] of [["x", "-6"], ["y", "-5"], ["width", "12"], ["height", "10"], ["rx", "2"], ["fill", "var(--satis-backup)"]]) el.setAttribute(k, val);
    dots.appendChild(el);
    carry = {
      path,
      el,
      t0: t,
      done: () => {
        el.remove();
        path.classList.remove("on");
        carry = null;
        done();
      },
    };
  }

  function go(to: number) {
    if (carry || to < 0 || to > LAST_STEP) return; // busy: a press during the dump is ignored (Review Focus 3)
    const from = step;
    step = to;
    if (to < from) tickGoal(root, "back");
    if (to > from && (to === 2 || to === 3)) {
      render(to - 1);
      caption.textContent = COPY[to].caption;
      carryAlong(to === 2 ? "#pDump" : "#pRestore", () => render(to));
      return;
    }
    render(to);
  }

  // Agent → tunnel → route → the live backend → its database (the backend stores every snapshot).
  const snapshotPath = (): P[] => {
    const aws = r >= 1;
    const b = aws ? L.awsBackend : L.pcBackend;
    const db = aws ? L.rds : L.pcDb;
    const bx = b.x + (b.x < L.tunnel.x ? 40 : -40);
    return [[L.agent.x, L.agent.y], [L.routeExit.x, L.agent.y], [L.routeExit.x, L.gutter], [bx, L.gutter], [bx, b.y], [b.x, b.y], [db.x, db.y]];
  };
  const along = (pts: P[], u: number): P => {
    const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    let d = u * segs.reduce((a, b) => a + b, 0);
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i]) {
        const k = segs[i] ? d / segs[i] : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
      }
      d -= segs[i];
    }
    return pts[pts.length - 1];
  };

  function frame(dt: number) {
    t += dt;
    if (rTween) {
      const p = Math.min(1, (t - rTween.t0) / SWITCH_S);
      r = rTween.from + (rTween.to - rTween.from) * p;
      if (p >= 1) rTween = null;
    }
    // First half: the PC route retracts into the tunnel; second half: the AWS route draws out.
    const u1 = Math.min(1, r / 0.5);
    const u2 = Math.max(0, (r - 0.5) / 0.5);
    routes.pc.style.strokeDashoffset = String(LEN.pc * ease.inOutCubic(u1));
    routes.aws.style.strokeDashoffset = String(LEN.aws * (1 - ease.inOutCubic(u2)));
    if (carry) {
      const p = Math.min(1, (t - carry.t0) / CARRY_S);
      const pt = carry.path.getPointAtLength(ease.inOutCubic(p) * carry.path.getTotalLength());
      const sp = Math.sin(Math.PI * p) * 0.25; // a little stretch at speed
      carry.el.setAttribute("transform", `translate(${pt.x} ${pt.y}) scale(${1 + sp} ${1 / (1 + sp)})`);
      if (p >= 1) carry.done();
    }
    const sending = viewAt(step).sending;
    if (!reduced && sending && !rTween && t >= nextFlow) {
      nextFlow = t + 1.4;
      const el = document.createElementNS(NS, "circle");
      el.setAttribute("r", "5");
      el.setAttribute("fill", "var(--satis-snapshot)");
      dots.appendChild(el);
      flows.push({ el, t0: t });
    }
    flows = flows.filter((f) => {
      const p = Math.min(1, (t - f.t0) / SNAP_S);
      const [x, y] = along(snapshotPath(), ease.inOutCubic(p));
      f.el.setAttribute("transform", `translate(${x} ${y})`);
      if (p >= 1 || (!sending && p < 0.05)) {
        f.el.remove();
        return false;
      }
      return true;
    });
  }

  // The stepper always runs (the route and the dump animate); under reduced motion every move is instant.
  const loop = startLoop(frame, { autoplay: true });
  const onNext = () => go(step + 1);
  const onPrev = () => go(step - 1);
  const onReset = () => {
    if (carry) return;
    step = 0;
    render(0);
  };
  next.addEventListener("click", onNext);
  prev.addEventListener("click", onPrev);
  reset.addEventListener("click", onReset);
  render(0);
  frame(0);
  next.setAttribute("data-ready", "");
  return () => {
    loop.destroy();
    next.removeEventListener("click", onNext);
    prev.removeEventListener("click", onPrev);
    reset.removeEventListener("click", onReset);
    dots.replaceChildren();
  };
}
