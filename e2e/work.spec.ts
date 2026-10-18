import { expect, test, type Page } from "@playwright/test";

const card = ".work-card:has(.work-card-link)";
const media = `${card} .work-card-media img`;
const filter = (page: Page) => page.locator(media).first().evaluate((el) => getComputedStyle(el).filter);
const arrow = (page: Page) =>
  page
    .locator(`${card} .work-card-link`)
    .first()
    .evaluate((el) => getComputedStyle(el, "::after").opacity);

test.use({ reducedMotion: "reduce" }); // no transition: the end state is immediate

test("a work card's cover is grayscale until hovered", async ({ page }) => {
  await page.goto("/");
  expect(await filter(page)).toBe("grayscale(1)");
  await page.locator(card).first().hover();
  expect(await filter(page)).toBe("none");
});

test("hovering a case-study card shows an arrow by its title", async ({ page }) => {
  await page.goto("/");
  expect(await arrow(page)).toBe("0");
  await page.locator(card).first().hover();
  expect(await arrow(page)).toBe("1");
});

test("keyboard focus colours the cover and outlines the whole card", async ({ page }) => {
  await page.goto("/");
  await page.locator(`${card} .work-card-link`).first().focus();
  expect(await filter(page)).toBe("none");
  const outline = await page.locator(card).first().evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});

test("clicking anywhere on a case-study card opens the case study", async ({ page }) => {
  await page.goto("/");
  // A real pointer click on the cover: the stretched link sits on top of it, and
  // that is exactly what should receive the click.
  const cover = page.locator(media).first();
  await cover.scrollIntoViewIfNeeded();
  const box = (await cover.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/projects\/satisfactory-dash$/);
});

test("the repo and demo links on a clickable card stay clickable", async ({ page }) => {
  await page.goto("/");
  const links = page.locator(`${card} .project-links a`);
  expect(await links.count()).toBeGreaterThan(0);
  for (const link of await links.all()) {
    const onTop = await link.evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.scrollIntoView({ block: "center" });
      const s = el.getBoundingClientRect();
      return document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2) === el && r.width > 0;
    });
    expect(onTop).toBe(true);
  }
});
