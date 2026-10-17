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

Cloudflare Pages — build command `npm run build`, output directory `dist`, Node
version from `.node-version`. Connect the repo in the Cloudflare dashboard (Workers &
Pages → Create → Pages → Connect to Git); no other config file is needed.

## Adding a project

Create `src/content/projects/<slug>/index.md` with the frontmatter fields in
`src/lib/projects.ts`. Leave the body empty for a card only; write a body to get a
case-study page at `/projects/<slug>`.
