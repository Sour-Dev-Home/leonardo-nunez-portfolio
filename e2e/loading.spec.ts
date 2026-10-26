import { expect, test } from "@playwright/test";
import { holdMedia, mediaBoxes, overlaps, scrubAnimations } from "./loading";
import { PAGES, pageTag } from "./pages";

const pages = PAGES.filter((p) => p.status === 200);

for (const { name, path } of pages) {
  test(`${name}: media keeps its size and nothing moves while it loads`, { tag: pageTag(name) }, async ({ page }) => {
    const media = await holdMedia(page);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    // SVG <image> icons count too (figures draw game icons with them), once per file: the document fetches a file two
    // icons share only once, even with the cache off.
    const expected = await page.evaluate(
      () =>
        document.querySelectorAll("img[src], video[poster]").length +
        new Set([...document.querySelectorAll("svg image[href]")].map((el) => el.getAttribute("href"))).size,
    );
    await expect.poll(media.held).toBe(expected);
    const before = { boxes: await mediaBoxes(page), height: await page.evaluate(() => document.body.scrollHeight) };

    await media.release();
    await page.waitForLoadState("networkidle");
    const after = { boxes: await mediaBoxes(page), height: await page.evaluate(() => document.body.scrollHeight) };

    expect(after).toEqual(before);
  });

  test(`${name}: no content overlaps while media is still loading`, { tag: pageTag(name) }, async ({ page }) => {
    await holdMedia(page);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(await overlaps(page)).toEqual([]);
  });

  for (const progress of [0, 0.5, 1]) {
    test(`${name}: no content overlaps at ${progress * 100}% of every animation`, { tag: pageTag(name) }, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      // Every page fades its sections in; if nothing was frozen, the overlap
      // check below would be testing a finished page and prove nothing.
      expect(await scrubAnimations(page, progress)).toBeGreaterThan(0);
      expect(await overlaps(page)).toEqual([]);
    });
  }

  test(`${name}: navigating here from another page shows no overlaps mid-load`, { tag: pageTag(name) }, async ({ page }) => {
    await page.goto(path === "/" ? "/projects/satisfactory-dash" : "/", { waitUntil: "networkidle" });
    await holdMedia(page);
    await page.goto(path, { waitUntil: "commit" });
    await page.waitForLoadState("domcontentloaded");
    expect(await overlaps(page)).toEqual([]);
  });
}
