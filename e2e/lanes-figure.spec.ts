import { expect, test, type Page } from "@playwright/test";
import { labelCollisions } from "./figures";
import { NO_SWITCHES, reviewersFor } from "../src/worlds/lanes/model/path";

const FIG = 'figure[data-figure="lanes"]';

async function ready(page: Page, speed = "3") {
  await page.goto("/kit");
  await page.locator(FIG).scrollIntoViewIfNeeded();
  await expect(page.locator(`${FIG} button[data-act]`)).toHaveAttribute("data-ready", "");
  await page.locator(`${FIG} input[data-speed]`).fill(speed);
}
const caption = (page: Page) => page.locator(`${FIG} .fig-caption`);
const act = (page: Page) => page.locator(`${FIG} button[data-act]`);

test.describe("lanes figure", () => {
  test("a clean lane reaches main and ticks its goal", async ({ page }) => {
    await ready(page);
    await expect(caption(page)).toHaveText("Merged to main.", { timeout: 30_000 });
    await expect(page.locator('[data-goal="merged"]')).toHaveClass(/done/);
  });

  test("a sloppy form stops at the contract check until completed", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await expect(act(page)).toHaveAttribute("aria-disabled", "false");
    await expect(act(page)).toHaveText("Complete the form");
    await act(page).click();
    await expect(page.locator('[data-goal="form"]')).toHaveClass(/done/);
  });

  test("a bug fails test-hunter, and the fix waits for fresh verdicts", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="bug"]`).click();
    await expect(caption(page)).toContainText("review/test-hunter is failure", { timeout: 20_000 });
    await act(page).click();
    await expect(caption(page)).toContainText("A verdict covers only the commit it names", { timeout: 10_000 });
    await expect(page.locator('[data-goal="bug"]')).toHaveClass(/done/);
  });

  test("touching the rules waits for the owner at the gate", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="rules"]`).click();
    await expect(caption(page)).toHaveText("lanes/gate: waiting for a code-owner review in GitHub (owner-only path).", { timeout: 25_000 });
    await act(page).click();
    await expect(caption(page)).toHaveText("lanes/gate: approved by code owner @SourE-dev.", { timeout: 5_000 });
    await expect(page.locator('[data-goal="rules"]')).toHaveClass(/done/);
  });

  test("a race makes the queue decide again", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="raced"]`).click();
    await expect(caption(page)).toContainText("decides again", { timeout: 30_000 });
    await expect(page.locator('[data-goal="race"]')).toHaveClass(/done/, { timeout: 10_000 });
  });

  test("a switch mid-run restarts the lane (Review Focus 1)", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} button[data-switch="bug"]`).click();
    await expect(caption(page)).toContainText("review/test-hunter is failure", { timeout: 20_000 });
    await page.locator(`${FIG} button[data-switch="bug"]`).click(); // off again, mid-run
    await expect(caption(page)).toContainText("A task issue");
    await expect(act(page)).toHaveAttribute("aria-disabled", "true");
    expect(await page.locator(`${FIG} svg[data-layout]:visible .lanes-token`).count()).toBe(1);
    await expect(page.locator('[data-goal="bug"]')).not.toHaveClass(/done/);
  });

  test("the action button ignores presses with nothing waiting (Review Focus 2)", async ({ page }) => {
    await ready(page, "0.4");
    await act(page).click({ force: true });
    await expect(caption(page)).toContainText("A task issue");
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await act(page).dblclick();
    await expect(caption(page)).toContainText("Task contract complete"); // one stop on, not two
  });

  test("keyboard only: Tab reaches the switches and the action, and focus stays put (Review Focus 3)", async ({ page }) => {
    await ready(page);
    await page.locator(`${FIG} .fig-bar button`).first().focus();
    for (let i = 0; i < 10 && !(await page.evaluate(() => document.activeElement?.getAttribute("data-switch") === "sloppy")); i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator(`${FIG} button[data-switch="sloppy"]`)).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 10 && !(await page.evaluate(() => document.activeElement?.hasAttribute("data-act"))); i++) await page.keyboard.press("Tab");
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect(act(page)).toBeFocused();
    await expect(act(page)).toHaveAttribute("aria-disabled", "true");
  });

  // Owner's reviews: the token travels behind the icons (it never covers one), yet stays in sight at a stop,
  // resting on the track just short of the station's disc.
  test("passes behind the icons, and waits beside a station in sight without covering it", async ({ page }) => {
    await ready(page);
    const drawnFirst = await page.locator(`${FIG} svg[data-layout]:visible`).evaluate((svg) => {
      const dots = svg.querySelector("[data-dots]")!;
      const station = svg.querySelector(".lst")!;
      return Boolean(dots.compareDocumentPosition(station) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(drawnFirst).toBe(true);
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(caption(page)).toContainText("Task contract incomplete", { timeout: 15_000 });
    const at = await page.locator(`${FIG} svg[data-layout]:visible .lanes-token`).evaluate((tok) => {
      // Centre it first (instantly: the site scrolls smoothly), or the sticky site header may be what's on top.
      tok.scrollIntoView({ block: "center", behavior: "instant" });
      const r = tok.getBoundingClientRect();
      const halo = tok.closest("svg")!.querySelector('[data-station="contract"] .halo')!.getBoundingClientRect();
      const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
      const gap = Math.hypot(cx - (halo.left + halo.width / 2), cy - (halo.top + halo.height / 2)) - halo.width / 2 - r.width / 2;
      return { inSight: document.elementFromPoint(cx, cy) === tok, gap };
    });
    expect(at.inSight).toBe(true);
    expect(at.gap).toBeGreaterThanOrEqual(0); // clear of the disc, so it covers no part of the icon
  });

  // A screen reader hears a stop when the reader caused it or the lane is held there, not every autoplay pass stop.
  test("the caption is announced only after the reader acts or when the token waits or fails", async ({ page }) => {
    await ready(page);
    // Log every caption change with the aria-live it was made under, so the checks don't race the autoplay.
    await caption(page).evaluate((el) => {
      const log: [string, string | null][] = [];
      (window as unknown as { heard: typeof log }).heard = log;
      new MutationObserver(() => log.push([el.textContent ?? "", el.getAttribute("aria-live")])).observe(el, { childList: true, characterData: true, subtree: true });
    });
    const pp = page.locator(`${FIG} button[data-playpause]`);
    await expect(caption(page)).toContainText("Task contract complete", { timeout: 10_000 });
    await pp.click(); // pause
    await page.locator(`${FIG} button[data-switch="rules"]`).click(); // restarts the lane
    await expect(caption(page)).toContainText("A task issue");
    await pp.click(); // play
    await expect(caption(page)).toContainText("waiting for a code-owner review", { timeout: 25_000 });
    await act(page).click();
    await expect(caption(page)).toHaveText("Merged to main.", { timeout: 15_000 });
    const heard = await page.evaluate(() => (window as unknown as { heard: [string, string | null][] }).heard);
    const at = (start: string, from = 0) => heard.findIndex(([text], i) => i >= from && text.startsWith(start));
    const live = (start: string, from = 0) => heard[at(start, from)]?.[1];
    const restart = at("A task issue");
    expect(live("Task contract complete")).toBe("off"); // an autoplay pass stop
    expect(live("A task issue")).toBe("polite"); // the reader pressed a switch
    expect(live("Task contract complete", restart)).toBe("polite"); // the reader pressed Play
    expect(live("A fresh Claude session", restart)).toBe("off");
    expect(live("lanes/gate: waiting", restart)).toBe("polite"); // held for the reader
    expect(live("lanes/gate: approved", restart)).toBe("polite"); // the reader approved
    expect(live("The merge queue runs", restart)).toBe("off");
  });

  test("opens paused under reduced motion, on a meaningful frame", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/kit");
    await page.locator(FIG).scrollIntoViewIfNeeded();
    await expect(page.locator(`${FIG} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
    await expect(caption(page)).toContainText("A task issue");
    expect(await page.locator(`${FIG} svg[data-layout]:visible .lanes-token`).count()).toBe(1);
  });

  test("no line crosses a label at any stop", async ({ page }) => {
    await ready(page);
    for (const sw of ["rules", "bug"]) await page.locator(`${FIG} button[data-switch="${sw}"]`).click();
    for (let i = 0; i < 6; i++) {
      expect(await labelCollisions(page, FIG)).toEqual([]);
      await page.waitForTimeout(1500);
      if ((await act(page).getAttribute("aria-disabled")) === "false") await act(page).click();
    }
  });
});

test.describe("lanes figure on phones", () => {
  test("uses the vertical drawing below 40rem, readable and collision-free", async ({ page, viewport }) => {
    test.skip(viewport!.width > 640, "phones only");
    await ready(page);
    await expect(page.locator(`${FIG} svg[data-layout="phone"]`)).toBeVisible();
    await expect(page.locator(`${FIG} svg[data-layout="desktop"]`)).toBeHidden();
    const smallest = await page
      .locator(`${FIG} svg[data-layout="phone"] text`)
      .evaluateAll((ts) => Math.min(...ts.map((t) => t.getBoundingClientRect().height)));
    expect(smallest).toBeGreaterThanOrEqual(9);
    const fits = async () => {
      expect(await labelCollisions(page, FIG)).toEqual([]);
      const clipped = await page.locator(FIG).evaluate((fig) => {
        const f = fig.getBoundingClientRect();
        return [...fig.querySelectorAll(".fig-bar button, svg[data-layout='phone'] text")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.left < f.left - 0.5 || r.right > f.right + 0.5);
          })
          .map((el) => el.textContent?.trim());
      });
      expect(clipped).toEqual([]);
    };
    const sub = page.locator(`${FIG} svg[data-layout="phone"] [data-station="reviewers"] [data-sub]`);
    await expect(sub).toHaveText(reviewersFor(NO_SWITCHES).join(", "));
    await fits();
    // Touching the rules adds the security reviewer: the longest sub-label must still fit.
    await page.locator(`${FIG} button[data-switch="rules"]`).click();
    await expect(sub).toHaveText(reviewersFor({ ...NO_SWITCHES, rules: true }).join(", "));
    await fits();
  });

  test("resizing across the breakpoint remounts once (Review Focus 4)", async ({ page, viewport }) => {
    test.skip(viewport!.width !== 1280, "one run is enough");
    await ready(page);
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(800);
    expect(await page.locator(`${FIG} svg[data-layout="desktop"] .lanes-token`).count()).toBe(1);
    // A reader's pause survives the rotation, as on the satis figures.
    await page.locator(`${FIG} button[data-playpause]`).click();
    await expect(page.locator(`${FIG} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await expect(page.locator(`${FIG} button[data-playpause]`)).toHaveAttribute("aria-label", "Play");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(800);
    await page.locator(`${FIG} button[data-switch="sloppy"]`).click();
    await expect(page.locator(`${FIG} button[data-switch="sloppy"]`)).toHaveAttribute("aria-pressed", "true"); // one listener, not two
  });
});
