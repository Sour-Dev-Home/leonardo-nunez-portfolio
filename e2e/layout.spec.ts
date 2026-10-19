import { expect, test } from "@playwright/test";
import { overflowX, titleGap } from "../src/design/checks/checks";
import { inPage } from "./in-page";
import { PAGES } from "./pages";

for (const { name, path, status } of PAGES) {
  test(`${name} loads with status ${status}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
  });

  test(`${name} has no horizontal page scroll`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await inPage(page, "html", overflowX);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`${name}: the page title starts at the left edge of the content`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    // Caught on /about and /kit: a grid meant for the home hero's portrait put the
    // kicker in one column and the h1 in the other.
    const gap = await inPage(page, "h1", titleGap);
    expect(Math.abs(gap)).toBeLessThan(1);
  });
}
