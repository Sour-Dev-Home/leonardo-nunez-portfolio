import { expect, test } from "@playwright/test";
import { labelCollisions } from "./figures";
import { viewAt } from "../src/worlds/satis/model/cutover";

const OUT = 'figure[data-figure="outage"]';

test.describe("outage figure", () => {
  test("renders its full size before its script runs", async ({ page }) => {
    await page.route("**/_astro/*.js", (r) => r.abort());
    await page.goto("/kit");
    const box = await page.locator(OUT).boundingBox();
    expect(box!.height).toBeGreaterThan(200);
    await expect(page.locator(`${OUT} svg[data-layout]:visible [data-station="backend"]`)).toBeVisible();
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
    // The centre of the icon (34, 34 from the disc's corner), not the gap beside it where phones put the labels.
    await page.locator(`${OUT} svg[data-layout]:visible [data-station="backend"]`).click({ position: { x: 34, y: 34 } });
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

const CUT = 'figure[data-figure="cutover"]';

async function readyCutover(page: import("@playwright/test").Page) {
  await page.goto("/kit");
  await page.locator(CUT).scrollIntoViewIfNeeded();
  await expect(page.locator(`${CUT} button[data-next]`)).toHaveAttribute("data-ready", "");
}

test.describe("cutover figure", () => {
  test("steps to the switch: the route moves to AWS and the goal ticks", async ({ page }) => {
    await readyCutover(page);
    for (let i = 0; i < 5; i++) {
      await page.locator(`${CUT} button[data-next]`).click();
      await page.waitForTimeout(i === 1 || i === 2 ? 1700 : 400);
    }
    await page.waitForTimeout(1300);
    await expect(page.locator('[data-goal="switch"]')).toHaveClass(/done/);
    const offs = await page.evaluate(
      (sel) =>
        ["routePc", "routeAws"].map((name) => parseFloat(getComputedStyle(document.querySelector(`${sel} svg[data-layout]:not([hidden]) [data-path="${name}"]`)!).strokeDashoffset)),
      CUT,
    );
    expect(offs[1]).toBeCloseTo(0, 0);
    expect(offs[0]).toBeGreaterThan(10);
  });

  test("rolling back shows that step's rollback and restores the previous view", async ({ page }) => {
    await readyCutover(page);
    await page.locator(`${CUT} button[data-next]`).click();
    await expect(page.locator(`${CUT} .fig-rollback`)).toContainText("nothing has moved yet");
    await page.locator(`${CUT} button[data-prev]`).click();
    await expect(page.locator('[data-goal="back"]')).toHaveClass(/done/);
    await expect(page.locator(`${CUT} svg[data-layout]:visible [data-station="pcBackend"]`)).toHaveClass(/live/);
  });

  test("ignores Next while the dump is still moving (Review Focus 3)", async ({ page }) => {
    test.skip(!!process.env.REDUCED, "the dump is instant under reduced motion");
    await readyCutover(page);
    await page.locator(`${CUT} button[data-next]`).click(); // freeze
    await page.locator(`${CUT} button[data-next]`).click(); // backup: the dump starts
    await page.locator(`${CUT} button[data-next]`).click(); // pressed mid-animation
    await page.waitForTimeout(1800);
    const v = viewAt(2);
    await expect(page.locator(`${CUT} svg[data-layout]:visible [data-station="b2"] [data-sub]`)).toHaveText(v.b2Note);
    await expect(page.locator(`${CUT} svg[data-layout]:visible [data-station="rds"] [data-sub]`)).toHaveText(v.rdsNote);
  });

  test("keyboard only: Next, Roll back (Review Focus 5)", async ({ page }) => {
    await readyCutover(page);
    await page.locator(`${CUT} button[data-next]`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`${CUT} .fig-track .stp`).first()).toHaveClass(/now/);
    await page.locator(`${CUT} button[data-prev]`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`${CUT} button[data-prev]`)).toBeDisabled();
  });

  test("no line crosses a label at any step or mid-switch", async ({ page, viewport }) => {
    test.skip(viewport!.width < 640, "phones: covered step by step in 'the cutover on a phone'");
    await readyCutover(page);
    expect(await labelCollisions(page, CUT)).toEqual([]);
    for (let i = 1; i <= 5; i++) {
      await page.locator(`${CUT} button[data-next]`).click();
      if (i === 5) {
        for (const ms of [250, 300, 300]) {
          await page.waitForTimeout(ms);
          expect(await labelCollisions(page, CUT)).toEqual([]);
        }
      }
      await page.waitForTimeout(i === 2 || i === 3 ? 1700 : 1200);
      expect(await labelCollisions(page, CUT)).toEqual([]);
    }
  });

  test("has no step numbers in its track (cutover)", async ({ page }) => {
    await page.goto("/kit");
    expect(await page.locator(`${CUT} .fig-track`).innerText()).not.toMatch(/\d/);
  });
});

test.describe("figures on phones", () => {
  test("use their vertical composition below 40rem, with readable labels and no collisions", async ({ page, viewport }) => {
    test.skip(viewport!.width > 640, "phones only");
    await page.goto("/kit");
    for (const sel of [OUT, CUT]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      await expect(page.locator(`${sel} svg[data-layout="phone"]`)).toBeVisible();
      await expect(page.locator(`${sel} svg[data-layout="desktop"]`)).toBeHidden();
      const smallest = await page
        .locator(`${sel} svg[data-layout="phone"] text`)
        .evaluateAll((ts) => Math.min(...ts.filter((t) => t.textContent).map((t) => t.getBoundingClientRect().height)));
      expect(smallest).toBeGreaterThanOrEqual(9); // rendered px: not a shrunken desktop drawing
      expect(await labelCollisions(page, sel)).toEqual([]);
    }
  });

  test("every control fits inside its figure (nothing clipped by the figure's edge)", async ({ page }) => {
    await page.goto("/kit");
    for (const sel of [OUT, CUT]) {
      const clipped = await page.locator(sel).evaluate((fig) => {
        const f = fig.getBoundingClientRect();
        return [...fig.querySelectorAll(".fig-bar button, .fig-bar input, .fig-track .stp")]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.left < f.left - 0.5 || r.right > f.right + 0.5; })
          .map((el) => el.textContent?.trim() || el.getAttribute("aria-label"));
      });
      expect(clipped, sel).toEqual([]);
    }
  });

  test("the cutover on a phone: no line crosses a label at any step", async ({ page, viewport }) => {
    test.skip(viewport!.width > 640, "phones only");
    await readyCutover(page);
    for (let i = 1; i <= 5; i++) {
      await page.locator(`${CUT} button[data-next]`).click();
      await page.waitForTimeout(i === 2 || i === 3 ? 1700 : 1300);
      expect(await labelCollisions(page, CUT)).toEqual([]);
    }
  });

  test("resizing across the breakpoint remounts once, without leftovers (Review Focus 4)", async ({ page, viewport }) => {
    test.skip(viewport!.width !== 1280, "one run is enough");
    await page.goto("/kit");
    await page.locator(OUT).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(1500);
    expect(await page.locator(`${OUT} svg[data-layout="phone"] [data-dots] *`).count()).toBe(0);
    expect(await page.locator(`${OUT} svg[data-layout="desktop"] [data-dots] circle`).count()).toBeLessThanOrEqual(13);
    await page.locator(`${OUT} button[data-toggle="backend"]`).click();
    await expect(page.locator(`${OUT} button[data-toggle="backend"]`)).toHaveAttribute("aria-pressed", "true"); // one toggle, not two that cancel out
  });
});
