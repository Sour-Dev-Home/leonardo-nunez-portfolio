# leonardo-nunez-portfolio

A simple personal portfolio site: Leonardo Nunez's projects, background, and contact
info, meant to be the permanent public home for showcasing finished project work from
this workspace (starting with `satisfactory-dash`).

This is a **public-facing** project per `../DEPLOYMENT.md` — public repo, hosted on
Cloudflare (a Worker serving static assets, in the same Cloudflare account as
satis-manager). See that file before changing repo visibility or hosting.

See `../WORKFLOW.md` for the cross-project branch/PR workflow, session roles, and the
GitHub setup checklist (branch protection gotchas, security baseline) — written from
this repo's own verified setup, since it's ahead of `satisfactory-dash` on most of it.

## Ground rules

1. **Simple by design.** Static Astro site, no CMS, no backend. Pages are `/`,
   `/projects/:slug` (one per project with a case study) and the 404 page; see
   `docs/superpowers/specs/2026-10-17-portfolio-overhaul-design.md` for why Astro.
   Don't add a route shape without a page that needs it — if a feature needs more
   than that, reconsider whether it belongs on this site before adding complexity.
2. **Projects are data, not prose.** Every project shown is the frontmatter of
   `src/content/projects/<slug>/index.md`, validated by `src/lib/projects.ts`. Never
   hand-edit project copy directly into JSX — edit the frontmatter instead, so the
   same structure works whether a human or the portfolio-updater agent (see below)
   makes the change. A file with a body gets a case-study page; one without is a card
   only.
3. **No PII or hardcoded local paths, with one deliberate exception.** This site
   intentionally displays Leonardo's real name, professional email
   (`soure393@gmail.com`), GitHub, and LinkedIn — that's the site's purpose, not a
   leak. Everything else follows the normal rule: no phone number, no other personal
   email, no absolute local filesystem paths (`C:\Users\...`) in anything committed.
   Bio content is written as portfolio copy sourced from `../about-me.md` (which stays
   outside this repo) — never commit `about-me.md` or the raw resume PDF here.
4. **Don't claim what isn't verified.** A project's `status`/`liveUrl` in its
   frontmatter should only say "shipped" or link to a live demo once that's
   actually true — checked, not assumed. Same principle as `satisfactory-dash`'s
   "cite or flag" rule, applied to portfolio claims instead of API claims.
5. **Never push directly to `main`.** `main` is wired to production hosting — a push
   there is instantly live on the public site. Work on a feature branch and open a PR
   instead; the host auto-builds a deploy-preview URL for every PR, and CI runs the
   same lint/typecheck/test/build gate on it. Review the preview URL (ideally via a
   Chrome-connected session, same as production verification) before merging. Only
   merge to `main` once the preview looks right and CI is green.

## Stack

Astro (static; React components rendered at build time, no client JavaScript yet) +
TypeScript, deployed as a Cloudflare Worker with static assets by Workers Builds
(build command `npm run build`, Node from `.node-version`; `wrangler.json` serves
`dist/` with a real 404 page and slashless URLs). Vitest + React
Testing Library for unit tests; `npm run test:dist` checks the built HTML (meta tags,
links, media sizes, JS budget, 404). Playwright (`e2e/`) checks every page at 360,
390, 768 and 1280 px: layout, axe, reduced motion, loading states and screenshots.
oxlint for linting. CI (`.github/workflows/ci.yml`) runs `verify`
(lint/typecheck/test/build/test:dist), `e2e` (Playwright in its official container,
screenshots included), `lighthouse` (mobile, ≥ 90) and `links` (lychee; also
nightly in `links.yml`) on every push and PR.

**Visual changes:** screenshot baselines in `e2e/__screenshots__/` are valid only
from the Playwright container. Never commit screenshots taken on Windows or macOS;
when a PR changes the look on purpose, run the **Update screenshots** workflow on
its branch, check the images in its `screenshots` artifact, and commit them.

## Commands

- `npm run dev` — dev server; `npm run preview` — serve the built `dist/`
- `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build`
- `npm run test:dist` — build-output tests (run after `npm run build`)
- `npm run test:e2e` — Playwright (needs a build; screenshot tests skip outside CI)
- `npm run lhci` — Lighthouse CI on the built site, mobile profile

## The portfolio-updater agent

See `~/.claude/agents/portfolio-updater.md` (user-global, not in this repo — it needs
to see sibling project repos too, and a workspace-root `.claude/agents/` was tried
first but never actually got discovered as an invocable agent, since `ReactApps/`
isn't itself a git repository). Its job: watch other projects in this workspace for
real, verifiable milestones and update the frontmatter in
`src/content/projects/<slug>/index.md` accordingly. Confirmed
discoverable via the Agent tool as of a fresh session, but not yet exercised on real
data — there's nothing to update until a
project ships something real.
