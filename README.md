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

## Deployment

Live at [leonardo-nunez-portfolio.pages.dev](https://leonardo-nunez-portfolio.pages.dev).

A Cloudflare Worker serving static assets, built and deployed by Workers Builds on
every push to `main` (build command `npm run build`, Node version from
`.node-version`). `wrangler.json` points the Worker at `dist/`, serves `404.html` for
unknown paths and redirects `/path/` to `/path`.

## Adding a project

Create `src/content/projects/<slug>/index.md` with the frontmatter fields in
`src/lib/projects.ts`. Leave the body empty for a card only; write a body to get a
case-study page at `/projects/<slug>`.
