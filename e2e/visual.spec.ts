import { expect, test } from "@playwright/test";
import { holdMedia, scrubAnimations } from "./loading";
import { PAGES } from "./pages";

// Fonts render differently per OS, so baselines exist only for the Playwright
// container that CI uses. Elsewhere these tests skip.
test.skip(!process.env.PW_VISUAL, "visual comparisons run in the Playwright container (PW_VISUAL=1)");

// The finished page is captured in full. The in-between states are captured as
// the first screen only: the geometry tests in loading.spec.ts already check the
// whole page, and full-page copies would triple the size of every baseline refresh.
const loaded = { fullPage: true, maxDiffPixelRatio: 0.002 } as const;
const firstScreen = { fullPage: false, maxDiffPixelRatio: 0.002 } as const;

for (const { name, path } of PAGES) {
  test(`${name} looks the same when loaded`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot(`${name}.png`, { ...loaded, animations: "disabled" });
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
