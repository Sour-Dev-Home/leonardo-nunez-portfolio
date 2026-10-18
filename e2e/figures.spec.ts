import { expect, test } from "@playwright/test";
import { labelCollisions } from "./figures";

const OUT = 'figure[data-figure="outage"]';

test.describe("outage figure", () => {
  test("renders its full size before its script runs", async ({ page }) => {
    await page.route("**/_astro/*.js", (r) => r.abort());
    await page.goto("/kit");
    const box = await page.locator(OUT).boundingBox();
    expect(box!.height).toBeGreaterThan(200);
    await expect(page.locator(`${OUT} [data-station="backend"]`).first()).toBeVisible();
  });

  test("taking the backend down sends errors back and ticks the goals", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    await page.locator(`${OUT} button[data-toggle="backend"]`).click();
    await expect(page.locator(`${OUT} button[data-toggle="backend"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-goal="wait"]')).toHaveClass(/done/, { timeout: 15_000 });
    await expect(page.locator(`${OUT} .fig-caption`)).toContainText("Cloudflare answers with an error");
  });

  test("works from the keyboard alone (Review Focus 5)", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    await expect(page.locator(`${OUT} button[data-playpause]`)).toHaveAttribute("data-ready", "");
    await page.locator(`${OUT} button[data-toggle="db"]`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`${OUT} button[data-toggle="db"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-goal="db"] [data-done]')).toHaveText(" (done)", { timeout: 10_000 });
    await page.locator(`${OUT} button[data-playpause]`).focus();
    await page.keyboard.press("Space");
    await expect(page.locator(`${OUT} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
  });

  test("opens paused under reduced motion, and its controls still work", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    await expect(page.locator(`${OUT} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
    const dots = page.locator(`${OUT} svg[data-layout]:visible [data-dots] circle`);
    const before = await dots.count();
    expect(before).toBeGreaterThan(0); // a meaningful paused frame, not an empty one
    await page.waitForTimeout(1500);
    expect(await dots.count()).toBe(before);
    await page.locator(`${OUT} button[data-toggle="backend"]`).click();
    await expect(page.locator(`${OUT} button[data-toggle="backend"]`)).toHaveAttribute("aria-pressed", "true");
  });

  test("a click on the backend station takes it down too (a pointer shortcut)", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    await expect(page.locator(`${OUT} button[data-playpause]`)).toHaveAttribute("data-ready", "");
    await page.locator(`${OUT} svg[data-layout]:visible [data-station="backend"]`).click();
    await expect(page.locator(`${OUT} button[data-toggle="backend"]`)).toHaveAttribute("aria-pressed", "true");
  });

  test("a single-column section's heading doesn't pin itself over the figure while scrolling", async ({ page }) => {
    await page.goto("/kit");
    const goals = page.locator(".fig-goals").first();
    await goals.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120));
    const [h, g] = await Promise.all([page.locator("h2", { hasText: "Figures" }).boundingBox(), goals.boundingBox()]);
    const overlap = h && g && h.y < g.y + g.height && g.y < h.y + h.height && h.x < g.x + g.width && g.x < h.x + h.width;
    expect(overlap).toBeFalsy();
  });

  test("no line crosses a label", async ({ page }) => {
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    expect(await labelCollisions(page, OUT)).toEqual([]);
    await page.locator(`${OUT} button[data-toggle="backend"]`).click();
    await page.waitForTimeout(800);
    expect(await labelCollisions(page, OUT)).toEqual([]);
  });
});
