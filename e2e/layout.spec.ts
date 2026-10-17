import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

for (const { name, path, status } of PAGES) {
  test(`${name} loads with status ${status}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
  });

  test(`${name} has no horizontal page scroll`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
