import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

for (const { name, path, status } of PAGES) {
  test(`${name} loads with status ${status}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
  });

  test(`${name} has no horizontal page scroll`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });

  // Where scrollbars take space (Linux, Windows desktop), a page that is only
  // laid out right with a scrollbar shifts when it appears or disappears. That
  // also makes full-page screenshots flip between two heights.
  test(`${name} keeps its layout whether or not a scrollbar is shown`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const main = () =>
      page.evaluate(() => {
        const r = document.querySelector("main")!.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
    const scrolling = await main();
    // A viewport taller than the page has no vertical scrollbar.
    const { width } = page.viewportSize()!;
    await page.setViewportSize({ width, height: Math.ceil(scrolling.height) + 2000 });
    const notScrolling = await main();
    expect(notScrolling.width).toBeCloseTo(scrolling.width, 1);
    expect(notScrolling.height).toBeCloseTo(scrolling.height, 0);
  });
}
