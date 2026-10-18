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

  it("staggers a case study's opening blocks in", () => {
    expect(css).toMatch(/\.case-study-body\s*>\s*:nth-child\(-n\s*\+\s*6\)\s*{[^}]*animation:\s*reveal/);
    expect(css).toMatch(/\.case-study-body\s*>\s*:nth-child\(6\)\s*{[^}]*--reveal-index:\s*6/);
  });
});

describe("prose", () => {
  it("contains its floats (margin sidenotes never poke out below the text)", () => {
    expect(css).toMatch(/\.prose\s*{[^}]*display:\s*flow-root/);
  });
});
