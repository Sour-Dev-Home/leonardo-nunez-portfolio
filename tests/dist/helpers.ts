import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type HTMLElement } from "node-html-parser";

export const SITE = "https://leonardo-nunez-portfolio.pages.dev";
const DIST = join(process.cwd(), "dist");

export function distFileExists(path: string): boolean {
  return existsSync(join(DIST, path));
}

export function page(file: string): HTMLElement {
  if (!distFileExists(file)) {
    throw new Error(`dist/${file} doesn't exist. Run npm run build first.`);
  }
  return parse(readFileSync(join(DIST, file), "utf-8"));
}

export function metaContent(doc: HTMLElement, selector: string): string | undefined {
  return doc.querySelector(selector)?.getAttribute("content");
}

export function hrefs(doc: HTMLElement): string[] {
  return doc.querySelectorAll("a[href]").map((a) => a.getAttribute("href") ?? "");
}
