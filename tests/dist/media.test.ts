import { readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
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

  it("ships the satis cover stills at their sizes", async () => {
    const card = await sharp(join(process.cwd(), "dist/covers/satisfactory-dash.png")).metadata();
    const og = await sharp(join(process.cwd(), "dist/og/satisfactory-dash.png")).metadata();
    expect([card.width, card.height, og.width, og.height]).toEqual([1600, 900, 1200, 630]);
  });

  it("ships the lanes cover stills at their sizes", async () => {
    const card = await sharp(join(process.cwd(), "dist/covers/lanes.png")).metadata();
    const og = await sharp(join(process.cwd(), "dist/og/lanes.png")).metadata();
    expect([card.width, card.height, og.width, og.height]).toEqual([1600, 900, 1200, 630]);
  });
});
