import { describe, it, expect } from "vitest";
import { builtCss } from "./helpers";

const css = builtCss();

describe("motion", () => {
  it("animates page-to-page with cross-document view transitions", () => {
    expect(css).toMatch(/@view-transition\s*{\s*navigation:\s*auto/);
  });

  it("turns page transitions off for reduced motion", () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*{\s*@view-transition\s*{\s*navigation:\s*none/);
  });

  it("defines the reveal animation", () => {
    expect(css).toMatch(/\.reveal\s*{[^}]*animation:\s*reveal/);
  });
});
