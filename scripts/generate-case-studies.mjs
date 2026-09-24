import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { markdownToHtml } from "./markdownToHtml.mjs";

const SRC_DIR = join(process.cwd(), "src/content/case-studies");
const OUT_DIR = join(SRC_DIR, "generated");

function generate() {
  if (!existsSync(SRC_DIR)) return;
  mkdirSync(OUT_DIR, { recursive: true });
  const files = readdirSync(SRC_DIR).filter((file) => extname(file) === ".md");
  for (const file of files) {
    const slug = basename(file, ".md");
    const markdown = readFileSync(join(SRC_DIR, file), "utf-8");
    const html = markdownToHtml(markdown);
    writeFileSync(join(OUT_DIR, `${slug}.ts`), `export const html = ${JSON.stringify(html)};\n`);
  }
}

generate();
