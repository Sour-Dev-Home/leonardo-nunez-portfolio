# leonardo-nunez-portfolio

Personal portfolio site — background, projects, and contact info. See `CLAUDE.md` for
the working rules Claude Code follows in this project.

## Getting started

```bash
npm install
npm run dev
```

## Commands

- `npm run dev` — dev server; `npm run preview` — serve the built site
- `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build`
- `npm run test:dist` — checks the built HTML (run after `npm run build`)
- `npm run test:e2e` — Playwright at four screen widths (needs a build)
- `npm run lhci` — Lighthouse CI, mobile profile (needs a build)

## Visual changes

CI compares screenshots of every page (loaded, while media loads, and halfway
through animations) at four widths against `e2e/__screenshots__/`. The baselines
come only from the Playwright container CI uses, so fonts never differ. When a PR
changes the look on purpose:

1. Run **Actions → Update screenshots** on the PR's branch.
2. Download its `screenshots` artifact into `e2e/__screenshots__/` and look at the
   images.
3. Commit and push them. (A push by a person re-runs CI; one by the workflow would
   not.)

## Deployment

Live at [leonardonunez.dev](https://leonardonunez.dev).

A Cloudflare Worker serving static assets, built and deployed by Workers Builds on
every push to `main` (build command `npm run build`, Node version from
`.node-version`). `wrangler.json` points the Worker at `dist/`, serves `404.html` for
unknown paths and redirects `/path/` to `/path`.

## Adding a project

Create `src/content/projects/<slug>/index.md` with the frontmatter fields in
`src/lib/projects.ts`. Leave the body empty for a card only; write a body to get a
case-study page at `/projects/<slug>`.
