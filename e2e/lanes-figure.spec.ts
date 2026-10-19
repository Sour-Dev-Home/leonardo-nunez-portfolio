import { expect, test, type Page } from "@playwright/test";
import { labelCollisions } from "./figures";

const FIG = 'figure[data-figure="lanes"]';

async function ready(page: Page, speed = "3") {
  await page.goto("/kit");
  await page.locator(FIG).scrollIntoViewIfNeeded();
  await expect(page.locator(`${FIG} button[data-act]`)).toHaveAttribute("data-ready", "");
  await page.locator(`${FIG} input[data-speed]`).fill(speed);
}
const caption = (page: Page) => page.locator(`${FIG} .fig-caption`);
const act = (page: Page) => page.locator(`${FIG} button[data-act]`);

test.describe("lanes figure", () => {
  test("a clean lane reaches main and ticks its goal", async ({ page }) => {
    await ready(page);
    await expect(caption(page)).toHaveText("Merged to main.", { timeout: 30_000 });
    await expect(page.locator('[data-goal="merged"]')).toHaveClass(/done/);
  });

  test("a sloppy form stops at the contract check until completed", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await expect(act(page)).toHaveAttribute("aria-disabled", "false");
    await expect(act(page)).toHaveText("Complete the form");
    await act(page).click();
    await expect(page.locator('[data-goal="form"]')).toHaveClass(/done/);
  });

  test("a bug fails test-hunter, and the fix waits for fresh verdicts", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="bug"]`).click();
    await expect(caption(page)).toContainText("review/test-hunter is failure", { timeout: 20_000 });
    await act(page).click();
    await expect(caption(page)).toContainText("A verdict covers only the commit it names", { timeout: 10_000 });
    await expect(page.locator('[data-goal="bug"]')).toHaveClass(/done/);
  });

  test("touching the rules waits for the owner at the gate", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="rules"]`).click();
    await expect(caption(page)).toHaveText("lanes/gate: waiting for a code-owner review in GitHub (owner-only path).", { timeout: 25_000 });
    await act(page).click();
    await expect(caption(page)).toHaveText("lanes/gate: approved by code owner @SourE-dev.", { timeout: 5_000 });
    await expect(page.locator('[data-goal="rules"]')).toHaveClass(/done/);
  });

  test("a race makes the queue decide again", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="raced"]`).click();
    await expect(caption(page)).toContainText("decides again", { timeout: 30_000 });
    await expect(page.locator('[data-goal="race"]')).toHaveClass(/done/, { timeout: 10_000 });
  });

  test("a switch mid-run restarts the lane (Review Focus 1)", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="bug"]`).click();
    await expect(caption(page)).toContainText("review/test-hunter is failure", { timeout: 20_000 });
    await page.locator(`${FIG} button[data-switch="bug"]`).click(); // off again, mid-run
    await expect(caption(page)).toContainText("A task issue");
    await expect(act(page)).toHaveAttribute("aria-disabled", "true");
    expect(await page.locator(`${FIG} svg[data-layout]:visible .lanes-token`).count()).toBe(1);
    await expect(page.locator('[data-goal="bug"]')).not.toHaveClass(/done/);
  });

  test("the action button ignores presses with nothing waiting (Review Focus 2)", async ({ page }) => {
    await ready(page, "0.4");
    await act(page).click({ force: true });
    await expect(caption(page)).toContainText("A task issue");
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await act(page).dblclick();
    await expect(caption(page)).toContainText("Task contract complete"); // one stop on, not two
  });

  test("keyboard only: Tab reaches the switches and the action, and focus stays put (Review Focus 3)", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} .fig-bar button`).first().focus();
    for (let i = 0; i < 10 && !(await page.evaluate(() => document.activeElement?.getAttribute("data-switch") === "sloppy")); i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator(`${FIG} button[data-switch="sloppy"]`)).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 10 && !(await page.evaluate(() => document.activeElement?.hasAttribute("data-act"))); i++) await page.keyboard.press("Tab");
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect(act(page)).toBeFocused();
    await expect(act(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("keeps the token visible on top while it waits at a station (owner's review)", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    const onTop = await page.locator(`${FIG} svg[data-layout]:visible .lanes-token`).evaluate((tok) => {
      // Centre it first: at the top of the viewport the sticky site header would be what's on top.
      tok.scrollIntoView({ block: "center" });
      const r = tok.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === tok;
    });
    expect(onTop).toBe(true);
  });

  test("opens paused under reduced motion, on a meaningful frame", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/kit");
    await page.locator(FIG).scrollIntoViewIfNeeded();
    await expect(page.locator(`${FIG} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
    await expect(caption(page)).toContainText("A task issue");
    expect(await page.locator(`${FIG} svg[data-layout]:visible .lanes-token`).count()).toBe(1);
  });

  test("no line crosses a label at any stop", async ({ page }) => {
    await ready(page);
    for (const sw of ["rules", "bug"]) await page.locator(`${FIG} button[data-switch="${sw}"]`).click();
    for (let i = 0; i < 6; i++) {
      expect(await labelCollisions(page, FIG)).toEqual([]);
      await page.waitForTimeout(1500);
      if ((await act(page).getAttribute("aria-disabled")) === "false") await act(page).click();
    }
  });
});

test.describe("lanes figure on phones", () => {
  test("uses the vertical drawing below 40rem, readable and collision-free", async ({ page, viewport }) => {
    test.skip(viewport!.width > 640, "phones only");
    await page.goto("/kit");
    await page.locator(FIG).scrollIntoViewIfNeeded();
    await expect(page.locator(`${FIG} svg[data-layout="phone"]`)).toBeVisible();
    await expect(page.locator(`${FIG} svg[data-layout="desktop"]`)).toBeHidden();
    const smallest = await page
      .locator(`${FIG} svg[data-layout="phone"] text`)
      .evaluateAll((ts) => Math.min(...ts.map((t) => t.getBoundingClientRect().height)));
    expect(smallest).toBeGreaterThanOrEqual(9);
    expect(await labelCollisions(page, FIG)).toEqual([]);
    const clipped = await page.locator(FIG).evaluate((fig) => {
      const f = fig.getBoundingClientRect();
      return [...fig.querySelectorAll(".fig-bar button, svg[data-layout='phone'] text")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < f.left - 0.5 || r.right > f.right + 0.5);
        })
        .map((el) => el.textContent?.trim());
    });
    expect(clipped).toEqual([]);
  });

  test("resizing across the breakpoint remounts once (Review Focus 4)", async ({ page, viewport }) => {
    test.skip(viewport!.width !== 1280, "one run is enough");
    await ready(page);
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(800);
    expect(await page.locator(`${FIG} svg[data-layout="desktop"] .lanes-token`).count()).toBe(1);
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(page.locator(`${FIG} button[data-switch="sloppy"]`)).toHaveAttribute("aria-pressed", "true"); // one listener, not two
  });
});
