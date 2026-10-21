import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { SITE, page, metaContent, hrefs, distFileExists, builtPages } from "./helpers";
import { RUNNABLE_SCRIPTS } from "./budget";

const GH = "https://github.com/Sour-Dev-Home/satisfactory-dash/blob/main/";

describe("satisfactory-dash case study", () => {
  const doc = page("projects/satisfactory-dash.html");

  it("has its own title, canonical URL and article preview", () => {
    expect(doc.querySelector("title")?.text).toBe("satisfactory-dash — Case Study | Leonardo Nunez");
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `${SITE}/projects/satisfactory-dash`,
    );
    expect(metaContent(doc, 'meta[property="og:type"]')).toBe("article");
    expect(metaContent(doc, 'meta[name="description"]')).toMatch(/^A Satisfactory server dashboard/);
  });

  it("renders the heading, stack and every section", () => {
    expect(doc.querySelector("h1")?.text).toBe("satisfactory-dash");
    expect(doc.querySelectorAll(".stack-list li").map((li) => li.text)).toContain("PostgreSQL");
    expect(doc.querySelectorAll(".case-study-body h2").map((h) => h.text.trim())).toEqual([
      "The problem",
      "Finding the bottleneck",
      "How data gets in",
      "The move to AWS",
      "Keeping it running",
      "Could the agent move into the game?",
      "What I’d do differently",
      "How it was built",
    ]);
  });

  // The cover repeated the page's own heading, so it only makes the card and preview stills.
  it("places both figures in the article, with no cover above the heading", () => {
    expect(doc.querySelector(".satis-cover")).toBeNull();
    expect(doc.querySelector('.world-satis figure[data-figure="outage"]')).not.toBeNull();
    expect(doc.querySelector('figure[data-figure="cutover"]')).not.toBeNull();
  });

  it("keeps the deeper material in closed 'More detail' sections", () => {
    const details = doc.querySelectorAll(".case-study-body details");
    expect(details.filter((d) => /More detail/.test(d.querySelector("summary")?.text ?? "")).length).toBeGreaterThanOrEqual(2);
    for (const d of details) expect(d.hasAttribute("open")).toBe(false);
  });

  it("links every claim's source in the public repo", () => {
    const links = hrefs(doc);
    expect(links).toContain("/");
    for (const path of [
      "agent/src/queue.ts",
      "agent/src/pusher.ts",
      "agent/src/backoff.ts",
      "agent/src/agentRunner.ts",
      "frontend/src/components/DataAge.tsx",
      "infra/aws/ecs.tf",
      "docs-vault/wiki/runbooks/aws.md",
      "docs-vault/wiki/decisions/0031-edge-agent.md",
      "docs-vault/wiki/decisions/0034-backend-on-aws.md",
      "docs-vault/wiki/decisions/0035-backups-off-aws.md",
    ]) {
      expect(links.some((h) => h.startsWith(GH + path)), path).toBe(true);
    }
    expect(links).toContain("https://demo.satis-manager.com");
    expect(links).toContain("https://satis-manager.com");
  });

  it("links an issue number to that issue, not to a file", () => {
    const a = doc.querySelectorAll(".case-study-body a").find((l) => l.text.trim() === "#425");
    expect(a?.getAttribute("href")).toBe("https://github.com/Sour-Dev-Home/satisfactory-dash/issues/425");
  });

  it("tells how it was built in a sidenote: three agents first, then lanes", () => {
    const notes = doc.querySelectorAll(".case-study-body .sidenote-note").map((n) => n.text);
    expect(notes.some((t) => /architect/.test(t) && /lanes/i.test(t))).toBe(true);
  });

  it("references media that is actually in the build", () => {
    const media = [
      ...doc.querySelectorAll("video source").map((s) => s.getAttribute("src") ?? ""),
      ...doc.querySelectorAll(".case-study-body img").map((i) => i.getAttribute("src") ?? ""),
    ];
    expect(media).toContain("/demo/satisfactory-dash-walkthrough.mp4");
    for (const src of media) {
      expect(distFileExists(src.slice(1)), src).toBe(true);
    }
  });

  // Replaces "ships no JavaScript": the figures run here, within the page's budget (budget.ts).
  it("runs only its own module scripts, from the build", () => {
    const scripts = doc.querySelectorAll(RUNNABLE_SCRIPTS);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(s.getAttribute("type")).toBe("module");
  });

  it("uses a link-preview image made from its cover", () => {
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(`${SITE}/og/satisfactory-dash.png`);
    expect(distFileExists("og/satisfactory-dash.png")).toBe(true);
    expect(distFileExists("covers/satisfactory-dash.png")).toBe(true);
  });
});

describe("data-only projects", () => {
  it("get no page", () => {
    expect(distFileExists("projects/home-lab.html")).toBe(false);
  });
});

// Source comments are notes for whoever edits the layout, not copy: an HTML comment in an .astro
// file ships to every visitor. React's empty "<!-- -->" text separators are the only comments left.
describe("every case study", () => {
  const studies = builtPages().filter((f) => f.startsWith("projects/"));

  it("is built", () => {
    expect(studies.length).toBeGreaterThanOrEqual(3);
  });

  it.each(studies)("%s ships no source comments", (file) => {
    const html = readFileSync(join(process.cwd(), "dist", file), "utf-8");
    const comments = [...html.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1].trim()).filter(Boolean);
    expect(comments).toEqual([]);
  });
});
