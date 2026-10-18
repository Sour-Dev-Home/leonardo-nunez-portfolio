---
name: leonardonunez.dev
summary: >-
  This site: static Astro, JavaScript only for figures, every PR checked for layout, loading and visual bugs at 4 widths.
description: >-
  This portfolio, built with Claude Code and reviewed by me: a static Astro site with React components rendered at build time and JavaScript only where an interactive figure needs it (a 15 KB budget per page, none elsewhere), served as a Cloudflare Worker with long-lived caching for hashed assets and hover prerendering in Chrome. Every pull request runs Playwright at 360, 390, 768 and 1280 px (layout, overlapping content while media and animations load, axe accessibility checks in light and dark mode, and screenshot comparisons made in Playwright's official container), a mobile Lighthouse gate, a link checker and CodeQL.
status: shipped
stack: [Astro, TypeScript, CSS, Playwright, Vitest, Cloudflare Workers]
repoUrl: https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio
emphasis: secondary
order: 3
---
