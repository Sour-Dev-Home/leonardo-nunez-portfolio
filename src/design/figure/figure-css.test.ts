import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const css = readFileSync("src/design/figure/figure.css", "utf8");

describe("figure.css", () => {
  // Stations are a pointer shortcut and never take focus; the labelled toggle buttons are the keyboard way.
  it("has no focus style for stations, which can't be focused", () => {
    expect(css).not.toMatch(/\[data-station\][^{,]*:focus/);
  });
});
