import { expect, test, type Page } from "@playwright/test";
import { labelCollisions } from "./figures";
import { pageTag } from "./pages";
import { CAPTION } from "../src/worlds/satis/figures/machine-states-view";

const FIG = 'figure[data-figure="machine-states"]';
const tag = { tag: pageTag("case-study") };
const caption = (page: Page) => page.locator(`${FIG} .fig-caption`);
const btn = (page: Page, k: string) => page.locator(`${FIG} button[data-ctl="${k}"]`);
const slider = (page: Page, k: string) => page.locator(`${FIG} input[data-ctl="${k}"]`);

async function ready(page: Page) {
  await page.goto("/projects/satisfactory-dash");
  await page.locator(FIG).scrollIntoViewIfNeeded();
  await expect(page.locator(`${FIG} [data-ready]`)).toHaveAttribute("data-ready", "");
}

test.describe("machine-states figure", () => {
  test("renders a producing machine before its script runs", tag, async ({ page }) => {
    await page.route("**/_astro/*.js", (r) => r.abort());
    await page.goto("/projects/satisfactory-dash");
    const box = await page.locator(FIG).boundingBox();
    expect(box!.height).toBeGreaterThan(300);
    await expect(caption(page)).toHaveText(CAPTION.producing);
    await expect(page.locator(`${FIG} [data-rule].hit`)).toContainText("Producing");
    await expect(page.locator(`${FIG} svg[role="img"]`)).toBeVisible();
  });

  test("the newest rule: every input full with the output under 95% is backed up, not underfed", tag, async ({ page }) => {
    await ready(page);
    await slider(page, "output").fill("10");
    await expect(caption(page)).toHaveText(CAPTION.throttled);
    await expect(page.locator(`${FIG} [data-rule].hit`)).toContainText("Backed up");
    await expect(page.locator(`${FIG} [data-limit]`)).toBeVisible();
    await expect(page.locator('[data-goal="throttled"]')).toHaveClass(/done/);
    await slider(page, "input").fill("40");
    await expect(caption(page)).toHaveText(CAPTION.underfed);
    await expect(page.locator('[data-goal="underfed"]')).toHaveClass(/done/);
  });

  test("works from the keyboard alone: every control, and the order of the checks", tag, async ({ page }) => {
    await ready(page);
    await btn(page, "slot").focus();
    await page.keyboard.press("Enter");
    await expect(caption(page)).toHaveText(CAPTION.backedUp);
    await expect(btn(page, "slot")).toHaveAttribute("aria-pressed", "true");
    await btn(page, "power").focus();
    await page.keyboard.press("Space");
    await expect(caption(page)).toHaveText(CAPTION.unpowered);
    await btn(page, "paused").focus();
    await page.keyboard.press("Enter");
    await expect(caption(page)).toHaveText(CAPTION.paused);
    await expect(page.locator('[data-goal="order"]')).toHaveClass(/done/);
    await btn(page, "paused").press("Enter");
    await btn(page, "power").press("Enter");
    await btn(page, "slot").press("Enter");
    await btn(page, "recipe").focus();
    await page.keyboard.press("Enter");
    await expect(caption(page)).toHaveText(CAPTION.idle);
    await slider(page, "output").focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await expect(slider(page, "output")).toHaveValue("97");
    await page.locator(`${FIG} [data-reset]`).focus();
    await page.keyboard.press("Enter");
    await expect(caption(page)).toHaveText(CAPTION.producing);
  });

  test("under reduced motion the target state shows at once", tag, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    await btn(page, "power").click();
    await expect(page.locator(`${FIG} [data-rule].hit`)).toContainText("Unpowered");
    const dur = await page.locator(`${FIG} .level`).first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(dur)).toBe(0);
  });

  test("no line crosses a label, and nothing logs an error", tag, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    expect(await labelCollisions(page, FIG)).toEqual([]);
    await btn(page, "power").click();
    await slider(page, "output").fill("10");
    await page.waitForTimeout(500);
    expect(await labelCollisions(page, FIG)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
