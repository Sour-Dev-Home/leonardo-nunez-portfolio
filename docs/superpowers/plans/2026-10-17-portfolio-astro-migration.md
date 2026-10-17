# Portfolio Astro Migration Implementation Plan (Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-platform today's site from a Vite single-page app onto Astro with no visible change, so every page is pre-rendered HTML with its own title, description and Open Graph tags, and project data lives in a validated content collection.

**Architecture:** Astro (static output, `build.format: "file"`) renders the existing React components at build time with no client JavaScript. Projects move from `src/data/projects.ts` into one folder per project under `src/content/projects/`, validated by a zod schema; a project with a markdown body gets a case-study page. A pure `buildMeta` function produces the head tags, and a build-output test suite (`tests/dist/`) checks the built HTML for parity and previews.

**Tech Stack:** Astro 7.4.0, @astrojs/react 7.1.0, @astrojs/mdx 8.1.0, React 19, TypeScript 7, Vitest 5, node-html-parser, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-10-17-portfolio-overhaul-design.md` (Sections 2 and 7; success criteria 1 and 6).

## The five plans

The spec's Phase 1 is split into five plans, each shipping working software:

1. **Astro migration** (this plan): parity, link previews, content collection.
2. **CI quality gates:** size-limit, Playwright e2e at 360/390/768/1280, Lighthouse CI, Argos, lychee.
3. **Design system and motion kit:** after Leonardo picks the font pair and the Sidenote font; adds `/about`, view transitions, work cards, `docs/STYLE.md`.
4. **The satis-manager world:** after the cover round; converts the case study to MDX.
5. **Domain:** after Leonardo buys it; changes `site` and adds the redirect.

## Global Constraints

- Node `>=22.22.0` (Astro 7's engine floor). `.node-version` holds `22.22.0`; CI and Cloudflare Pages read it.
- Exact versions: `astro@7.4.0`, `@astrojs/react@7.1.0`, `@astrojs/mdx@8.1.0`. React stays at 19.
- No client JavaScript in this plan: no `client:*` directive anywhere.
- URLs: `/`, `/projects/satisfactory-dash` (no trailing slash), and a real 404 page.
- `site` is `https://leonardo-nunez-portfolio.pages.dev` until Plan 5.
- Visual parity: keep `src/index.css` and every existing class name; no redesign in this plan.
- Project data lives only in each project's frontmatter (CLAUDE.md ground rule 2, updated in Task 5).
- No PII beyond CLAUDE.md ground rule 3's exception; no absolute local paths in any committed file.
- **Deviation from the spec:** the spec's `astro check` is replaced by `astro sync && tsc -b`, because `@astrojs/check@0.9.10` requires TypeScript `^5 || ^6` and this repo is on TypeScript 7. Content-schema errors still fail `astro sync` and `astro build`.
- Data-only projects (no markdown body) get no page, as today. The spec's "data-only page" is not built: it would only repeat the home card.
- Never push to `main`; the work lands as one PR reviewed on its Pages preview URL (ground rule 5).

## Review Focus

1. **A direct load or refresh of `/projects/satisfactory-dash`** must serve the case study. The SPA used to answer every path with `index.html`, and that fallback is gone. Pinned by Task 4's dist test (the file exists) and Task 5's preview check.
2. **An unknown URL** must show a real "Page not found" page with a link home, not a blank page or the home page. Pinned by Task 3's 404 dist test.
3. **`/projects/satisfactory-dash/`** (with a trailing slash, as some people will paste it) must still reach the page. Pinned by Task 5's preview check.
4. **A project without a case study** must never get a "Read case study" link to a page that doesn't exist. Pinned by Task 1's `toProjects` test and Task 3's "links only to case studies that exist" dist test.
5. **A shared link** must preview with an absolute `og:image` and `og:url`, because LinkedIn and Slack ignore relative URLs. Pinned by Task 2's unit tests and Task 3/4's dist tests.

---

### Task 1: Project schema and ordering

