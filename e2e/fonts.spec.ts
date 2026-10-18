import { expect, test, type Route } from "@playwright/test";
import { PAGES } from "./pages";

// font-display: optional means a font that arrives late is not swapped in, so
// holding the fonts back must not change the layout once they are released.
for (const { name, path } of PAGES.filter((p) => p.status === 200)) {
  test(`${name}: a late font doesn't reflow the page`, async ({ page }) => {
    const held: Route[] = [];
    let released = false;
    await page.route("**/fonts/*.woff2", (route) => (released ? route.continue() : void held.push(route)));
    await page.goto(path, { waitUntil: "domcontentloaded" });
    // Measure what the visitor actually sees: wait until a frame has been painted.
    // Before the first paint Chrome may still be waiting on preloaded fonts, and a
    // font arriving then changes nothing anyone saw.
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const box = () =>
      page.evaluate(() => {
        const r = document.querySelector("main")!.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
    const before = await box();
    // "Late" means after optional's ~100 ms block period; a font released inside
    // that window is on time and may legitimately be used.
    await page.waitForTimeout(500);
    released = true;
    await Promise.all(held.splice(0).map((r) => r.continue()));
    await page.waitForLoadState("networkidle");
    const after = await box();
    expect(after.height).toBeCloseTo(before.height, 0);
    expect(after.width).toBeCloseTo(before.width, 0);
  });
}
