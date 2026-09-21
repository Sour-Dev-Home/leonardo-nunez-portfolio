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

Netlify (`netlify.toml` sets the build command and publish directory — connect the
repo in the Netlify dashboard, no extra config needed).

## Adding a project

Edit `src/data/projects.ts` — add a `Project` entry. Don't hand-edit `Projects.tsx`
for content; it just renders whatever's in the data file.
