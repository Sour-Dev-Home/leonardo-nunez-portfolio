// Draws figure 3 from the machine model. The model (../model/machineState.ts, a port of the dash's
// classifyBuilding) decides the state; this file only reflects it and reads the controls. Nothing here
// moves on a loop: every change is a CSS transition on the design tokens (durations are 0 under
// prefers-reduced-motion, so the target state shows at once).
import { classify, runningMachine, type Classification, type Machine, type MachineState } from "../model/machineState";
import { tickGoal } from "../../../design/figure/controls";

export const CAPTION = {
  producing: "Inputs are in and the output runs at the set rate: producing.",
  underfed: "Input is short and the output is under 95% of the set rate: underfed, and the dash names the missing input.",
  backedUp: "An output slot is full: backed up, whatever the inputs are doing.",
  throttled: "Every input is full but the output is under 95%: the output is the bottleneck, so backed up, not underfed.",
  unpowered: "Off the grid, or the fuse tripped: unpowered, whatever the buffers hold.",
  paused: "Paused is checked first, so it beats even a power cut.",
  idle: "No recipe set: idle. Only paused and unpowered are checked before it.",
} as const;

export const LABEL: Record<MachineState, string> = {
  paused: "Paused",
  unpowered: "Unpowered",
  idle: "Idle",
  backedUp: "Backed up",
  underfed: "Underfed",
  producing: "Producing",
};

export function captionFor(c: Classification): string {
  if (c.state === "backedUp") return c.why === "inputs" ? CAPTION.throttled : CAPTION.backedUp;
  return CAPTION[c.state];
}

const MARKS: Partial<Record<MachineState, string>> = { paused: "paused", unpowered: "unpowered", idle: "idle", backedUp: "backedUp" };

export function mount(root: HTMLElement): () => void {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const svg = q<SVGSVGElement>("svg");
  const caption = q<HTMLElement>(".fig-caption");
  const note = q<HTMLElement>("[data-limit]");
  const inRange = q<HTMLInputElement>('input[data-ctl="input"]');
  const outRange = q<HTMLInputElement>('input[data-ctl="output"]');
  const btn = (k: string) => q<HTMLButtonElement>(`button[data-ctl="${k}"]`);
  const rules = [...root.querySelectorAll<HTMLElement>("[data-rule]")];
  let m: Machine = runningMachine();
  let sawUnpowered = false;
  let sawPaused = false;

  const fillRange = (r: HTMLInputElement) => r.style.setProperty("--p", `${r.value}%`);

  function render() {
    const c = classify(m);
    svg.dataset.state = c.state;
    root.dataset.state = c.state;
    for (const [state, mark] of Object.entries(MARKS)) q<SVGGElement>(`[data-mark="${mark}"]`).toggleAttribute("hidden", state !== c.state);
    q<SVGGElement>('[data-mark="fill"]').toggleAttribute("hidden", c.state !== "producing" && c.state !== "underfed");
    q<SVGRectElement>("[data-window-fill]").style.transform = `scaleX(${m.inputFill / 100})`;
    q<SVGRectElement>("[data-gauge=input]").style.transform = `scaleY(${m.inputFill / 100})`;
    q<SVGRectElement>("[data-gauge=output]").style.transform = `scaleY(${Math.min(100, m.outputPercent) / 100})`;
    q("[data-input-sub]").textContent = m.fluidInput ? "fluid: no slot" : m.inputFill >= 100 ? "all full" : `${Math.round(m.inputFill)}% full`;
    q("[data-output-sub]").textContent = `${Math.round(m.outputPercent)}% of set rate`;
    q("[data-status]").textContent = `Power ${m.powered ? "on" : "off"}  -  Recipe ${m.recipe ? "set" : "none"}  -  Output slot ${m.outputFull ? "full" : "has room"}${m.paused ? "  -  Paused" : ""}`;
    q<SVGCircleElement>("[data-light]").classList.toggle("off", !m.powered);
    q<SVGPathElement>("[data-flow-in]").classList.toggle("off", !m.powered || m.inputFill <= 0);
    q<SVGPathElement>("[data-flow-out]").classList.toggle("off", !m.powered || m.outputPercent <= 0);
    btn("slot").setAttribute("aria-pressed", String(m.outputFull));
    btn("power").setAttribute("aria-pressed", String(!m.powered));
    btn("paused").setAttribute("aria-pressed", String(m.paused));
    btn("recipe").setAttribute("aria-pressed", String(!m.recipe));
    rules.forEach((li, i) => {
      const hit = i === c.rule;
      li.classList.toggle("hit", hit);
      li.classList.toggle("no", i < c.rule);
      li.querySelector("[data-verdict]")!.textContent = hit ? "yes" : i < c.rule ? "no" : "";
    });
    const text = captionFor(c);
    if (caption.textContent !== text) caption.textContent = text;
    note.toggleAttribute("hidden", c.why !== "inputs");
    if (c.state === "underfed") tickGoal(root, "underfed");
    if (c.why === "slot") tickGoal(root, "slot");
    if (c.why === "inputs") tickGoal(root, "throttled");
    if (c.state === "unpowered") sawUnpowered = true;
    if (c.state === "paused") sawPaused = true;
    if (sawUnpowered && sawPaused) tickGoal(root, "order");
  }

  const off: (() => void)[] = [];
  const on = (el: Element, type: string, fn: () => void) => {
    el.addEventListener(type, fn);
    off.push(() => el.removeEventListener(type, fn));
  };
  on(inRange, "input", () => {
    m.inputFill = +inRange.value;
    fillRange(inRange);
    render();
  });
  on(outRange, "input", () => {
    m.outputPercent = +outRange.value;
    fillRange(outRange);
    render();
  });
  const toggles = { slot: "outputFull", power: "powered", paused: "paused", recipe: "recipe" } as const;
  for (const [k, field] of Object.entries(toggles)) {
    on(btn(k), "click", () => {
      m[field] = !m[field];
      render();
    });
  }
  on(q("[data-reset]"), "click", () => {
    m = runningMachine();
    inRange.value = "100";
    outRange.value = "100";
    fillRange(inRange);
    fillRange(outRange);
    render();
  });
  fillRange(inRange);
  fillRange(outRange);
  render();
  q("[data-ready-mark]").setAttribute("data-ready", "");
  return () => off.forEach((f) => f());
}
