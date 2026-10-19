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

  // The buttons do nothing until site-view.ts mounts the figure, so they aren't offered before then.
  test("shows its controls once mounted", async ({ page }) => {
    const fig = await open(page);
    await expect(fig).toHaveAttribute("data-mounted", "");
    await expect(fig.locator(".fig-bar")).toBeVisible();
    await expect(fig.locator(".sf-pick")).toBeVisible();
  });
});

test.describe("where it breaks: without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("offers no controls that would do nothing, at the same size", async ({ page }) => {
    await page.goto(URL);
    const fig = page.locator(FIG);
    await expect(fig).not.toHaveAttribute("data-mounted", "");
    await expect(fig.locator(".fig-bar")).toBeHidden();
    await expect(fig.locator(".sf-pick")).toBeHidden();
    // Hidden, not removed: the figure keeps the size it has once mounted.
    expect(await fig.locator(".fig-bar").evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(0);
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

// The drawing must read as the satis cutover figure it stands for, with that figure's areas and station icons
// (owner, 2026-10-19: a bare line through "CLOUDFLARE" looked odd, then too bare).
test("each frame's drawing is a small satis cutover: its areas and station icons", async ({ page }) => {
  await open(page);
  const drawings = await page.locator(`${FIG} .sf`).evaluateAll((frames) =>
    frames.map((f) => {
      const shown = [...f.querySelectorAll<SVGSVGElement>("svg.m-svg")].find((s) => s.getBoundingClientRect().width > 0)!;
      return { texts: [...shown.querySelectorAll("text")].map((t) => t.textContent), stations: shown.querySelectorAll(".st").length };
    }),
  );
  for (const d of drawings) {
    expect(d.texts).toEqual(expect.arrayContaining(["GAMING PC", "CLOUDFLARE", "AWS", "Tunnel", "Backend"]));
    expect(d.stations).toBe(3);
  }
});

// Owner review (2026-10-19): on phones the tunnel's sub-label ran across into the AWS area and its disc sat off to
// the right. Every label and station must sit inside one area, at every width, whatever the bug.
test("keeps every label and station inside its area, at every width", async ({ page }) => {
  const fig = await open(page);
  for (const state of [null, "fonts"]) {
    if (state) await fig.locator(`[data-bug="${state}"]`).click();
    const outside = await page.locator(`${FIG} .sf`).evaluateAll((frames) =>
      frames.flatMap((f) => {
        const svg = [...f.querySelectorAll<SVGSVGElement>("svg.m-svg")].find((s) => s.getBoundingClientRect().width > 0)!;
        const areas = [...svg.querySelectorAll(".zbg")].map((a) => a.getBoundingClientRect());
        const marks = [...svg.querySelectorAll<SVGGraphicsElement>(".st text, .st .halo")].filter((m) => m.textContent !== "" || m.tagName !== "text");
        return marks
          .filter((m) => {
            const r = m.getBoundingClientRect();
            return !areas.some((a) => r.left >= a.left - 0.5 && r.right <= a.right + 0.5 && r.top >= a.top - 0.5 && r.bottom <= a.bottom + 0.5);
          })
          .map((m) => `${(f as HTMLElement).dataset.w}: ${m.tagName === "text" ? m.textContent : "station disc"}`)
          .concat(
            // Each station sits centred across its area, not pushed to one side.
            [...svg.querySelectorAll(".st .halo")].flatMap((h) => {
              const r = h.getBoundingClientRect();
              const cx = (r.left + r.right) / 2;
              const cy = (r.top + r.bottom) / 2;
              const area = areas.find((a) => cx > a.left && cx < a.right && cy > a.top && cy < a.bottom)!;
              return Math.abs(cx - (area.left + area.right) / 2) > 1 ? [`${(f as HTMLElement).dataset.w}: station off-centre`] : [];
            }),
          );
      }),
    );
    expect(outside, state ?? "no bug").toEqual([]);
  }
});

test.describe("where it breaks: the bugs", () => {
  test("every frame passes before a bug is injected", async ({ page }) => {
    await open(page);
    expect(await results(page)).toEqual(expected([]));
  });

  test("Fix it does nothing before a bug is picked", async ({ page }) => {
    const fig = await open(page);
    const fix = fig.locator("[data-fix]");
    const caption = await fig.locator(".fig-caption").textContent();
    await expect(fix).toHaveAttribute("aria-disabled", "true");
    // Playwright won't click an aria-disabled button by itself; a reader still can.
    await fix.click({ force: true });
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    expect(await results(page)).toEqual(expected([]));
    await expect(fig.locator(".fig-caption")).toHaveText(caption!);
    await expect(fig).not.toHaveAttribute("data-fixed", "");
    await expect(fix).toBeFocused();
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

// One frame at a time at every screen size (owner, 2026-10-19: four frames side by side were too small on a PC to
// see the fix).
test.describe("where it breaks: one frame at a time", () => {
  test("picking a bug shows the first width it fails at", async ({ page }) => {
    const fig = await open(page);
    for (const c of CASES) {
      await fig.locator(`[data-bug="${c.id}"]`).click();
      await expect(fig).toHaveAttribute("data-show", String(c.failsAt[0]));
      await expect(fig.locator(`[data-pick="${c.failsAt[0]}"]`)).toHaveAttribute("aria-pressed", "true");
      await fig.locator(`[data-bug="${c.id}"]`).click();
    }
  });

  // A selected tab isn't a failing one: the dot shows the width's result, not the selection.
  test("a selected width tab shows its result, not red for being selected", async ({ page }) => {
    const fig = await open(page);
    const dot = (w: number) => fig.locator(`[data-pick="${w}"]`).evaluate((b) => getComputedStyle(b, "::before").backgroundColor);
    await fig.locator('[data-bug="fonts"]').click();
    const failing = await dot(768);
    expect(failing).not.toBe(await dot(360));
    await fig.locator("[data-fix]").click();
    expect(await dot(768)).toBe(await dot(360));
  });

  test("draws the shown page at least half size on a wide screen", async ({ page, viewport }) => {
    test.skip(viewport!.width <= 640, "a phone is narrower than half of 1280 px");
    const fig = await open(page);
    for (const w of [360, 390, 768, 1280]) {
      await fig.locator(`[data-pick="${w}"]`).click();
      expect(Number(await fig.locator(`.sf[data-w="${w}"] .m-page`).getAttribute("data-scale")), String(w)).toBeGreaterThanOrEqual(0.5);
    }
  });

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
