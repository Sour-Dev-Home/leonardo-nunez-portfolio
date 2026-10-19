// The layout checks CI runs on every page, shared with the leonardonunez.dev figure. e2e/in-page.ts sends each one
// into the page as source text, so a check may reference nothing outside its own body.

/** Every drawn line in a figure's visible drawing, sampled every 2 units, tested against every text box (+2 px).
 *  Only the drawn part of a route counts (length minus its dash offset). Returns "<line> x <label>" hits. */
export function labelCollisions(fig: ParentNode): string[] {
  const svg = [...fig.querySelectorAll("svg[data-layout]")].find((s) => s.getBoundingClientRect().width > 0);
  if (!svg) return [];
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
      for (const { n, r } of texts) if (p.x > r.left - 2 && p.x < r.right + 2 && p.y > r.top - 2 && p.y < r.bottom + 2) out.add(`${path.dataset.path || path.getAttribute("class")} x ${n}`);
    }
  }
  return [...out];
}

/** How far a page title starts from its box's left content edge, in px. Caught on /about and /kit (#38): a grid
 *  meant for the home hero's portrait put the kicker in one column and the h1 in the other. */
export function titleGap(h1: Element): number {
  const box = h1.parentElement!;
  const left = box.getBoundingClientRect().left + parseFloat(getComputedStyle(box).paddingLeft);
  return h1.getBoundingClientRect().left - left;
}

/** How many px an element's content is wider than its box: above 0, it scrolls sideways. */
export function overflowX(el: Pick<Element, "scrollWidth" | "clientWidth">): number {
  return el.scrollWidth - el.clientWidth;
}

/** Each image and video's rounded box, to compare before and after it loads. */
export function mediaBoxes(scope: ParentNode, selector = "img, video"): { src: string; width: number; height: number }[] {
  return [...scope.querySelectorAll(selector)].map((el) => {
    const r = el.getBoundingClientRect();
    return { src: el.getAttribute("src") ?? el.getAttribute("poster") ?? "", width: Math.round(r.width), height: Math.round(r.height) };
  });
}
