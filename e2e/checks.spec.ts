import { expect, test } from "@playwright/test";
import { labelCollisions } from "./figures";

// Before the checks moved to src/design/checks, a figure that showed no drawing made the collision test throw.
// It must still fail loudly, not report "no collisions".
test("the collision check fails when a figure shows no drawing", async ({ page }) => {
  await page.setContent('<figure id="f"><svg data-layout="desktop" style="display: none"></svg></figure>');
  await expect(labelCollisions(page, "#f")).rejects.toThrow(/no visible drawing/);
});
