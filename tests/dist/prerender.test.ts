import { describe, it, expect } from "vitest";
import { builtPages, page } from "./helpers";
import { RUNNABLE_SCRIPTS, SCRIPTED_PAGES } from "./budget";

// Chrome's speculation rules: hovering a link to another page of this site
// prerenders it, so the click swaps pages almost instantly. Browsers without
// support ignore the block. It is JSON, not code, so pages still run no JavaScript.
describe("prerendering", () => {
  for (const file of builtPages()) {
    it(`${file} prerenders same-site links on hover and runs no JavaScript unless it has a budget`, () => {
      const doc = page(file);
      const blocks = doc.querySelectorAll('script[type="speculationrules"]');
      expect(blocks).toHaveLength(1);
      const rules = JSON.parse(blocks[0].text);
      expect(rules).toEqual({
        prerender: [
          {
            where: { and: [{ href_matches: "/*" }, { not: { selector_matches: "[target=_blank], [download]" } }] },
            eagerness: "moderate",
          },
        ],
      });
      if (!SCRIPTED_PAGES.includes(file)) expect(doc.querySelectorAll(RUNNABLE_SCRIPTS)).toHaveLength(0);
    });
  }
});
