import { expect, test, type Page } from "@playwright/test";
import { pageTag } from "./pages";
import { CAPTION } from "../src/worlds/satis/figures/factories-view";

const FIG = 'figure[data-figure="factories"]';
const tag = { tag: pageTag("case-study") };
const caption = (page: Page) => page.locator(`${FIG} .fig-caption`);
const btn = (page: Page, k: string) => page.locator(`${FIG} button[data-ctl="${k}"]`);

async function ready(page: Page) {
  await page.goto("/projects/satisfactory-dash");
  await page.locator(FIG).scrollIntoViewIfNeeded();
  await expect(page.locator(`${FIG} [data-ready]`)).toHaveAttribute("data-ready", "");
}

test.describe("factories figure", () => {
  test("renders the proximity grouping before its script runs", tag, async ({ page }) => {
    await page.route("**/_astro/*.js", (r) => r.abort());
    await page.goto("/projects/satisfactory-dash");
    const box = await page.locator(FIG).boundingBox();
    expect(box!.height).toBeGreaterThan(250);
    await expect(caption(page)).toHaveText(CAPTION.distance);
    await expect(page.locator(`${FIG} svg[role="img"]`)).toBeVisible();
  });

  test("works from the keyboard: grouping by what it feeds, then handing over the shared smelters", tag, async ({ page }) => {
    await ready(page);
    await btn(page, "feeds").focus();
    await page.keyboard.press("Enter");
    await expect(btn(page, "feeds")).toHaveAttribute("aria-pressed", "true");
    await expect(caption(page)).toContainText("the ore farm joins Product A");
    await expect(page.locator('[data-goal="feeds"]')).toHaveClass(/done/);
    await page.locator(`${FIG} input[data-ctl="split"]`).fill("96");
    await expect(caption(page)).toContainText("they join its factory");
    await expect(page.locator('[data-goal="handover"]')).toHaveClass(/done/);
  });

  test("lands at once under reduced motion", tag, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    await btn(page, "feeds").click();
    await expect(page.locator(`${FIG} [data-group="farm"]`)).toHaveAttribute("transform", "translate(175.0 70.0)");
  });
});
