import { expect, test, type Page } from "@playwright/test";
import { CASES } from "../src/worlds/site/model/cases";

const URL = "/projects/leonardonunez-dev";
const FIG = 'figure[data-figure="site"]';

async function open(page: Page) {
  await page.goto(URL);
  const fig = page.locator(FIG);
  await fig.evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" }));
  await expect(fig.locator("[data-fix]")).toHaveAttribute("data-ready", "");
  return fig;
}

function results(page: Page) {
  return page.locator(`${FIG} .sf`).evaluateAll((els) => els.map((e) => [Number((e as HTMLElement).dataset.w), (e as HTMLElement).dataset.result]));
}

const expected = (fails: readonly number[]) => [360, 390, 768, 1280].map((w) => [w, fails.includes(w) ? "fail" : "pass"]);

async function frameDrawings(page: Page) {
  return page.locator(`${FIG} .sf`).evaluateAll((frames) =>
    frames.map((f) => [Number((f as HTMLElement).dataset.w), [...f.querySelectorAll<SVGSVGElement>("svg.m-svg")].find((s) => s.getBoundingClientRect().width > 0)?.dataset.layout]),
  );
}

test.describe("where it breaks: the frames", () => {
  test("renders its full size before its script runs", async ({ page }) => {
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

test.describe("where it breaks: the bugs", () => {
  test("every frame passes before a bug is injected", async ({ page }) => {
    await open(page);
    expect(await results(page)).toEqual(expected([]));
  });

  for (const c of CASES) {
    test(`${c.id}: fails at exactly ${c.failsAt.join(", ")} px, and passes after Fix it`, async ({ page }) => {
      const fig = await open(page);
      await fig.locator(`[data-bug="${c.id}"]`).click();
      expect(await results(page)).toEqual(expected(c.failsAt));
      await expect(fig.locator(".fig-caption")).toContainText(c.test.title);
      await expect(fig.locator("[data-fix]")).toHaveAttribute("aria-disabled", "false");
      await fig.locator("[data-fix]").click();
      expect(await results(page)).toEqual(expected([]));
      await expect(fig.locator(".fig-caption")).toContainText(c.fix);
      await expect(fig.locator("[data-fix]")).toHaveAttribute("aria-disabled", "true");
    });
  }

  test("switching bugs drops the fix and re-checks (Review Focus 1)", async ({ page }) => {
    const fig = await open(page);
    await fig.locator('[data-bug="hero"]').click();
    await fig.locator("[data-fix]").click();
    await fig.locator('[data-bug="line"]').click();
    expect(await results(page)).toEqual(expected([360]));
    await expect(fig).not.toHaveAttribute("data-fixed", "");
    await expect(fig.locator("[data-fix]")).toHaveAttribute("aria-disabled", "false");
    await expect(fig.locator('[data-bug="hero"]')).toHaveAttribute("aria-pressed", "false");
  });

  test("turning a bug off and on gives the same results (Review Focus 4)", async ({ page }) => {
    const fig = await open(page);
    for (let i = 0; i < 2; i++) {
      await fig.locator('[data-bug="media"]').click();
      expect(await results(page)).toEqual(expected([360, 390, 768, 1280]));
      await fig.locator('[data-bug="media"]').click();
      expect(await results(page)).toEqual(expected([]));
    }
    expect(await page.locator(`${FIG} .m-page:not(.loaded)`).count()).toBe(0);
  });

  test("Reset clears the bug", async ({ page }) => {
    const fig = await open(page);
    await fig.locator('[data-bug="fonts"]').click();
    await fig.locator("[data-reset]").click();
    expect(await results(page)).toEqual(expected([]));
    await expect(fig).not.toHaveAttribute("data-case", /.+/);
  });

  test("keyboard only: Tab reaches every bug and Fix it, and focus stays on Fix it (Review Focus 2)", async ({ page }) => {
    const fig = await open(page);
    await fig.locator('[data-bug="fonts"]').focus();
    await page.keyboard.press("Enter");
    for (let i = 0; i < CASES.length - 1; i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(fig.locator("[data-fix]")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(fig.locator("[data-fix]")).toBeFocused();
    expect(await results(page)).toEqual(expected([]));
  });

  test("announces once per press, never on its own", async ({ page }) => {
    const fig = await open(page);
    await fig.locator(".fig-caption").evaluate((el) => {
      (window as unknown as { changes: number }).changes = 0;
      new MutationObserver(() => (window as unknown as { changes: number }).changes++).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await fig.locator('[data-bug="fonts"]').click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { changes: number }).changes)).toBe(1);
  });

  test("works under reduced motion, with no transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fig = await open(page);
    await fig.locator('[data-bug="hero"]').click();
    expect(await results(page)).toEqual(expected([768, 1280]));
    expect(await fig.locator(".sf-view").first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  });
});

test.describe("where it breaks: on phones", () => {
  test.beforeEach(({ viewport }) => test.skip(viewport!.width > 640, "phone layout only"));

  test("shows one frame at a time, picked by width", async ({ page }) => {
    const fig = await open(page);
    const shown = () => page.locator(`${FIG} .sf`).evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity === "1").map((e) => Number((e as HTMLElement).dataset.w)));
    expect(await shown()).toEqual([360]);
    await fig.locator('[data-pick="768"]').click();
    expect(await shown()).toEqual([768]);
    await expect(fig.locator('[data-pick="768"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("the width picker shows each width's result", async ({ page }) => {
    const fig = await open(page);
    await fig.locator('[data-bug="hero"]').click();
    for (const [w, r] of expected([768, 1280])) await expect(fig.locator(`[data-pick="${w}"]`)).toHaveAttribute("data-result", r as string);
  });

  test("the shown frame fits the figure", async ({ page }) => {
    const fig = await open(page);
    for (const w of [360, 1280]) {
      await fig.locator(`[data-pick="${w}"]`).click();
      const f = await fig.locator(`.sf[data-w="${w}"]`).boundingBox();
      const box = await fig.boundingBox();
      expect(f!.x).toBeGreaterThanOrEqual(box!.x);
      expect(f!.x + f!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
    }
  });
});

test("resizing keeps the bug, its results and the caption (Review Focus 3)", async ({ page, viewport }) => {
  const fig = await open(page);
  await fig.locator('[data-bug="hero"]').click();
  const caption = await fig.locator(".fig-caption").textContent();
  await page.setViewportSize(viewport!.width > 640 ? { width: 390, height: 844 } : { width: 1280, height: 800 });
  await expect.poll(() => results(page)).toEqual(expected([768, 1280]));
  await expect(fig).toHaveAttribute("data-case", "hero");
  await expect(fig.locator(".fig-caption")).toHaveText(caption!);
});
