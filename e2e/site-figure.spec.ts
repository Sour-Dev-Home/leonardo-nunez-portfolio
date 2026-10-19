import { expect, test, type Page } from "@playwright/test";

const URL = "/projects/leonardonunez-dev";
const FIG = 'figure[data-figure="site"]';

async function frameDrawings(page: Page) {
  return page.locator(`${FIG} .sf`).evaluateAll((frames) =>
    frames.map((f) => [Number((f as HTMLElement).dataset.w), [...f.querySelectorAll<SVGSVGElement>("svg.m-svg")].find((s) => s.getBoundingClientRect().width > 0)?.dataset.layout]),
  );
}

test.describe("where it breaks: the frames", () => {
  test.fixme("renders its full size before its script runs", async ({ page }) => {
    await page.goto(URL);
    const before = await page.locator(FIG).boundingBox();
    await page.locator(FIG).evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" }));
    await expect(page.locator(`${FIG} [data-fix]`)).toHaveAttribute("data-ready", "");
    const after = await page.locator(FIG).boundingBox();
    expect(after?.height).toBeCloseTo(before!.height, 0);
  });

  test("lays each frame out at its own width, not the window's", async ({ page }) => {
    await page.goto(URL);
    expect(await frameDrawings(page)).toEqual([
      [360, "phone"],
      [390, "phone"],
      [768, "tablet"],
      [1280, "desktop"],
    ]);
  });
});
