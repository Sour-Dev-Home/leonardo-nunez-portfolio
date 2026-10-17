import { expect, test } from "@playwright/test";
import { overlaps, scrubAnimations } from "./loading";

// The detectors are only useful if they can fail, so check them on pages built
// to contain (or not contain) the problem.
test.describe("loading helpers", () => {
  test("overlaps reports two paragraphs drawn on top of each other", async ({ page }) => {
    await page.setContent(`
      <p style="position:absolute;top:10px;left:10px;width:200px">First</p>
      <p style="position:absolute;top:15px;left:20px;width:200px">Second</p>`);
    expect(await overlaps(page)).toHaveLength(1);
  });

  test("overlaps ignores content inside a closed details element", async ({ page }) => {
    await page.setContent(`
      <p>Visible paragraph</p>
      <details><summary>More</summary><p style="margin-top:-40px">Hidden text</p></details>`);
    expect(await overlaps(page)).toEqual([]);
  });

  test("scrubAnimations freezes a CSS animation at the requested point", async ({ page }) => {
    await page.setContent(`
      <style>@keyframes slide { from { margin-left: 0 } to { margin-left: 100px } }</style>
      <p id="box" style="animation: slide 1s linear both">Box</p>`);
    expect(await scrubAnimations(page, 0.5)).toBe(1);
    expect(await page.$eval("#box", (el) => getComputedStyle(el).marginLeft)).toBe("50px");
  });
});
