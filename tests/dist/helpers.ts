import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type HTMLElement } from "node-html-parser";

export const SITE = "https://leonardonunez.dev";
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

/** Every file in the build, as slash-separated paths relative to dist/. */
export function builtFiles(): string[] {
  return readdirSync(DIST, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(DIST.length + 1).replace(/\\/g, "/"));
}

/** Every HTML page in the build, relative to dist/. */
export function builtPages(): string[] {
  return builtFiles().filter((f) => f.endsWith(".html"));
}

/** All CSS the build ships: stylesheet files plus <style> blocks inlined into pages. */
export function builtCss(): string {
  const astroDir = join(DIST, "_astro");
  const files = existsSync(astroDir)
    ? readdirSync(astroDir)
        .filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(join(astroDir, f), "utf-8"))
    : [];
  const inline = readdirSync(DIST, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".html"))
    .flatMap((f) => page(f.replace(/\\/g, "/")).querySelectorAll("style").map((s) => s.text));
  return [...files, ...inline].join("\n");
}
