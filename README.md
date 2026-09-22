# leonardo-nunez-portfolio

Personal portfolio site — background, projects, and contact info. See `CLAUDE.md` for
the working rules Claude Code follows in this project.

## Getting started

```bash
npm install
npm run dev
```

## Commands

- `npm run dev` — dev server
- `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build`

## Deployment

Live at [leonardo-nunez-portfolio.pages.dev](https://leonardo-nunez-portfolio.pages.dev).

Cloudflare Pages — build command `npm run build`, output directory `dist`. Connect
the repo in the Cloudflare dashboard (Workers & Pages → Create → Pages → Connect to
Git), no config file needed for a build this simple.

## Adding a project

Edit `src/data/projects.ts` — add a `Project` entry. Don't hand-edit `Projects.tsx`
for content; it just renders whatever's in the data file.
