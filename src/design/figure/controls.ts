import type { Loop } from "./loop";

const PAUSE = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
const PLAY = '<path d="M7 5l12 7-12 7z"/>';

/** Wires a figure's control bar (Controls.astro) to its loop: play/pause, the speed slider and reset.
 *  Returns a function that removes every listener it added (a figure remounts on a layout change). */
export function wireControls(root: HTMLElement, loop: Loop, onReset: () => void): () => void {
  const off: (() => void)[] = [];
  const on = (el: Element | null, type: string, fn: () => void) => {
    if (!el) return;
    el.addEventListener(type, fn);
    off.push(() => el.removeEventListener(type, fn));
  };
  const pp = root.querySelector<HTMLButtonElement>("[data-playpause]");
  const sync = () => {
    if (!pp) return;
    pp.setAttribute("aria-label", loop.playing() ? "Pause" : "Play");
    pp.querySelector("svg")!.innerHTML = loop.playing() ? PAUSE : PLAY;
  };
  on(pp, "click", () => {
    if (loop.playing()) loop.pause();
    else loop.play();
    sync();
  });
  on(root.querySelector("[data-reset]"), "click", onReset);
  const range = root.querySelector<HTMLInputElement>("input[data-speed]");
  if (range) {
    const fill = () => range.style.setProperty("--p", `${((+range.value - +range.min) / (+range.max - +range.min)) * 100}%`);
    on(range, "input", () => {
      loop.setSpeed(+range.value);
      fill();
    });
    loop.setSpeed(+range.value);
    fill();
  }
  sync();
  return () => off.forEach((f) => f());
}

/** Marks a goal as done, once. A figure's goals (Goals.astro) sit right before the figure. */
export function tickGoal(root: HTMLElement, id: string): void {
  const goals = root.previousElementSibling?.classList.contains("fig-goals") ? root.previousElementSibling : root;
  const li = goals.querySelector<HTMLElement>(`[data-goal="${id}"]`);
  if (li && !li.classList.contains("done")) {
    li.classList.add("done");
    const said = li.querySelector("[data-done]");
    if (said) said.textContent = " (done)"; // what a screen reader hears; the ☑ is only visual
  }
}
