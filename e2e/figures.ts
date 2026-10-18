import type { Page } from "@playwright/test";

/** Every drawn line and orb path in a figure, sampled every 2 units, tested against every text box (+2 px).
 *  Only the drawn part of a route counts (length minus its dash offset). Returns "<line> x <label>" hits. */
export function labelCollisions(page: Page, root: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const fig = document.querySelector(sel)!;
    const svg = [...fig.querySelectorAll("svg[data-layout]")].find((s) => s.getBoundingClientRect().width > 0)!;
    const texts = [...svg.querySelectorAll("text")].filter((t) => t.textContent).map((t) => ({ n: t.textContent ?? "", r: t.getBoundingClientRect() }));
    const out = new Set<string>();
    for (const path of svg.querySelectorAll<SVGPathElement>("path.wire, path.route, path.path-dump.on")) {
      const cs = getComputedStyle(path);
      if (cs.opacity === "0" || cs.visibility === "hidden") continue;
      const L = path.getTotalLength();
      const vis = path.classList.contains("route") ? L - (parseFloat(cs.strokeDashoffset) || 0) : L;
      const m = path.getScreenCTM()!;
      for (let d = 0; d <= vis; d += 2) {
        const p = path.getPointAtLength(d).matrixTransform(m);
        for (const { n, r } of texts) if (p.x > r.left - 2 && p.x < r.right + 2 && p.y > r.top - 2 && p.y < r.bottom + 2) out.add(`${path.id || path.getAttribute("class")} x ${n}`);
      }
    }
    return [...out];
  }, root);
}
