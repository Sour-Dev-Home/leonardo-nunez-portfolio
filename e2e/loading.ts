import { join } from "node:path";
import type { Page, Route } from "@playwright/test";

/** Holds every image and video request (except the favicon) until released. */
export async function holdMedia(page: Page) {
  const waiting: Route[] = [];
  let released = false;
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const type = route.request().resourceType();
    // Routing turns off the browser cache, so fonts would make a slow round trip
    // and could miss font-display: optional's ~100 ms window. Serve them from
    // the build directly so they always arrive in time.
    if (type === "font") {
      return route.fulfill({ path: join(process.cwd(), "dist", url.pathname), contentType: "font/woff2" });
    }
    const isFavicon = url.pathname === "/favicon.svg";
    if (!released && (type === "image" || type === "media") && !isFavicon) waiting.push(route);
    else return route.continue();
  });
  return {
    held: () => waiting.length,
    // Continue the held requests; later ones pass straight through. (Unrouting
    // first would let Playwright continue them itself, and continuing twice throws.)
    release: async () => {
      released = true;
      await Promise.all(waiting.splice(0).map((r) => r.continue()));
    },
  };
}

export function mediaBoxes(page: Page) {
  return page.$$eval("img, video", (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        src: el.getAttribute("src") ?? el.getAttribute("poster") ?? "",
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    }),
  );
}

const CONTENT = "h1, h2, h3, p, li, img, video, figure, pre, table, .button, .project-card, .sidenote-note";

/** Pairs of visible, non-nested content elements whose boxes intersect. */
export function overlaps(page: Page) {
  return page.evaluate((selector) => {
    // checkVisibility() also rules out content the browser keeps laid out but
    // doesn't render, such as the inside of a closed <details>.
    const els = [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.checkVisibility({ visibilityProperty: true });
    });
    const label = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
    const found: string[] = [];
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const [a, b] = [els[i], els[j]];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 1 && y > 1) found.push(`${label(a)} overlaps ${label(b)}`);
      }
    }
    return found;
  }, CONTENT);
}

/** Pauses every running animation at `progress` (0 to 1) of its duration. */
export function scrubAnimations(page: Page, progress: number) {
  return page.evaluate((p) => {
    const animations = document.getAnimations();
    for (const animation of animations) {
      animation.pause();
      const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
      animation.currentTime = end * p;
    }
    return animations.length;
  }, progress);
}