**Files:**
- Create: `src/lib/projects.ts`
- Test: `src/lib/projects.test.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `projectSchema` (zod object; output type `ProjectData`)
  - `type ProjectData = { name: string; description: string; status: "in-progress" | "shipped"; stack: string[]; repoUrl?: string; liveUrl?: string; emphasis?: "primary" | "secondary"; order: number; world: boolean; ogImage?: string }`
  - `interface Project extends ProjectData { slug?: string }`, where `slug` is set only when the project has a case study
  - `interface ProjectEntry { id: string; body?: string; data: ProjectData }`
  - `hasCaseStudy(entry: { body?: string }): boolean`
  - `toProjects(entries: ProjectEntry[]): Project[]`

- [ ] **Step 1: Install Astro and the test parser**

Run:
```bash
npm install astro@7.4.0 @astrojs/react@7.1.0 @astrojs/mdx@8.1.0
npm install -D node-html-parser
```
Expected: both finish with no `ERR!` lines. `package.json` lists the three Astro packages under `dependencies` and `node-html-parser` under `devDependencies`.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/projects.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { projectSchema, hasCaseStudy, toProjects, type ProjectData } from "./projects";

const valid = { name: "P", description: "D", status: "shipped", stack: ["TS"], order: 1 };

function data(over: Partial<ProjectData> = {}): ProjectData {
  return { name: "P", description: "D", status: "shipped", stack: ["TS"], order: 1, world: false, ...over };
}

describe("projectSchema", () => {
  it("accepts a minimal project and defaults world to false", () => {
    expect(projectSchema.parse(valid).world).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(() => projectSchema.parse({ ...valid, status: "done" })).toThrow();
  });

  it("rejects a repoUrl that isn't a URL", () => {
    expect(() => projectSchema.parse({ ...valid, repoUrl: "github.com/x" })).toThrow();
  });

  it("rejects an empty stack", () => {
    expect(() => projectSchema.parse({ ...valid, stack: [] })).toThrow();
  });

  it("rejects an ogImage that isn't a root-relative path", () => {
    expect(() => projectSchema.parse({ ...valid, ogImage: "og.png" })).toThrow();
    expect(projectSchema.parse({ ...valid, ogImage: "/og.png" }).ogImage).toBe("/og.png");
  });
});

describe("hasCaseStudy", () => {
  it("is false with no body or a whitespace-only body", () => {
    expect(hasCaseStudy({})).toBe(false);
    expect(hasCaseStudy({ body: "  \n\t" })).toBe(false);
  });

  it("is true when the body has content", () => {
    expect(hasCaseStudy({ body: "## The problem" })).toBe(true);
  });
});

describe("toProjects", () => {
  it("sorts by order", () => {
    const result = toProjects([
      { id: "b", data: data({ name: "B", order: 2 }) },
      { id: "a", data: data({ name: "A", order: 1 }) },
    ]);
    expect(result.map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("breaks order ties by name so the home page order is stable", () => {
    const result = toProjects([
      { id: "z", data: data({ name: "Zeta", order: 1 }) },
      { id: "a", data: data({ name: "Alpha", order: 1 }) },
    ]);
    expect(result.map((p) => p.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("sets a slug only for projects with a case study", () => {
    const [withBody, withoutBody] = toProjects([
      { id: "with-body", body: "## Hi", data: data({ order: 1 }) },
      { id: "no-body", body: "", data: data({ order: 2 }) },
    ]);
    expect(withBody.slug).toBe("with-body");
    expect(withoutBody.slug).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/projects.test.ts --reporter=dot`
Expected: FAIL, with "Failed to resolve import "./projects"" or "Cannot find module".

- [ ] **Step 4: Write the implementation**

Create `src/lib/projects.ts`:
```ts
import { z } from "astro/zod";

// The shape of every project's frontmatter in src/content/projects/<slug>/index.md.
// src/content.config.ts uses this schema, so an invalid entry fails the build.
export const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["in-progress", "shipped"]),
  stack: z.array(z.string().min(1)).min(1),
  repoUrl: z.url().optional(),
  liveUrl: z.url().optional(),
  emphasis: z.enum(["primary", "secondary"]).optional(),
  order: z.number().int(),
  world: z.boolean().default(false),
  ogImage: z.string().startsWith("/").optional(),
});

export type ProjectData = z.infer<typeof projectSchema>;

export interface Project extends ProjectData {
  /** Set only when the project has a case-study page. */
  slug?: string;
}

export interface ProjectEntry {
  id: string;
  body?: string;
  data: ProjectData;
}

export function hasCaseStudy(entry: { body?: string }): boolean {
  return (entry.body ?? "").trim().length > 0;
}

export function toProjects(entries: ProjectEntry[]): Project[] {
  return [...entries]
    .sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name))
    .map((entry) => ({ ...entry.data, slug: hasCaseStudy(entry) ? entry.id : undefined }));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/projects.test.ts --reporter=dot`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/projects.ts src/lib/projects.test.ts
