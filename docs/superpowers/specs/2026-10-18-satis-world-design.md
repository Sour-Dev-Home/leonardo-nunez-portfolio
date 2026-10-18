# The satis-manager world (Plan 4) — design

Date: 2026-10-18. Parent spec: `2026-10-17-portfolio-overhaul-design.md` (Section 5 is this page's
first outline; where the two differ, this one wins). Approved prototypes, kept as the build's
reference: `2026-10-18-satis-world/` (`cover.html`, `figure-outage.html`, `figure-cutover.html`).

## 1. Goal

One case study, `/projects/satisfactory-dash`, for hiring managers hiring developers. A reader
should leave believing one thing: **this person runs production systems carefully**. The move from
a home PC to AWS is the centerpiece; the architecture supports it.

Decisions (owner, 2026-10-18):

- Takeaway: "ships production systems", over design, AI workflow or full-stack range.
- Length: short with expandable detail: about 1,000 words in the main read (4 to 5 minutes), with
  deeper material in collapsible "More detail" sections.
- Cover: option A, the system running, revised (v2) so wires keep clear of the stations and orbs
  appear from behind a station, never on top of it.
- Figures: in the style of Sam Rose (samwho.dev and the encore.dev queueing post): real behaviour,
  the reader in control, prose that names each mark. Both figures approved as prototyped.
- Colours: **deferred**. The world's palette depends on the finished article; every colour in the
  prototypes is a placeholder (Section 8).

## 2. The article

MDX (`src/content/projects/satisfactory-dash/index.mdx`), on the `CaseStudy` layout, after the
cover. Main read, in order:

1. **The problem** (about 120 words). A dashboard for Satisfactory dedicated servers; the backend
   and database ran on the owner's gaming PC, which was out of memory and not meant to be a server.
2. **How data gets in** (about 200 words + figure 1). The agent on the game PC reads the game over
   loopback and pushes snapshots out to the backend; the PC never accepts inbound connections.
   Availability over consistency (below).
3. **The move to AWS** (about 350 words + figure 2). The constraints (credits on AWS's Free plan,
   the budget alarm, portability as a hard requirement), then the cutover, step by reversible step.
4. **What I'd do differently, and what's next** (about 150 words). The planned exit from AWS when
   the credits run out (the `compose.yaml` path), and what was learned.
5. **How it was built** (about 100 words). Built with Claude Code through lanes, reviewed by me;
   links to the lanes repo (its own case study comes later).

"More detail" (`<details>`, closed by default, a styled `Aside` inside): the security posture
(OIDC with PKCE, secrets sealed at rest, the SSRF guard, the audit trail), the ADR count, the CI
gates, the backup encryption and Object Lock. Content that's in today's case study moves here.

**Availability versus consistency** (the paragraph under figure 1, approved wording to adapt):

> When the link breaks, something has to give. The system picks availability: the dashboard keeps
> answering with the last snapshot it has, marked stale, rather than going blank, and the agent keeps
> collecting. The cost is consistency: history arrives late, and if the outage outlasts the queue,
> the oldest readings are dropped for good. For a live dashboard, the newest data matters most.

### Claims and their sources

Every claim links to its source in the public repo (`github.com/Sour-Dev-Home/satisfactory-dash`).
Nothing unmeasured (no uptime percentages). The ones the figures and text rely on:

