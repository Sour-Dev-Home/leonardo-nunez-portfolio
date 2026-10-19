import type { Page } from "@playwright/test";
import { labelCollisions as collisions } from "../src/design/checks/checks";
import { inPage } from "./in-page";

/** Every drawn line in the figure `root` selects, tested against every label (src/design/checks). */
export function labelCollisions(page: Page, root: string): Promise<string[]> {
  return inPage(page, root, collisions);
}
