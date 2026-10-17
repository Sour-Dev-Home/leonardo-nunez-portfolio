import { describe, it, expect } from "vitest";
import { distFileExists } from "./helpers";

describe("shared assets", () => {
  it("includes the default link-preview image every page without its own falls back to", () => {
    expect(distFileExists("og/default.png")).toBe(true);
  });
});