| Claim | Source (repo path) |
|---|---|
| The agent pushes out; the cloud never polls the PC; tokens stay on the PC | ADR-0031 (`docs-vault/wiki/decisions/0031-edge-agent.md`), ADR-0034 §1 |
| A bounded queue that drops the oldest; "a dashboard wants the newest readings" | `agent/src/queue.ts` |
| The head is sent with `peek()` and kept until accepted; it can be dropped while in flight | `agent/src/pusher.ts` |
| Transient errors (network, timeout, 5xx, 429) retry; 401 stops; Retry-After honoured | `agent/src/pusher.ts`, `agent/src/backendClient.test.ts` |
| Backoff 1 s to 60 s, exponential, "equal jitter" | `agent/src/backoff.ts` |
| Queue of 120 snapshots, about ten minutes at the fastest cadence | `agent/src/agentRunner.ts` (`QUEUE_MAX_SNAPSHOTS`) |
| Outage, bounded queue, oldest-first recovery are tested | `agent/src/agentRunner.test.ts` |
| The dashboard marks old data stale (from the backend's flag, not the PC clock) | `frontend/src/components/DataAge.tsx`, ADR-0004 |
| ECS checks liveness only; readiness (database) is for an external monitor (#425) | `infra/aws/ecs.tf`, `backend/src/platform/health.ts`, `docs-vault/wiki/log.d/2026-10-17-issue-425-ecs-liveness.md` |
| Fargate (ARM, one task) with a cloudflared sidecar; RDS PostgreSQL 18; no load balancer | ADR-0034 §2 |
| About $33 a month estimated; the budget alarm is at **$40** (not $35, as the parent spec had it) | ADR-0034 §2, `infra/aws/variables.tf` (`monthly_budget_usd`) |
| Backups leave AWS: Backblaze B2, Object Lock, a write-only key | ADR-0035 |
| The cutover steps and each rollback | `docs-vault/wiki/runbooks/aws.md` (Cutover) |

The draft re-checks each against the repo at the commit it links to; a claim that can't be linked
is cut.

### Sidenotes

Two or three, from real events, in the owner's voice; the owner approves, edits or vetoes each.
Candidates (to confirm):

- **#425:** the first ECS health check watched readiness, which would have replaced a healthy
  backend about 90 s into every RDS restart (weekly maintenance). Caught in review, before the
  cutover. Documented in the log entry above.
- **The tunnel:** deleting the production tunnel instead of its route during the cutover (from the
  parent spec; the owner confirms the details, as no log entry records it).
- **A stale saved Terraform plan** refused at apply time during the move ("Saved plan is stale"),
  which turned out to mean the apply had already happened. Owner confirms.

## 3. The cover

Option A v2 (`2026-10-18-satis-world/cover.html`): kicker, title, one line ("A live dashboard for
Satisfactory servers, moved from a home PC to AWS"), and a schematic of the real system with a few
orbs flowing through it.

- The same stations and icons as figure 1, so the cover reads as a quiet preview of it.
- Orbs are drawn under the stations: they leave from behind one and disappear into the next. Wires
  turn in the gaps between stations, clear of their edges.
- **No JavaScript**: CSS motion (`offset-path`), two or three orbs, slow. Under reduced motion it's a
  still frame. It sits above the fold, so it must not shift layout or delay the largest paint.
- The work-card cover and the link-preview image are stills of it, rendered to PNG at build time
  (sharp rasterises the SVG): `cover` 1600 × 900 and `ogImage` 1200 × 630.

## 4. The figures

### The standard (both figures)

- **Real behaviour, not a script.** A figure is a small model of the system with the same rules as
  the code it cites. Only time is scaled, and the article says so.
- **One meaning per mark, named in the prose.** The paragraph before a figure introduces each mark
  as a coloured inline word with its glyph (● snapshot, ● error, ○ dropped, ━ route, ■ final
  backup). No legend under the figure.
- **The reader is in control.** A control bar attached under the figure: icon buttons (reset,
  play/pause), a tortoise-to-hare speed slider (filled track, round thumb that grows on hover and
  drag, continuous, the speed eases to its new value), and the figure's own actions as labelled
  toggles. Where it's natural, the station itself is clickable too.
- **Goals**: a short checklist above the figure that ticks itself as the reader does each thing.
- **Stations are icons**, flat and simple, on a disc of their panel's colour: the disc hides the
  wires behind it, also when a station is dimmed (dim the icon and label, never the disc).
- **Motion follows animation principles**: slow in and slow out on every move, anticipation before a
  send, squash and stretch at speed and on landing, a damped settle, overlapping action when a line
  moves up, gravity for anything that falls.
- **Red means failure, only.** Something stopped on purpose dims; it doesn't turn red.
- **Nothing overlaps a label**: no line, orb path or icon crosses any text, in any state, including
  mid-animation (tested, Section 6).

### Figure 1 · when the backend goes down

Prototype: `figure-outage.html` (v6). Stations: Agent (game PC) → Queue (on the PC) → Tunnel
(Cloudflare) → Backend (ECS Fargate) → PostgreSQL (RDS).

- Every snapshot visibly travels from the PC into the back of the queue and rests there for a
  moment (about 200 ms) before it may leave.
- The model, rule for rule with the agent's code: a bounded queue that drops the oldest on a full
  push; the head is sent and keeps its place (a dashed outline holds it) until accepted; an error
  keeps it at the head and the next try waits `backoff(failures)`, exponential with equal jitter and
  a cap; success resets the waits and the next send follows at once; a snapshot dropped while in
  flight falls away when its error returns.
- Two failures the reader can cause: **backend down** (the error comes back from the tunnel, as
  Cloudflare answers) and **database down** (it comes back from the backend; the caption explains
  liveness versus readiness).
- No numbers on screen (no queue counts); the queue shows twelve places for the real 120.
- Goals: watch snapshots wait; keep it down until one is dropped; bring it back and watch the
  backlog drain; take only the database down.

### Figure 2 · the cutover

Prototype: `figure-cutover.html` (v5). Panels: Gaming PC (agent, backend, PostgreSQL), Off-site
backups (Backblaze B2), Cloudflare (the tunnel for `api.satis-manager.com`), AWS (Fargate backend,
RDS).

- A stepper over the runbook: Freeze → Back up → Restore → Start → Switch, shown as a track of named
  steps joined by small arrows that fill as each completes. No step numbers anywhere.
- Each step changes the drawing as the runbook does: the agent and PC backend dim (frozen); the
  final dump travels from the PC database to B2; it's restored into RDS and a ✓ badge confirms the
  row counts; the Fargate backend lights; the route retracts from the PC backend into the tunnel and
  draws out to the AWS backend (it never sweeps across the stations between).
- Snapshots flow agent → tunnel → route → backend → that backend's database whenever the agent
  runs.
- Roll back reverses the drawing and shows the runbook's rollback for that step.
- Goals: step all the way to the switch; roll a step back and read what it undoes.

## 5. Architecture

- **MDX** (`@astrojs/mdx`, already installed) so the article can place the figures, sidenotes and
  asides inline. The frontmatter keeps `projectSchema`; `world: true` turns on the world styles.
- **Each figure is an Astro component plus a small TypeScript module, not a React island.** The
  component renders the figure's first frame (SVG, controls, goals) as HTML at build time, so it has
  its size and content before any JavaScript runs (no layout shift). The module, loaded when the
  figure scrolls into view (`IntersectionObserver`, then a dynamic `import()`), wires up the
  controls and runs the model. React's client runtime alone is about 45 KB gzipped; these figures
  need none of it (Sam Rose's figures make the same choice with Lit). React stays a build-time
  renderer only, as it is today.
- **Model and drawing are separate.** `src/worlds/satis/model/outage.ts` and `cutover.ts` are pure
  state machines (`step(state, dt, random) → state`), with no DOM, so they're unit-tested. The
  drawing code only renders state and handles input. The model files cite the agent's source paths
  next to each rule, and their tests assert those rules.
- **Shared figure kit** in `src/design/figure/`: the control bar, slider, goals list, tween and
  easing helpers, and the squash-and-stretch transform. The next world reuses it.
- **No animation library.** The parent spec planned Motion (Section 4). The simulation needs its own
  frame loop anyway, and the easing and tween helpers are about forty lines; Motion would add
  JavaScript to do what those lines do. **For the owner's review:** this replaces the parent spec's
  Motion plan; Motion comes back only when a figure needs what the helpers can't do.
- **JavaScript budget:** the case-study page gets its own budget, 15 KB gzipped for both figures
  and the kit (the prototypes' logic is well under that); every other page stays at zero
  JavaScript, as tested today.

## 6. Phones, reduced motion and accessibility

- **Phones are a hard requirement.** Below about 40rem each figure switches to its own vertical
  composition (stations top to bottom; figure 2's panels stacked), not a scaled-down desktop
  drawing. These are new layouts: they get a companion review round with the owner during the build,
  before baselines.
- **Reduced motion:** no autoplay; figures open paused on a meaningful frame, every tween runs in
  zero time, and every control still works (the stepper steps, the toggles toggle). The cover is a
  still frame.
- **Accessibility:** each figure has a text description of what it shows; controls are real buttons
  with labels and visible focus; toggles use `aria-pressed`; the caption is the live explanation
  (polite, and only on a state change, not every frame).

## 7. Testing

- **Unit (Vitest):** the models: drop-oldest, the held head and drop-in-flight, backoff bounds and
  jitter, reset on success, oldest-first drain; the cutover's states and rollbacks.
- **e2e (Playwright, four widths):** figures render before their script runs, at their final size; controls
  work from the keyboard; reduced motion opens paused; goals tick; the existing loading-state and
  overlap tests cover the page.
- **No line or path crosses a label** (new, from the review): sample every drawn line and orb path
  and test it against every text box, in every state and mid-animation. This caught two bugs in the
  prototypes; it becomes a standing test for every figure.
- **Visual baselines** of each figure's paused states, light and dark.
- **Build checks:** every link in the article resolves; the cover still and link-preview image exist
  at their sizes; the case-study page meets its JavaScript budget.

## 8. Colour (deferred)

The world palette is chosen in one round once the article is drafted, with the figures in place,
from the owner's reaction to the whole page. Until then colours live in world-scoped tokens
(`--satis-*`), so the round changes values, not components. The roles are fixed now: route,
snapshot, error, dropped, backup, and one tint per area; red is failure only.

## 9. Folded in from PR #36's minors

The sidenote toggle's accessible name includes "psst"; the reveal staggers inside case studies;
the font test checks width as well as height; the Public Sans italic is preloaded where articles use
it; the nav marks the current page with `aria-current`; `.prose` contains its floats
(`display: flow-root`).

## 10. The owner's part

About ten minutes for the draft (read the preview, flag anything wrong or off-voice), approve or
veto each sidenote, the phone-layout round for the figures, and the palette round.

## Out of scope

The lanes case study, Remotion videos, adopting lanes in this repo (all Phase 2); live data in the
figures (they are models, not dashboards); a third figure.
