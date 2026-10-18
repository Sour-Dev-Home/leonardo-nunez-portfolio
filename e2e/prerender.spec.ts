import { expect, test } from "@playwright/test";

// The speculation rules in Shell.astro: hovering a same-site link prerenders the
// page, so the click shows it at once. Chrome refuses to finish a prerender while
// automation is attached (status "PrerenderingDisabledByDevTools"), so a test can't
// see the instant swap itself. It checks the part this site controls instead: the
// rules parse, and a hover makes Chrome start prerendering exactly that page.
test("hovering a link makes Chrome prerender that page", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 768, "phones have no hover; one desktop-class run proves the rule");
  const cdp = await page.context().newCDPSession(page);
  const ruleErrors: string[] = [];
  const attempts: string[] = [];
  cdp.on("Preload.ruleSetUpdated", (e) => {
    if (e.ruleSet.errorType) ruleErrors.push(`${e.ruleSet.errorType}: ${e.ruleSet.errorMessage}`);
  });
  cdp.on("Preload.prerenderStatusUpdated", (e) => attempts.push(e.key.url));
  await cdp.send("Preload.enable");

  await page.goto("/", { waitUntil: "networkidle" });
  expect(attempts).toEqual([]); // nothing is prerendered until someone shows intent
  await page.locator(".site-nav").getByRole("link", { name: "About" }).hover();
  await expect.poll(() => attempts.map((url) => new URL(url).pathname)).toContain("/about");
  expect(ruleErrors).toEqual([]);
});

test("links that open elsewhere are never prerendered", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 768, "phones have no hover");
  const cdp = await page.context().newCDPSession(page);
  const attempts: string[] = [];
  cdp.on("Preload.prerenderStatusUpdated", (e) => attempts.push(e.key.url));
  await cdp.send("Preload.enable");

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Live demo" }).first().hover();
  await page.waitForTimeout(500); // longer than "moderate"'s ~200 ms hover delay
  expect(attempts).toEqual([]);
});
