import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PAGES, pageTag } from "./pages";

for (const { name, path } of PAGES) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${name} has no serious or critical accessibility violations (${colorScheme})`, { tag: pageTag(name) }, async ({ page }) => {
      // Reduced motion so the fade-in is finished before axe measures contrast.
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
      await page.goto(path, { waitUntil: "networkidle" });
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }

  // Checks durations and delays, not opacity: on a fast machine a 500 ms fade can
  // finish before an opacity check runs. A zero-length animation with a delay still
  // makes content pop in late, so delays count as motion too.
  test(`${name} has no animation or transition time with reduced motion`, { tag: pageTag(name) }, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const moving = await page.evaluate(() => {
      const anyPositive = (list: string) => list.split(",").some((d) => parseFloat(d) > 0);
      return [...document.querySelectorAll("*")]
        .filter((el) => {
          const style = getComputedStyle(el);
          const animates =
            style.animationName !== "none" &&
            (anyPositive(style.animationDuration) || anyPositive(style.animationDelay));
          const transitions = style.transitionProperty !== "none" && anyPositive(style.transitionDuration);
          return animates || transitions;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
    });
    expect(moving).toEqual([]);
  });
}
