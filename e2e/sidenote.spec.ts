import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("on a wide screen the sidenote sits in the margin, beside its paragraph", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1280", "margin layout is desktop only");
  await page.goto("/kit");
  const note = page.locator(".sidenote-note").first();
  await expect(note).toBeVisible();
  const prose = await page.locator(".prose").first().boundingBox();
  const box = await note.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(prose!.x + prose!.width - 1);
  expect(box!.x - (prose!.x + prose!.width)).toBeLessThanOrEqual(48); // close to the text
});

test("on a phone the psst toggle works from the keyboard, with visible focus", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("phone"), "toggle is for narrow screens");
  await page.goto("/kit");
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.classList.contains("sidenote-checkbox"))) break;
  }
  expect(await page.evaluate(() => document.activeElement?.classList.contains("sidenote-checkbox"))).toBe(true);
  const outline = await page.locator(".sidenote-toggle").first().evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Space");
  await expect(page.locator(".sidenote-note").first()).toBeVisible();
});

test("the toggle's accessible name includes what it shows", async ({ page }, info) => {
  test.skip(info.project.name === "desktop-1280", "wide screens show the note in the margin, with no toggle");
  await page.goto("/kit");
  await expect(page.locator(".sidenote-checkbox").first()).toHaveAccessibleName(/psst/i);
});

test("on a phone the sidenote hides behind a psst toggle that opens it", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("phone"), "toggle is for narrow screens");
  await page.goto("/kit");
  const note = page.locator(".sidenote-note").first();
  await expect(note).toBeHidden();
  await page.getByText("psst", { exact: true }).first().click();
  await expect(note).toBeVisible();
});
