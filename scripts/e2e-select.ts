// Picks which pages a pull request has to test end to end. It compares the built
// site of the pull request with the build of its base: a page is changed when its
// HTML, or any file it pulls in (CSS, scripts, fonts, pictures, and the files those
// pull in), differs. The comparison is of build output, not of source files, so a
// shared stylesheet change reaches every page that loads it and a docs-only change
// reaches none.
//
// Anything it can't attribute runs everything: a change to the test setup itself,
// or to a built file no page pulls in (robots.txt, a file fetched at run time).
// Pushes to main always run everything.
//
//   node scripts/e2e-select.ts manifest <dist> <out.json>
//   node scripts/e2e-select.ts setup-changed <changed-files.txt>   (prints the changed setup files)
//   node scripts/e2e-select.ts select [<changed-files.txt> <base.json> <head.json>]
//   node scripts/e2e-select.ts lighthouse-config <lighthouserc.json> <page,page>
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { PAGES, SPECS, pageTag } from "../e2e/pages.ts";

export type Manifest = { pages: Record<string, string>; files: Record<string, string>; loose: string[] };
export type Selection = { mode: "all" | "some" | "none"; pages: string[]; reason: string };
type LighthouseRc = { ci: { collect: { url: string[] } & Record<string, unknown> } & Record<string, unknown> };

// Files that decide how the tests run rather than what they test.
export const SETUP = [
  /^e2e\//,
  /^playwright\.config\.ts$/,
  /^lighthouserc\.json$/,
  /^package(-lock)?\.json$/,
  /^\.node-version$/,
  /^\.github\/workflows\/ci\.yml$/,
  /^scripts\/e2e-select\.ts$/,
];

// Built files whose text can name other built files.
const TEXT = /\.(html|css|js|mjs|json|svg|webmanifest|xml|txt)$/;

export function pageFile({ path, status }: { path: string; status: number }) {
  if (status === 404) return "404.html";
  return path === "/" ? "index.html" : `${path.slice(1)}.html`;
}

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, root) : [relative(root, full).split(sep).join("/")];
  });
}

const sha = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

// Every page's fingerprint, every built file's hash, and the files no page pulls in.
export function manifest(dist: string): Manifest {
  const files = listFiles(dist);
  const content = new Map(files.map((f) => [f, readFileSync(join(dist, f))]));
  const hashes = new Map(files.map((f) => [f, sha(content.get(f)!)]));

  // A file pulls in another when its text contains that file's name. Built assets
  // carry content hashes in their names, so this over-matches rarely, and an
  // over-match only means a page is tested when it didn't need to be.
  const pulls = new Map<string, string[]>();
  for (const f of files.filter((f) => TEXT.test(f))) {
    const text = content.get(f)!.toString("utf8");
    pulls.set(f, files.filter((other) => other !== f && text.includes(basename(other))));
  }

  const used = new Set<string>();
  const pages: Record<string, string> = {};
  for (const page of PAGES) {
    const start = pageFile(page);
    if (!content.has(start)) {
      pages[page.name] = "missing";
      continue;
    }
    const seen = new Set([start]);
    for (const f of seen) for (const next of pulls.get(f) ?? []) seen.add(next);
    for (const f of seen) used.add(f);
    pages[page.name] = sha([...seen].sort().map((f) => `${f}\0${hashes.get(f)}`).join("\n"));
  }
  return { pages, files: Object.fromEntries(hashes), loose: files.filter((f) => !used.has(f)) };
}

export const setupChanges = (changed: string[]) => changed.filter((f) => SETUP.some((re) => re.test(f)));

const ALL = PAGES.map((p) => p.name);

// What to run, from the changed source files and the two builds' manifests.
export function select(changed?: string[], base?: Manifest, head?: Manifest): Selection {
  if (!changed) return { mode: "all", pages: ALL, reason: "not a pull request" };
  const setup = setupChanges(changed);
  if (setup.length) return { mode: "all", pages: ALL, reason: `the test setup changed (${setup.slice(0, 3).join(", ")})` };
  if (!base || !head) return { mode: "all", pages: ALL, reason: "no build to compare with" };
  // A changed file some page pulls in, in either build, already changed that page.
  const used = (build: Manifest, f: string) => f in build.files && !build.loose.includes(f);
  const names = new Set([...Object.keys(base.files), ...Object.keys(head.files)]);
  const loose = [...names].filter((f) => base.files[f] !== head.files[f] && !used(base, f) && !used(head, f));
  if (loose.length) return { mode: "all", pages: ALL, reason: `built files no page pulls in changed (${loose.slice(0, 3).join(", ")})` };
  const pages = ALL.filter((name) => base.pages[name] !== head.pages[name]);
  if (!pages.length) return { mode: "none", pages, reason: "no page's built output changed" };
  return { mode: "some", pages, reason: `changed pages: ${pages.join(", ")}` };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A Playwright --grep for the tests of these pages. Playwright matches it against
// "<project> <file> <describe> <title> <tags>", so a spec is picked by its file name.
// The lookbehind keeps "figure.spec.ts" from matching "site-figure.spec.ts".
export function grepFor(pages: string[]) {
  const tags = pages.map((name) => `${escape(pageTag(name))}\\b`);
  const specs = Object.entries(SPECS)
    .filter(([, visits]) => visits !== "tagged" && (visits.length === 0 || visits.some((p) => pages.includes(p))))
    .map(([file]) => `(?<![\\w-])${escape(file)}`);
  return [...tags, ...specs].join("|");
}

// The Lighthouse config, with only the URLs of these pages.
export function lighthouseConfig(rc: LighthouseRc, pages: string[]): LighthouseRc {
  const paths = new Set(PAGES.filter((p) => pages.includes(p.name)).map((p) => p.path));
  const url = rc.ci.collect.url.filter((u) => paths.has(new URL(u).pathname));
  return { ...rc, ci: { ...rc.ci, collect: { ...rc.ci.collect, url } } };
}

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const readLines = (file: string) => readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);

// A missing or malformed manifest means no build to compare with: run everything.
function readManifest(file?: string): Manifest | undefined {
  if (!file) return undefined;
  try {
    const m = readJson(file);
    return m.pages && m.files && Array.isArray(m.loose) ? m : undefined;
  } catch {
    return undefined;
  }
}

function main([command, ...args]: string[]) {
  if (command === "manifest") {
    writeFileSync(args[1], JSON.stringify(manifest(args[0]), null, 2));
  } else if (command === "setup-changed") {
    console.log(setupChanges(readLines(args[0])).join("\n"));
  } else if (command === "select") {
    const [changed, base, head] = args;
    const result = select(changed ? readLines(changed) : undefined, readManifest(base), readManifest(head));
    const lighthouse = lighthouseConfig(readJson("lighthouserc.json"), result.pages).ci.collect.url.length > 0;
    console.error(`e2e: ${result.mode} (${result.reason})`);
    // GitHub Actions step outputs.
    console.log(`mode=${result.mode}`);
    console.log(`pages=${result.pages.join(",")}`);
    console.log(`grep=${result.mode === "some" ? grepFor(result.pages) : ""}`);
    console.log(`lighthouse=${result.mode !== "none" && lighthouse}`);
  } else if (command === "lighthouse-config") {
    console.log(JSON.stringify(lighthouseConfig(readJson(args[0]), args[1].split(",")), null, 2));
  } else {
    console.error("usage: e2e-select.ts manifest | setup-changed | select | lighthouse-config");
    process.exit(2);
  }
}

if (process.argv[1]?.endsWith("e2e-select.ts")) main(process.argv.slice(2));
