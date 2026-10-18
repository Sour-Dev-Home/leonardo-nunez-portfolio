import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" }); // anchor jumps are instant, not smooth-scrolled

const headerBottom = (page: Page) =>
  page.locator(".site-header").evaluate((el) => el.getBoundingClientRect().bottom);
const top = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => el.getBoundingClientRect().top);

test("the header stays on screen while the page scrolls", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await page.locator(".site-header").boundingBox();
  expect(box?.y).toBe(0);
  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
});

for (const [label, heading] of [
  ["Work", "#work h2"],
  ["Contact", "#contact h2"],
] as const) {
  test(`the ${label} link lands with its heading below the header`, async ({ page }) => {
    await page.goto("/about"); // from another page, so the jump is a full navigation
    await page.locator(".site-nav").getByRole("link", { name: label }).click();
    await expect(page.locator(heading)).toBeInViewport();
    expect(await top(page, heading)).toBeGreaterThanOrEqual(await headerBottom(page));
  });
}

test("a sticky section heading never slides under the header", async ({ page, viewport }) => {
  test.skip(viewport!.width < 1024, "section headings are sticky only from 64rem");
  await page.goto("/");
  await page.locator("#work .work-card").last().scrollIntoViewIfNeeded();
  expect(await top(page, "#work h2")).toBeGreaterThanOrEqual(await headerBottom(page));
});
