import type { Page } from "@playwright/test";
import { labelCollisions as collisions } from "../src/design/checks/checks";
import { inPage } from "./in-page";

/** Every drawn line in the figure `root` selects, tested against every label (src/design/checks). A figure with no
 *  visible drawing fails: the shared check returns no hits there, which would read as a pass. */
export async function labelCollisions(page: Page, root: string): Promise<string[]> {
  const shown = await page.locator(`${root} svg[data-layout]`).evaluateAll((svgs) => svgs.some((s) => s.getBoundingClientRect().width > 0));
  if (!shown) throw new Error(`${root} has no visible drawing to check`);
  return inPage(page, root, collisions);
}
