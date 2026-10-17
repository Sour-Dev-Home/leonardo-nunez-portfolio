import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { page } from "./helpers";

describe("media reserves its space before it loads", () => {
  const pages = readdirSync(join(process.cwd(), "dist"), { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\\/g, "/"));

  it("gives every img and video a width and height", () => {
    const missing = pages.flatMap((file) =>
      page(file)
        .querySelectorAll("img, video")
        .filter((el) => !el.getAttribute("width") || !el.getAttribute("height"))
        .map((el) => `${file}: <${el.tagName.toLowerCase()} ${el.getAttribute("src") ?? el.getAttribute("poster")}>`),
    );
    expect(missing).toEqual([]);
  });
});
