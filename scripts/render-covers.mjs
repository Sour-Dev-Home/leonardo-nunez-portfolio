// Renders each world's cover stills from its still on /kit (#<world>-cover-still): the work card's picture and
// the link-preview image. Run after `npm run build`, with `npm run preview` serving dist/.
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://127.0.0.1:4321";
const covers = [
  { id: "satis-cover-still", name: "satisfactory-dash" },
  { id: "lanes-cover-still", name: "lanes" },
  { id: "site-cover-still", name: "leonardonunez-dev" },
];
// [still, output, CSS width, CSS height, device scale] → 1600 × 900 and 1200 × 630.
const shots = covers.flatMap(({ id, name }) => [
  [id, `public/covers/${name}.png`, 800, 450, 2],
  [id, `public/og/${name}.png`, 800, 420, 1.5],
]);

const browser = await chromium.launch();
for (const [id, out, w, h, scale] of shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: scale, reducedMotion: "reduce" });
  await page.goto(`${base}/kit`, { waitUntil: "networkidle" });
  const el = page.locator(`#${id}`);
  await el.evaluate((n, [ww, hh]) => {
    n.style.width = `${ww}px`;
    n.style.height = `${hh}px`;
  }, [w, h]);
  // Clip to whole pixels: the element's box can sit on a fractional offset, which adds a row.
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  await page.screenshot({ path: out, animations: "disabled", clip: { x: Math.round(box.x), y: Math.round(box.y), width: w, height: h } });
  await page.close();
}
await browser.close();
