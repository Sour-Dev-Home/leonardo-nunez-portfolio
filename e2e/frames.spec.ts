import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { framesOf, type Capturable } from "../src/design/figure/storyboard";
import { outageStoryboard } from "../src/worlds/satis/figures/outage.storyboard";
import { machineStatesStoryboard } from "../src/worlds/satis/figures/machine-states.storyboard";

// Storyboard stills for review (.claude/skills/storyboard-motion). Not a regression test: it compares
// nothing and runs only when asked, e.g. PW_FRAMES=outage npx playwright test frames --project=desktop-1280.
// Stills go to .frames/<figure>/<project>/<motion|reduced>/, which git ignores. They are review material,
// never baselines (those come only from the "Update screenshots" workflow).
const BOARDS: Capturable[] = [outageStoryboard, machineStatesStoryboard];
const wanted = (process.env.PW_FRAMES ?? "").split(",").filter(Boolean);

test.skip(wanted.length === 0, "frame capture runs only when PW_FRAMES names a storyboard (or 'all')");

/** Opens the figure with the page's clock paused, so its loop advances only by `page.clock.runFor`. */
async function openPaused(page: Page, board: Capturable) {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto(board.page);
  const fig = page.locator(`figure[data-figure="${board.figure}"]`).first();
  await fig.scrollIntoViewIfNeeded();
  await fig.locator("[data-ready]").first().waitFor(); // a looped figure marks its play button; a still-state one marks its rule list
  return fig;
}

for (const board of BOARDS) {
  for (const mode of ["motion", "reduced"] as const) {
    test(`${board.figure} storyboard stills (${mode})`, async ({ page }, info) => {
      test.skip(!wanted.includes("all") && !wanted.includes(board.figure), `PW_FRAMES doesn't name ${board.figure}`);
      if (mode === "reduced") await page.emulateMedia({ reducedMotion: "reduce" });
      const fig = await openPaused(page, board);
      // Under reduced motion a figure opens paused: start it the way a reader would.
      const pp = fig.locator("[data-playpause]");
      if ((await pp.count()) && (await pp.getAttribute("aria-label")) === "Play") await pp.evaluate((b: HTMLButtonElement) => b.click());
      const dir = `.frames/${board.figure}/${info.project.name}/${mode}`;
      mkdirSync(dir, { recursive: true });
      const frames = framesOf(board).filter((f) => mode === "motion" || !f.name.includes("-mid"));
      const inputs = [...board.inputs].sort((a, b) => a.at - b.at);
      let now = 0; // sim seconds; the loop's speed stays 1, and 16 ms fake frames never hit MAX_DT
      const advance = async (to: number) => {
        if (to > now) await page.clock.runFor(Math.round((to - now) * 1000));
        now = Math.max(now, to);
      };
      for (const f of frames) {
        while (inputs.length && inputs[0].at <= f.at) {
          const input = inputs.shift()!;
          await advance(input.at);
          // A DOM click, not locator.click(): actionability checks would wait on frames the paused clock withholds.
          const target = fig.locator(input.click);
          if (input.value === undefined) await target.evaluate((el: HTMLElement) => el.click());
          else await target.evaluate((el: HTMLInputElement, v: number) => { el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); }, input.value);
        }
        await advance(f.at);
        // The sim's motion is JS on the page clock; CSS transitions run on real time, so they're finished.
        await fig.screenshot({ path: `${dir}/${f.name}.png`, animations: "disabled" });
      }
    });
  }
}