git commit -m "Add the project content schema and ordering"
```

---

### Task 2: Page meta builder

**Files:**
- Create: `src/lib/meta.ts`
- Test: `src/lib/meta.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DEFAULT_OG_IMAGE = "/og/default.png"`
  - `interface MetaInput { title: string; description: string; path: string; image?: string }`
  - `interface MetaTag { name?: string; property?: string; content: string }`
  - `interface Meta { title: string; canonical: string; tags: MetaTag[] }`
  - `buildMeta(input: MetaInput, site: URL | string): Meta`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/meta.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildMeta, DEFAULT_OG_IMAGE } from "./meta";

const SITE = "https://example.pages.dev";

function tag(meta: ReturnType<typeof buildMeta>, key: string): string | undefined {
  return meta.tags.find((t) => t.property === key || t.name === key)?.content;
}

describe("buildMeta", () => {
  const home = buildMeta({ title: "Home", description: "Desc", path: "/" }, SITE);
  const page = buildMeta(
    { title: "Case", description: "About it", path: "/projects/x", image: "/img/x.png" },
    SITE,
  );

  it("makes the canonical and og:url absolute", () => {
    expect(page.canonical).toBe("https://example.pages.dev/projects/x");
    expect(tag(page, "og:url")).toBe("https://example.pages.dev/projects/x");
  });

  it("makes og:image absolute, falling back to the default image", () => {
    expect(tag(page, "og:image")).toBe("https://example.pages.dev/img/x.png");
    expect(tag(home, "og:image")).toBe(`https://example.pages.dev${DEFAULT_OG_IMAGE}`);
  });

  it("uses website for the home page and article elsewhere", () => {
    expect(tag(home, "og:type")).toBe("website");
    expect(tag(page, "og:type")).toBe("article");
  });

  it("repeats title and description in the description, og and twitter tags", () => {
    expect(page.title).toBe("Case");
    expect(tag(page, "description")).toBe("About it");
    expect(tag(page, "og:title")).toBe("Case");
    expect(tag(page, "og:description")).toBe("About it");
    expect(tag(page, "twitter:card")).toBe("summary_large_image");
  });

  it("accepts the site as a URL object", () => {
    expect(buildMeta({ title: "T", description: "D", path: "/" }, new URL(SITE)).canonical).toBe(
      "https://example.pages.dev/",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/meta.test.ts --reporter=dot`
Expected: FAIL, the module can't be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/lib/meta.ts`:
```ts
export const DEFAULT_OG_IMAGE = "/og/default.png";

export interface MetaInput {
  title: string;
  description: string;
  /** Root-relative path of the page, e.g. "/projects/satisfactory-dash". */
  path: string;
  /** Root-relative path of the preview image; defaults to DEFAULT_OG_IMAGE. */
  image?: string;
}

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface Meta {
  title: string;
  canonical: string;
  tags: MetaTag[];
}

// Link previewers (LinkedIn, Slack) don't run JavaScript and ignore relative URLs,
// so every URL here is absolute and the tags are rendered at build time.
export function buildMeta(input: MetaInput, site: URL | string): Meta {
  const canonical = new URL(input.path, site).href;
  const image = new URL(input.image ?? DEFAULT_OG_IMAGE, site).href;
  return {
    title: input.title,
    canonical,
    tags: [
      { name: "description", content: input.description },
      { property: "og:type", content: input.path === "/" ? "website" : "article" },
      { property: "og:site_name", content: "Leonardo Nunez" },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:url", content: canonical },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/meta.test.ts --reporter=dot`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta.ts src/lib/meta.test.ts
git commit -m "Add a build-time page meta builder"
```

---

### Task 3: Switch the build to Astro (home page and 404)

**Files:**
- Create: `astro.config.ts`, `src/content.config.ts`, `src/layouts/Shell.astro`, `src/pages/index.astro`, `src/pages/404.astro`, `vitest.config.ts`, `vitest.dist.config.ts`, `tests/dist/helpers.ts`, `tests/dist/home.test.ts`, `src/content/projects/satisfactory-dash/index.md` (moved), `src/content/projects/lanes/index.md`, `src/content/projects/local-worker/index.md`, `src/content/projects/home-lab/index.md`
- Modify: `package.json` (scripts, dependencies), `tsconfig.app.json`, `tsconfig.node.json`, `.gitignore`, `src/components/Projects.tsx`, `src/components/ProjectCard.tsx`, `src/components/ProjectLinks.tsx`, `src/components/ProjectCard.test.tsx`
- Delete: `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/pages/Home.tsx`, `src/pages/ProjectDetail.tsx`, `src/pages/ProjectDetail.test.tsx`, `src/router/` (all files), `src/hooks/` (all files), `src/data/projects.ts`, `src/content/case-studies/` (index.ts, generated/), `scripts/` (all three files)

**Interfaces:**
- Consumes: `projectSchema`, `toProjects`, `hasCaseStudy`, `type Project` (Task 1); `buildMeta` (Task 2).
- Produces:
  - `Shell.astro` props: `{ title: string; description: string; path: string; image?: string }`
  - `Projects` component: `Projects({ projects }: { projects: Project[] })`
  - `ProjectCard({ project }: { project: Project })` and `ProjectLinks({ project, showCaseStudyLink }: { project: Project; showCaseStudyLink?: boolean })`, both importing `Project` from `src/lib/projects`
  - collection `projects`, entry id = the project's folder name
  - `tests/dist/helpers.ts`: `SITE`, `page(file: string): HTMLElement`, `metaContent(doc, selector): string | undefined`, `hrefs(doc): string[]`, `distFileExists(path: string): boolean`
  - npm scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:dist`

- [ ] **Step 1: Write the failing build-output tests**

Create `vitest.dist.config.ts`:
```ts
import { defineConfig } from "vitest/config";

// Tests over the built site in dist/. Run after `npm run build`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/dist/**/*.test.ts"],
  },
});
```

Create `tests/dist/helpers.ts`:
```ts
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
```

Create `tests/dist/home.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SITE, page, metaContent, hrefs, distFileExists } from "./helpers";

describe("home page", () => {
  const doc = page("index.html");

  it("has the site title and absolute link-preview tags", () => {
    expect(doc.querySelector("title")?.text).toBe("Leonardo Nunez — Full-Stack Developer");
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${SITE}/`);
    expect(metaContent(doc, 'meta[property="og:url"]')).toBe(`${SITE}/`);
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(`${SITE}/og/default.png`);
    expect(metaContent(doc, 'meta[name="description"]')).toMatch(/portfolio/);
  });

  it("lists every project in order", () => {
    const names = doc.querySelectorAll(".project-card h3").map((h) => h.text.trim());
    expect(names).toEqual(["satisfactory-dash", "lanes", "local-worker", "Home Lab"]);
  });

  it("keeps every external link the old site had", () => {
    const links = hrefs(doc);
    for (const href of [
      "https://github.com/Sour-Dev-Home/satisfactory-dash",
      "https://demo.satis-manager.com",
      "https://github.com/Sour-Dev-Home/lanes",
      "https://github.com/Sour-Dev-Home/local-worker",
      "mailto:soure393@gmail.com",
      "https://github.com/SourE-dev",
      "https://www.linkedin.com/in/leonardo-nunez-708634248",
      "https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio",
    ]) {
      expect(links).toContain(href);
    }
  });

  it("links only to case studies that exist", () => {
    const caseLinks = hrefs(doc).filter((h) => h.startsWith("/projects/"));
    expect(caseLinks).toEqual(["/projects/satisfactory-dash"]);
  });

  it("keeps the section anchors the header links to", () => {
    for (const id of ["top", "about", "projects", "skills", "contact"]) {
      expect(doc.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("ships no JavaScript", () => {
    expect(doc.querySelectorAll("script")).toHaveLength(0);
  });
});

describe("404 page", () => {
  const doc = page("404.html");

  it("says the page wasn't found and links home", () => {
    expect(doc.querySelector("h1")?.text).toBe("Page not found");
    expect(hrefs(doc)).toContain("/");
  });

  it("is built where Cloudflare Pages looks for it", () => {
    expect(distFileExists("404.html")).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --config vitest.dist.config.ts --reporter=dot`
Expected: FAIL. The old Vite build doesn't produce `404.html`, and `dist/index.html` (if it exists) has `<script>` tags and no `og:` tags.

- [ ] **Step 3: Move the content into the collection**

```bash
mkdir -p src/content/projects/satisfactory-dash src/content/projects/lanes src/content/projects/local-worker src/content/projects/home-lab
git mv src/content/case-studies/satisfactory-dash.md src/content/projects/satisfactory-dash/index.md
```

Prepend this frontmatter to `src/content/projects/satisfactory-dash/index.md` (the existing body stays unchanged below it). Copy the `description` text verbatim from the satisfactory-dash entry in `src/data/projects.ts`, indented by two spaces under `>-`:
```yaml
---
name: satisfactory-dash
description: >-
  A dashboard and backend for a live Satisfactory dedicated server: production rate, overflow, and power-outage monitoring, with a public offline demo. Full-stack TypeScript in an npm workspaces monorepo (Vite/React frontend, Express backend) around a schema-first Zod contract shared by both sides. Data lives in PostgreSQL 18 with hand-written parameterized SQL, forward-only migrations, and separate migrator, app and read-only backup roles, plus an audit trail the app role cannot rewrite. Google sign-in (OpenID Connect with PKCE) is implemented and security-reviewed but not yet public, and encrypted database backups to a versioned S3 bucket through a put-only IAM identity run nightly, with a restore rehearsal passed. Servers are stored in Postgres with their API tokens encrypted at rest (AES-256-GCM) and an SSRF guard on the addresses the backend will call, and production history is recorded with retention and rollups. Design decisions are recorded in 31 architecture decision records, and changes merge through a GitHub merge queue with a fail-closed review gate, plus CI lint/typecheck/test/build, a PII-leak and npm audit check, CodeQL, and an architecture drift check.
status: in-progress
stack: [React, TypeScript, Express, Vite, Zod, PostgreSQL, AWS S3, pino, Docker]
repoUrl: https://github.com/Sour-Dev-Home/satisfactory-dash
liveUrl: https://demo.satis-manager.com
order: 1
ogImage: /demo/satisfactory-dash-walkthrough-poster.png
---
```

Create `src/content/projects/lanes/index.md`. The `description` is the lanes entry's text from `src/data/projects.ts`, verbatim; the `>-` block scalar keeps its double quotes and colons safe:
```yaml
---
name: lanes
description: >-
  A workflow for building software with parallel Claude Code sessions ("lanes"): one fresh session per GitHub issue, with contracts at every handoff (the task issue form, contract files, the PR template, JSON reviewer verdicts) and required GitHub checks as the only gatekeeper, so unattended work can run overnight on low-risk issues. A Node.js test suite (158 tests as of PR #7) backs a lanes/gate status computed from the live diff and issue labels; a branch ruleset requires verify, security (an org-wide PII check) and CodeQL with no bypass, merged through a queue. Reviewer subagents (test-hunter, security, UI, architecture) each post a per-criterion verdict on the PR. The threat model is documented candidly: the gate stops honest mistakes and strangers, not a lane that turns hostile, and a dedicated GitHub App to close that gap is planned. Still a pilot: its first lane (trusting issue authors by repository write access, not GitHub's author_association field) ran end to end and merged; a progress dashboard is planned, not yet built.
status: in-progress
stack: [Node.js, GitHub Actions, Claude Code]
repoUrl: https://github.com/Sour-Dev-Home/lanes
emphasis: secondary
order: 2
---
```

Create `src/content/projects/local-worker/index.md`:
```yaml
---
name: local-worker
description: >-
  An MCP server that offloads bulk reading (CI logs, diffs, long docs) and first drafts to a local Ollama model on the GPU, so large inputs never enter Claude's context — plus Markdown-to-PDF rendering and a weekly devlog CLI. 233 tests, CI on Ubuntu and Windows, with path confinement hardened through an independent bug hunt and two security reviews.
status: shipped
stack: [TypeScript, Node.js, MCP, Ollama, Vitest]
repoUrl: https://github.com/Sour-Dev-Home/local-worker
emphasis: secondary
order: 3
---
```

Create `src/content/projects/home-lab/index.md`:
```yaml
---
name: Home Lab
description: >-
  A self-hosted infrastructure stack running since late 2023: a Proxmox server handling Plex media streaming, Steam server hosting, and automated DVD ripping via shell scripts across VMs and Docker containers. Includes UPS-backed power, network-wide monitoring via a Raspberry Pi running Pi-hole, and a DAS providing media storage plus nightly personal-device snapshots over Syncthing. Also includes a LAN file-upload backend built to OWASP security guidelines.
status: shipped
stack: [Proxmox, Docker, Linux, Raspberry Pi, Syncthing]
order: 4
---
```

Before Step 8 deletes `src/data/projects.ts`, compare each frontmatter field with its entry there: every description must match character for character, and every `stack`, `repoUrl`, `liveUrl` and `emphasis` value must match. (The descriptions are copied unchanged on purpose; refreshing the copy is Plan 4's and Phase 2's job.)

- [ ] **Step 4: Add the Astro and content config**

Create `astro.config.ts`:
```ts
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";

export default defineConfig({
  // Plan 5 switches this to the custom domain.
  site: "https://leonardo-nunez-portfolio.pages.dev",
  trailingSlash: "never",
  // projects/satisfactory-dash.html, served by Cloudflare Pages at /projects/satisfactory-dash.
  build: { format: "file" },
  integrations: [react(), mdx()],
});
```

Create `src/content.config.ts`:
```ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { projectSchema } from "./lib/projects";

// One folder per project: src/content/projects/<slug>/index.md(x). The folder name
// is the entry id and the case-study URL. A file with no body is a data-only project.
const projects = defineCollection({
  loader: glob({
    pattern: "*/index.{md,mdx}",
    base: "./src/content/projects",
    generateId: ({ entry }) => entry.split("/")[0],
  }),
  schema: projectSchema,
});

export const collections = { projects };
```

- [ ] **Step 5: Update the components**

`src/components/ProjectLinks.tsx`: replace `import type { Project } from "../data/projects";` and `import { Link } from "../router/Link";` with `import type { Project } from "../lib/projects";`, and replace the case-study link line with a plain anchor:
```tsx
      {hasCaseStudyLink && <a href={`/projects/${project.slug}`}>Read case study →</a>}
```

`src/components/ProjectCard.tsx`: change the type import to `import type { Project } from "../lib/projects";`. Nothing else changes.

`src/components/Projects.tsx`, replace the whole file:
```tsx
import type { Project } from "../lib/projects";
import { ProjectCard } from "./ProjectCard";

interface ProjectsProps {
  projects: Project[];
}

export function Projects({ projects }: ProjectsProps) {
  return (
    <section id="projects" className="section">
      <h2>Projects</h2>
      <div className="projects-grid">
        {projects.map((project) => (
          <ProjectCard key={project.name} project={project} />
        ))}
      </div>
    </section>
  );
}
```

`src/components/ProjectCard.test.tsx`: delete the `RouterProvider` import, change the type import to `import type { Project } from "../lib/projects";`, add `order: 1, world: false,` to `baseProject`, and make `renderCard` render the card directly:
```tsx
function renderCard(project: Project) {
  return render(<ProjectCard project={project} />);
}
```

- [ ] **Step 6: Write the layout and pages**

Create `src/layouts/Shell.astro`:
```astro
---
import "../index.css";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { buildMeta } from "../lib/meta";

interface Props {
  title: string;
  description: string;
  /** Root-relative path of this page, e.g. "/" or "/projects/satisfactory-dash". */
  path: string;
  image?: string;
}

const { title, description, path, image } = Astro.props;
const meta = buildMeta({ title, description, path, image }, Astro.site!);
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{meta.title}</title>
    <link rel="canonical" href={meta.canonical} />
    {
      meta.tags.map((tag) =>
        tag.property ? (
          <meta property={tag.property} content={tag.content} />
        ) : (
          <meta name={tag.name} content={tag.content} />
        ),
      )
    }
  </head>
  <body>
    <Header />
    <slot />
    <Footer />
  </body>
</html>
```

Create `src/pages/index.astro`:
```astro
---
import { getCollection } from "astro:content";
import Shell from "../layouts/Shell.astro";
import { Hero } from "../components/Hero";
import { About } from "../components/About";
import { Projects } from "../components/Projects";
import { Skills } from "../components/Skills";
import { Contact } from "../components/Contact";
import { toProjects } from "../lib/projects";

const projects = toProjects(await getCollection("projects"));
---

<Shell
  title="Leonardo Nunez — Full-Stack Developer"
  description="Leonardo Nunez — full-stack developer portfolio: projects, background, and case studies."
  path="/"
>
  <main>
    <Hero />
    <About />
    <Projects projects={projects} />
    <Skills />
    <Contact />
  </main>
</Shell>
```

Create `src/pages/404.astro`:
```astro
---
import Shell from "../layouts/Shell.astro";
---

<Shell title="Page not found | Leonardo Nunez" description="This page doesn't exist." path="/404">
  <main>
    <section class="section">
      <h1>Page not found</h1>
      <p><a href="/">Back home</a></p>
    </section>
  </main>
</Shell>
```

- [ ] **Step 7: Point scripts, TypeScript and Vitest at Astro**

In `package.json`, replace the whole `scripts` block:
```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro sync && tsc -b",
    "lint": "oxlint",
    "test": "vitest run",
    "test:dist": "vitest run --config vitest.dist.config.ts"
  },
```
Then run `npm uninstall marked @vitejs/plugin-react`.

Create `vitest.config.ts`:
```ts
/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/vitest-setup.ts"],
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

`tsconfig.app.json`: set `"types": ["astro/client", "node", "@testing-library/jest-dom"]` and `"include": ["src", "tests", ".astro/types.d.ts"]`.

`tsconfig.node.json`: set `"include": ["astro.config.ts", "vitest.config.ts", "vitest.dist.config.ts"]`.

`.gitignore`: add a line `.astro/` under the build-output entries.

- [ ] **Step 8: Delete the single-page app**

```bash
git rm -q index.html vite.config.ts src/main.tsx src/App.tsx src/App.test.tsx src/pages/Home.tsx src/pages/ProjectDetail.tsx src/pages/ProjectDetail.test.tsx src/data/projects.ts src/content/case-studies/index.ts
git rm -rq src/router src/hooks scripts
rm -rf src/content/case-studies/generated
```
`useDocumentMeta`, the router and the markdown generator are replaced by `buildMeta`, Astro's routing and Astro's markdown rendering; their behaviour is covered by Task 2's unit tests and the dist tests.

- [ ] **Step 9: Build, then run every check**

Run, in order, each one reading its own summary line:
```bash
npm run typecheck
npm run lint
npx vitest run --reporter=dot
npm run build
npx vitest run --config vitest.dist.config.ts --reporter=dot
```
Expected:
- typecheck and lint: no errors.
- unit tests: PASS, including `projects.test.ts`, `meta.test.ts`, `Header.test.tsx` and `ProjectCard.test.tsx`.
- build: finishes with `dist/index.html`, `dist/404.html` and `dist/projects/satisfactory-dash.html` listed.
- dist tests: `home.test.ts` passes in full. Its `og:image` assertion checks the tag's URL, not the file; the image itself arrives in Task 5.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Move the site to Astro with build-time meta and a content collection"
```

---

### Task 4: Case-study page

**Files:**
- Create: `src/pages/projects/[slug].astro`
- Test: `tests/dist/case-study.test.ts`

**Interfaces:**
- Consumes: `hasCaseStudy` (Task 1); `Shell.astro` props, `StackList`, `ProjectLinks`, collection `projects`, `tests/dist/helpers.ts` (Task 3).
- Produces: one page per project with a body, at `/projects/<folder name>`.

- [ ] **Step 1: Write the failing test**

Create `tests/dist/case-study.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SITE, page, metaContent, hrefs, distFileExists } from "./helpers";

describe("satisfactory-dash case study", () => {
  const doc = page("projects/satisfactory-dash.html");

  it("has its own title, canonical URL and article preview", () => {
    expect(doc.querySelector("title")?.text).toBe("satisfactory-dash — Case Study | Leonardo Nunez");
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `${SITE}/projects/satisfactory-dash`,
    );
    expect(metaContent(doc, 'meta[property="og:type"]')).toBe("article");
    expect(metaContent(doc, 'meta[property="og:image"]')).toBe(
      `${SITE}/demo/satisfactory-dash-walkthrough-poster.png`,
    );
    expect(metaContent(doc, 'meta[name="description"]')).toMatch(/^A dashboard and backend/);
  });

  it("renders the heading, stack and every section", () => {
    expect(doc.querySelector("h1")?.text).toBe("satisfactory-dash");
    expect(doc.querySelectorAll(".stack-list li").map((li) => li.text)).toContain("PostgreSQL");
    expect(doc.querySelectorAll(".case-study-body h2").map((h) => h.text.trim())).toEqual([
      "The problem",
      "See it running",
      "Architecture",
      "Key decisions",
      "How it's built",
      "What's next",
      "Links",
    ]);
  });

  it("links back home and to every source the old page linked", () => {
    const links = hrefs(doc);
    expect(links).toContain("/");
    for (const href of [
      "https://demo.satis-manager.com",
      "https://satis-manager.com",
      "https://github.com/Sour-Dev-Home/satisfactory-dash",
      "https://github.com/Sour-Dev-Home/satisfactory-dash/blob/main/docs-vault/workspace.dsl",
      "https://github.com/Sour-Dev-Home/satisfactory-dash/tree/main/docs-vault/wiki/decisions",
    ]) {
      expect(links).toContain(href);
    }
  });

  it("references media that is actually in the build", () => {
    const media = [
      ...doc.querySelectorAll("video source").map((s) => s.getAttribute("src") ?? ""),
      ...doc.querySelectorAll(".case-study-body img").map((i) => i.getAttribute("src") ?? ""),
    ];
    expect(media).toContain("/demo/satisfactory-dash-walkthrough.mp4");
    expect(media).toContain("/diagrams/satisfactory-dash-deployment.svg");
    for (const src of media) {
      expect(distFileExists(src.slice(1)), src).toBe(true);
    }
  });

  it("ships no JavaScript", () => {
    expect(doc.querySelectorAll("script")).toHaveLength(0);
  });
});

describe("data-only projects", () => {
  it("get no page", () => {
    expect(distFileExists("projects/lanes.html")).toBe(false);
    expect(distFileExists("projects/home-lab.html")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build && npx vitest run tests/dist/case-study.test.ts --config vitest.dist.config.ts --reporter=dot`
Expected: FAIL with "dist/projects/satisfactory-dash.html doesn't exist. Run npm run build first."

- [ ] **Step 3: Write the page**

Create `src/pages/projects/[slug].astro`:
```astro
---
import { getCollection, render, type CollectionEntry } from "astro:content";
import Shell from "../../layouts/Shell.astro";
import { StackList } from "../../components/StackList";
import { ProjectLinks } from "../../components/ProjectLinks";
import { hasCaseStudy } from "../../lib/projects";

export async function getStaticPaths() {
  const entries = await getCollection("projects");
  return entries.filter(hasCaseStudy).map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

interface Props {
  entry: CollectionEntry<"projects">;
}

const { entry } = Astro.props;
const { Content } = await render(entry);
const project = { ...entry.data, slug: entry.id };
---

<Shell
  title={`${project.name} — Case Study | Leonardo Nunez`}
  description={project.description}
  path={`/projects/${entry.id}`}
  image={project.ogImage}
>
  <main>
    <article class="section case-study">
      <p class="case-study-back"><a href="/">← Back to all projects</a></p>
      <h1>{project.name}</h1>
      <StackList stack={project.stack} />
      <ProjectLinks project={project} />
      <div class="case-study-body"><Content /></div>
    </article>
  </main>
</Shell>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && npx vitest run --config vitest.dist.config.ts --reporter=dot`
Expected: PASS, all tests in `home.test.ts` and `case-study.test.ts`.

- [ ] **Step 5: Compare against the live site by eye**

Run `npm run preview`, open `http://localhost:4321/` and `http://localhost:4321/projects/satisfactory-dash` next to `https://leonardo-nunez-portfolio.pages.dev`, at desktop width and at 390 px in the browser's device toolbar. They should look the same: same sections, cards, video, diagrams and styles. Note any difference in the PR description; fix any that isn't caused by the markdown renderer's whitespace.

- [ ] **Step 6: Commit**

```bash
git add src/pages/projects tests/dist/case-study.test.ts
git commit -m "Pre-render case-study pages from the content collection"
```

---

### Task 5: Default preview image, CI, docs and the PR

**Files:**
- Create: `public/og/default.png`, `.node-version`, `tests/dist/assets.test.ts`
- Modify: `.github/workflows/ci.yml`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the PR.

- [ ] **Step 1: Write the failing test**

Create `tests/dist/assets.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { distFileExists } from "./helpers";

describe("shared assets", () => {
  it("includes the default link-preview image every page without its own falls back to", () => {
    expect(distFileExists("og/default.png")).toBe(true);
  });
});
```

Run: `npx vitest run tests/dist/assets.test.ts --config vitest.dist.config.ts --reporter=dot`
Expected: FAIL.

- [ ] **Step 2: Make the image from the home page**

With `npm run preview` running in another terminal:
```bash
mkdir -p public/og
npx -y playwright@1.64.1 install chromium
npx -y playwright@1.64.1 screenshot --viewport-size="1200,630" http://localhost:4321/ public/og/default.png
```
Open `public/og/default.png` and check it shows the hero (name, subtitle, buttons), not a blank or error page. Then stop the preview server, run `npm run build`, and re-run the Step 1 test. Expected: PASS.

- [ ] **Step 3: Pin Node and extend CI**

Create `.node-version` containing one line: `22.22.0`.

In `.github/workflows/ci.yml`, in **both** `actions/setup-node@v7` steps, replace `node-version: 22` with `node-version-file: .node-version`. In the `verify` job, after `- run: npm run build`, add:
```yaml
      - run: npm run test:dist
```

- [ ] **Step 4: Update the docs**

`CLAUDE.md`:
- Ground rule 1: replace the router paragraph with: "Static Astro site, no CMS, no backend. Pages are `/`, `/projects/:slug` (one per project with a case study) and the 404 page. Don't add a route shape without a page that needs it."
- Ground rule 2: replace `src/data/projects.ts` with "the project's frontmatter in `src/content/projects/<slug>/index.md`, validated by `src/lib/projects.ts`", and "edit the data entry" with "edit the frontmatter".
- Stack: "Astro (static, React components rendered at build time) + TypeScript, deployed to Cloudflare Pages (build command `npm run build`, output `dist`, Node from `.node-version`). Vitest + React Testing Library for unit tests; `npm run test:dist` checks the built HTML. oxlint for linting."
- Commands: add `npm run preview` and `npm run test:dist`.
- portfolio-updater section: it now edits frontmatter in `src/content/projects/`, not `src/data/projects.ts`.

`README.md`, "Adding a project": replace the paragraph with: "Create `src/content/projects/<slug>/index.md` with the frontmatter fields in `src/lib/projects.ts`. Leave the body empty for a card only; write a body to get a case-study page at `/projects/<slug>`."

Outside the repo (not committed): in `~/.claude/agents/portfolio-updater.md`, replace each mention of `src/data/projects.ts` with `src/content/projects/<slug>/index.md` (frontmatter only).

- [ ] **Step 5: Run the whole suite**

```bash
npm run typecheck
npm run lint
npx vitest run --reporter=dot
npm run build
npm run test:dist
```
Expected: each reports no errors; both Vitest runs end with all tests passed.

- [ ] **Step 6: Commit, push and open the PR**

```bash
git add -A
git commit -m "Add the default preview image, pin Node, and run the build-output tests in CI"
git push -u origin HEAD
gh pr create --title "Move the portfolio to Astro" --body-file <body file>
```
The PR body: what changed and why (spec link), the deviation note on `astro check`, the parity checklist from Task 4 Step 5, and the preview checks below, left unticked for Leonardo.

- [ ] **Step 7: Check the Cloudflare Pages preview**

On the PR's preview URL:
1. Load `/projects/satisfactory-dash` directly in a fresh tab, and refresh it. It shows the case study.
2. Load `/projects/satisfactory-dash/` (trailing slash). It reaches the case study, by redirect or directly.
3. Load `/no-such-page`. It shows "Page not found" with a working "Back home" link.
4. Paste the preview's case-study URL into https://www.opengraph.xyz and check that the title, description and poster image appear.
5. Open the preview on a phone. It looks like the live site does today.

If check 2 fails, add `public/_redirects` with the line `/projects/:slug/ /projects/:slug 301`, rebuild and recheck.
