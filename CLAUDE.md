# leonardo-nunez-portfolio

A simple personal portfolio site: Leonardo Nunez's projects, background, and contact
info, meant to be the permanent public home for showcasing finished project work from
this workspace (starting with `satisfactory-dash`).

This is a **public-facing** project per `../DEPLOYMENT.md` — public repo, Cloudflare
Pages hosting (migrating from Netlify). See that file before changing repo visibility
or hosting.

## Ground rules

1. **Simple by design.** Single-page, plain client-side React (hooks, components) — no
   router, no CMS, no backend. If a feature needs more than that, reconsider whether
   it belongs on this site before adding complexity.
2. **Projects are data, not prose.** Every project shown lives in `src/data/projects.ts`
   as a `Project` entry. Never hand-edit project copy directly into JSX — add or update
   the data entry instead, so the same structure works whether a human or the
   portfolio-updater agent (see below) makes the change.
3. **No PII or hardcoded local paths, with one deliberate exception.** This site
   intentionally displays Leonardo's real name, professional email
   (`soure393@gmail.com`), GitHub, and LinkedIn — that's the site's purpose, not a
   leak. Everything else follows the normal rule: no phone number, no other personal
   email, no absolute local filesystem paths (`C:\Users\...`) in anything committed.
   Bio content is written as portfolio copy sourced from `../about-me.md` (which stays
   outside this repo) — never commit `about-me.md` or the raw resume PDF here.
4. **Don't claim what isn't verified.** A project's `status`/`liveUrl` in
   `src/data/projects.ts` should only say "shipped" or link to a live demo once that's
   actually true — checked, not assumed. Same principle as `satisfactory-dash`'s
   "cite or flag" rule, applied to portfolio claims instead of API claims.
5. **Never push directly to `main`.** `main` is wired to production hosting — a push
   there is instantly live on the public site. Work on a feature branch and open a PR
   instead; the host auto-builds a deploy-preview URL for every PR, and CI runs the
   same lint/typecheck/test/build gate on it. Review the preview URL (ideally via a
   Chrome-connected session, same as production verification) before merging. Only
   merge to `main` once the preview looks right and CI is green.

## Stack

Vite + React + TypeScript, deployed to Cloudflare Pages per `../DEPLOYMENT.md` (build
command `npm run build`, output directory `dist`). Vitest + React Testing Library for
tests; oxlint for linting. CI (`.github/workflows/ci.yml`) runs
lint/typecheck/test/build on every push and PR.

## Commands

- `npm run dev` — dev server
- `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build`

## The portfolio-updater agent

See `../.claude/agents/portfolio-updater.md` (workspace root, not in this repo — it
needs to see sibling project repos too). Its job: watch other projects in this
workspace for real, verifiable milestones and update `src/data/projects.ts`
accordingly. Designed but not yet exercised — there's nothing to update until a
project ships something real.
