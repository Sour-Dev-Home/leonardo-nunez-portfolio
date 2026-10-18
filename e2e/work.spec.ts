import { expect, test, type Page } from "@playwright/test";

const still = ".work-card:has(.work-card-still img) .work-card-still img";
const filter = (page: Page) => page.locator(still).first().evaluate((el) => getComputedStyle(el).filter);

test.use({ reducedMotion: "reduce" }); // no transition: the end state is immediate

test("a work card's still is grayscale until hovered", async ({ page }) => {
  await page.goto("/");
  expect(await filter(page)).toBe("grayscale(1)");
  await page.locator(".work-card:has(.work-card-still img)").first().hover();
  expect(await filter(page)).toBe("none");
});

test("keyboard focus colours it too", async ({ page }) => {
  await page.goto("/");
  await page.locator(".work-card:has(.work-card-still img) a").first().focus();
  expect(await filter(page)).toBe("none");
});
