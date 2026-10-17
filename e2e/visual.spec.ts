import { expect, test } from "@playwright/test";
import { holdMedia, scrubAnimations } from "./loading";
import { PAGES } from "./pages";

// Fonts render differently per OS, so baselines exist only for the Playwright
// container that CI uses. Elsewhere these tests skip.
test.skip(!process.env.PW_VISUAL, "visual comparisons run in the Playwright container (PW_VISUAL=1)");

// The finished page is captured in full. The in-between states are captured as
// the first screen only: the geometry tests in loading.spec.ts already check the
// whole page, and full-page copies would triple the size of every baseline refresh.
// An absolute pixel budget, not a ratio: 0.2% of an 8,000 px-tall page is ~21k
// pixels, enough to hide a missing badge or icon.
const loaded = { fullPage: true, maxDiffPixels: 200 } as const;
const firstScreen = { fullPage: false, maxDiffPixels: 200 } as const;

for (const { name, path } of PAGES) {
  test(`${name} looks the same when loaded`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path, { waitUntil: "networkidle" });
    // The page is a fractional number of pixels tall, and Chrome's full-page
    // capture rounds that differently from one shot to the next (seen: 8194 vs
    // 8197 px, identical content). Clipping to a whole-pixel height measured once
    // keeps every capture the same size.
    const height = await page.evaluate(() => Math.floor(document.body.getBoundingClientRect().bottom));
    const clip = { x: 0, y: 0, width: page.viewportSize()!.width, height };
    await expect(page).toHaveScreenshot(`${name}.png`, { ...loaded, clip, animations: "disabled" });
  });

  test(`${name} looks the same while its media loads`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await holdMedia(page);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveScreenshot(`${name}-loading.png`, { ...firstScreen, animations: "disabled" });
  });

  test(`${name} looks the same halfway through its animations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await scrubAnimations(page, 0.5);
    await expect(page).toHaveScreenshot(`${name}-midway.png`, { ...firstScreen, animations: "allow" });
  });
}
