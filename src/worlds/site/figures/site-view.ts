// Injects the bug the reader picks into four miniature pages, each laid out at its real width, and checks each
// with the code CI runs (src/design/checks). Nothing moves on its own: every change follows a press.
import { CASES, failureText, type Case, type Width } from "../model/cases";
import { labelCollisions, mediaBoxes, overflowX, titleGap } from "../../../design/checks/checks";

// The label's width under the machine's fonts and under CI's wider ones (#40), fixed so the geometry is exact.
const LABEL = { normal: "140", ci: "170" };

/** The case's check on one frame: why it fails, or null when it passes. */
function failure(c: Case, frame: HTMLElement): string | null {
  const page = frame.querySelector<HTMLElement>(".m-page")!;
  switch (c.id) {
    case "fonts": {
      const hits = labelCollisions(frame);
      return hits.length ? hits.join(", ") : null;
    }
    case "hero": {
      const scale = Number(page.dataset.scale) || 1;
      return Math.abs(titleGap(page.querySelector(".m-h1")!)) / scale < 1 ? null : "the title doesn't start at the content's left edge";
    }
    case "media": {
      // Measure the page as it would be while the picture loads, then loaded, as the e2e test does.
      const measure = () => JSON.stringify([mediaBoxes(page, ".m-img"), page.scrollHeight]);
      page.classList.remove("loaded");
      const before = measure();
      page.classList.add("loaded");
      return before === measure() ? null : "the picture's box changed when it loaded";
    }
    case "line":
      return overflowX(page) > 0 ? "the page scrolls sideways" : null;
  }
}

export function mount(root: HTMLElement): () => void {
  const frames = [...root.querySelectorAll<HTMLElement>(".sf")];
  const bugs = [...root.querySelectorAll<HTMLButtonElement>("[data-bug]")];
  const picks = [...root.querySelectorAll<HTMLButtonElement>("[data-pick]")];
  const fix = root.querySelector<HTMLButtonElement>("[data-fix]")!;
  const reset = root.querySelector<HTMLButtonElement>("[data-reset]")!;
  const caption = root.querySelector<HTMLElement>(".fig-caption")!;
  const idle = caption.textContent ?? "";
  let current: Case | null = null;
  let fixed = false;

  // Scale each page to its view; the page keeps laying itself out at its real width. A transform, not CSS zoom:
  // Firefox leaves zoom out of getScreenCTM(), so the collision check would look in the wrong place.
  function fit() {
    for (const f of frames) {
      const view = f.querySelector<HTMLElement>(".sf-view")!;
      const page = f.querySelector<HTMLElement>(".m-page")!;
      const scale = view.clientWidth / Number(f.dataset.w);
      page.dataset.scale = String(scale);
      page.style.transform = `scale(${scale})`;
    }
  }

  /** Shows the frame for one width. */
  function show(w: string) {
    for (const p of picks) p.setAttribute("aria-pressed", String(p.dataset.pick === w));
    root.dataset.show = w;
    fit();
  }

  /** Applies the state, checks every frame, and (after a press) says what happened. Returns the failing widths. */
  function run(announce: boolean): Width[] {
    if (current) root.dataset.case = current.id;
    else delete root.dataset.case;
    root.toggleAttribute("data-fixed", fixed);
    for (const t of root.querySelectorAll(".m-label")) t.setAttribute("textLength", current?.id === "fonts" ? LABEL.ci : LABEL.normal);
    const failing: Width[] = [];
    let detail = "";
    for (const f of frames) {
      const w = Number(f.dataset.w) as Width;
      const why = current ? failure(current, f) : null;
      f.dataset.result = why ? "fail" : "pass";
      f.setAttribute("aria-label", `The page at ${w} px: ${why ? `fails, ${why}` : "passes"}`);
      f.querySelector(".sf-out")!.textContent = why ? "fails" : "passes";
      root.querySelector(`[data-pick="${w}"]`)?.setAttribute("data-result", f.dataset.result);
      if (why) {
        failing.push(w);
        detail = why;
      }
    }
    for (const b of bugs) b.setAttribute("aria-pressed", String(b.dataset.bug === current?.id));
    fix.setAttribute("aria-disabled", String(!current || fixed || failing.length === 0));
    if (!announce) return failing;
    if (!current) caption.textContent = idle;
    else if (failing.length) caption.textContent = `${current.bug} ${failureText(current, failing, detail)}`;
    else caption.textContent = `${fixed ? current.fix : current.bug} Passes at all four widths.`;
    return failing;
  }

  const offs = bugs.map((b) => {
    const fn = () => {
      const c = CASES.find((x) => x.id === b.dataset.bug)!;
      current = current?.id === c.id ? null : c;
      fixed = false;
      // Go straight to where it breaks, so the reader watches that page fail and then get fixed.
      const failing = run(true);
      if (failing.length) show(String(failing[0]));
    };
    b.addEventListener("click", fn);
    return () => b.removeEventListener("click", fn);
  });
  const onFix = () => {
    if (fix.getAttribute("aria-disabled") === "true") return; // nothing to fix, or already fixed
    fixed = true;
    run(true);
  };
  const onReset = () => {
    current = null;
    fixed = false;
    run(true);
  };
  const pickOffs = picks.map((b) => {
    const fn = () => show(b.dataset.pick!);
    b.addEventListener("click", fn);
    return () => b.removeEventListener("click", fn);
  });
  fix.addEventListener("click", onFix);
  reset.addEventListener("click", onReset);
  // A resize refits and re-checks, but says nothing: the reader didn't do anything.
  const ro = new ResizeObserver(() => {
    fit();
    run(false);
  });
  for (const f of frames) ro.observe(f.querySelector(".sf-view")!);

  fit();
  run(false);
  root.setAttribute("data-mounted", "");
  fix.setAttribute("data-ready", "");
  return () => {
    ro.disconnect();
    offs.forEach((f) => f());
    pickOffs.forEach((f) => f());
    fix.removeEventListener("click", onFix);
    reset.removeEventListener("click", onReset);
  };
}
