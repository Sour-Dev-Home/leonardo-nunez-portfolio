# Style guide

How this site looks, moves and sounds, and the rules that keep it from reading as
generated. Check new visuals against this file and the `/kit` page, which shows
every shared component. Decisions and their reasons are in
`docs/superpowers/specs/2026-10-17-portfolio-overhaul-design.md`.

## Direction

Editorial: a magazine, not a dashboard. Bold through type, rules and space, not
through effects. Each project can bring its own visual "world" to its case study;
the shell around it stays calm.

## Tokens (`src/design/tokens.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f3efe6` | `#17150f` | Page background |
| `--raised` | `#faf7f0` | `#211e17` | Code, empty stills |
| `--ink` | `#141414` | `#f3efe6` | Headings, nav (16:1) |
| `--ink-soft` | `#26241f` | `#ddd6c8` | Body text (13.5:1 / 12.6:1) |
| `--muted` | `#5c574f` | `#a59d8f` | Kickers, captions, stack tags (6.2:1 / 6.8:1) |
| `--accent` | `#b83a14` | `#f2794a` | Links, badges, the one colour (5.0:1 / 6.6:1) |
| `--rule` / `--rule-soft` | ink / `#d8d1c2` | cream / `#3a352b` | Hairlines between sections / within them |
| `--sticky` | `#ffe066` | same | Sidenotes only, always with `--sticky-ink` (14:1) |

Type steps `--step--1` to `--step-4` are fluid (`clamp()`), from 360 px phones to
1280 px desktops. Space steps `--space-1` to `--space-8`. Reading width
`--measure` (64ch); page width `--page`; side gutter `--gutter`. Motion:
`--dur-fast` (150 ms), `--dur` (250 ms), `--dur-slow` (600 ms), `--ease-out`,
`--ease-in-out`; all durations are 0 under reduced motion.

## Type

- **Fraunces** for headings and the brand only, always with
  `font-variation-settings: var(--display-axes)` (`SOFT 50, WONK 1`), weight 500.
- **Public Sans** for everything else.
- **Gochi Hand** only inside sidenotes.
- Fonts are files in `public/fonts/` with `font-display: optional`: never add a
  font from a CDN, and never switch to `swap` (a late font would reflow the page).

## Anti-AI rules

- No gradients, glass, blobs, glows or card shadows.
- No icon on every bullet; no three-card feature grids; no symmetric hero with a
  blob behind it.
- Hairline rules instead of boxes. The one exception is the callout.
- Every visual shows something real: a screenshot, a real diagram, a real number.

## Voice

Plain, first person, specific. Say what happened and what it cost. Opinions are
welcome; hedging and hype are not. Banned: "leverage", "seamless",
"cutting-edge", "passionate", "delve", "robust solution", "in today's fast-paced
world", and anything that could describe anyone.

## Sidenotes

- About three per article at most, short, in the author's own voice.
- Each one traces to something that really happened, and Leonardo approves it.
- Put the `<Sidenote>` **right before the paragraph it's about**: on wide screens
  it floats into the margin beside the next paragraph.
- Only use it where the margin is free (case-study prose), not inside the
  two-column section grid; the overflow test fails if a note pushes off the page.

## Motion

- `.reveal`: sections fade and rise in on load, staggered by position.
- Page-to-page cross-fade with CSS view transitions (`@view-transition`).
- Both turn off under reduced motion. No JavaScript.
- Anything new must pass the loading-state tests (`e2e/loading.spec.ts`): nothing
  may overlap mid-load or at 0, 50 or 100% of an animation, and media must reserve
  its space (`width` and `height` on every image and video).

## Components

- `ProjectCard` (`src/components`): `project`. A grayscale still that colours on
  hover or focus; a typographic still without an image; compact for secondary
  projects.
- `Aside` (`src/design/components`): optional `title`. Context worth knowing.
- `Callout`: `kind` `"note"` or `"warning"`.
- `Figure`: `caption`; the image goes in the slot, with `width` and `height`.
- `Sidenote`: unique `id`, optional `lead` (the small line above the note).
- `CaseStudy` (`src/layouts`): `project`, `slug`; the article goes in the slot.

## References

- Josh W. Comeau's site: interactive articles, a warm voice, asides.
- Lynn Fisher's archive list: grayscale images that colour on hover.
