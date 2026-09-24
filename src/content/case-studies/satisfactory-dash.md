## The problem

Satisfactory players who run a dedicated server can't see their factory's state without joining
the game. The data exists in two places, the game's own HTTPS API and a community mod (FRM) that
exposes factory and power data. Both are undocumented in the places that matter (units, sign
conventions, what "0" means), and FRM speaks only plain HTTP. So the project had two problems:
getting correct data out, and never exposing the game server itself to the internet.

## Architecture

<figure class="diagram-frame">
<img src="/diagrams/satisfactory-dash-architecture.svg" alt="Architecture diagram: the browser reaches the Cloudflare Worker frontend over HTTPS; an outbound-only Cloudflare Tunnel carries HTTPS plus a session cookie to the Node/Express backend on the game PC, which talks to the game server and FRM mod only over loopback; frontend and backend share one zod-validated contract package.">
<figcaption>Browser → Cloudflare Worker (static SPA) → outbound-only Tunnel → Express backend, loopback-only to the game server and FRM mod.</figcaption>
</figure>

<details>
<summary>Text description of this diagram</summary>
<p>The browser reaches satis-manager.com over HTTPS, served by a Cloudflare Worker as static files. HTTPS plus a session cookie reaches api.satis-manager.com through an outbound-only Cloudflare Tunnel. That tunnel carries requests to the backend, a Node and Express server running on the same PC as the game server, bound to localhost. The backend talks to the game server's HTTPS API and the FRM mod's HTTP API, both over loopback only. A shared zod-validated contract package sits between the frontend and backend so both sides agree on the shape of every request and response.</p>
</details>

The frontend is a React single-page app served as static assets from Cloudflare. The backend runs
on the same PC as the game server and talks to it only over loopback. It refuses to start if
pointed at a public FRM host. Public access to the API goes through an outbound-only Cloudflare
Tunnel, so no router ports are opened. As of 2026-09-24 the tunnel is live end to end: the site
signs in against the real API and shows live game data, and it passed go-live tests for CORS,
security headers, IP-spoofing resistance, and the login rate limit. Frontend and backend share one
runtime-validated contract package.

## Key decisions

- **Server-scoped routes before a second server exists**. Every data route is
  `/api/servers/:serverId/...`, and a single server is a "registry of one". Adding a second
  server becomes a configuration change instead of a rewrite of every URL the frontend knows.
  <span class="tradeoff"><span class="tradeoff-label">Trade-off</span>One extra indirection and an id in every request, today.</span>
- **A zod contract as the single source of truth**. Types are inferred from runtime
  schemas in `packages/shared`. The frontend parses every response, and the backend validates every
  response it sends and transmits only the parsed output. Drift fails in CI or loudly at
  runtime, never silently in the UI, and an accidental internal field can't leak.
  <span class="tradeoff"><span class="tradeoff-label">Trade-off</span>A little CPU per response.</span>
- **A snapshot envelope with staleness**. Every data response is
  `{ serverId, observedAt, stale, data }`, and the backend decides `stale`. Moving from live
  calls to a background poller later needs no frontend change.
  <span class="tradeoff"><span class="tradeoff-label">Trade-off</span>A wrapper around data that is always fresh today.</span>
- **Units verified against the live game**. Units and sign conventions were checked
  against a populated save and the in-game UI before being written into field names
  (`productionMW`, `batteryCapacityMWh`). The captures also exposed a real mapping bug: the
  "backed up" detector required a machine to still be producing, so it never fired — 0 of 71
  backed-up machines were detected on the captured save before the fix.
  <span class="tradeoff"><span class="tradeoff-label">Trade-off</span>Renames were done early, while there were no consumers yet.</span>
- **Login before exposure**. Every API route except health needs a signed, httpOnly
  session cookie. Login is rate-limited per client, and cross-site mutations are refused.
  The repository and frontend are public; the API must not be.
  <span class="tradeoff"><span class="tradeoff-label">Trade-off</span>Stateless 12-hour sessions, where revocation means rotating the signing secret,
  accepted for a single operator.</span>
- **No database and no cache until a trigger fires**. Requests go straight
  to the game server. That was measured before deciding against caching: about 25 ms for the
  factory call, well under the 463 KB raw upstream payload it's built from. Postgres is
  pre-decided for when history or user accounts are needed.
  <span class="tradeoff"><span class="tradeoff-label">Trade-off</span>Game-server load grows with viewers until then.</span>

## How it's built

- **Contract-first sequencing.** The shared contract merged before the backend or frontend
  consumed it, and each breaking change was staged in its own PR. The frontend was built
  against mocked responses generated from the same fixtures the backend tests use.
- **Independent bug hunts.** A reviewer with no context from the implementation hunts for bugs
  in each change. Examples:
  - In the auto-pause toggle it found that a rapid double click sent two writes to the game
    server.
  - A retroactive sweep of the frontend added 30 tests and fixed 2 bugs, each proven by a test
    that failed before the fix.
- **Security reviews gate exposure.** The login work had a dedicated security review, whose
  low-severity findings were fixed before any public exposure. The findings covered cross-site
  logout, a password-hash parameter bound, and usernames in logs. The tunnel checklist included
  a test proving spoofed client-IP headers aren't trusted.
- **CI and required checks.** Every PR runs lint, typecheck, tests and a production build. A
  ruleset on `main` requires that job to pass before merging; a separate practice (not CI-enforced)
  runs an independent test-hunter subagent over any PR that changes real logic before it's marked
  ready for review.
- **A leak check that proved itself.** CI scans every change for personal identifiers and local
  paths. The scan's patterns were later moved into a repository variable, so the public workflow
  no longer lists what it protects, and a hit reports only file and line.
- **Decisions are recorded.** Nineteen architecture decision records document context,
  trade-offs and the specific trigger that would reopen each one.

## What's next

- **A live factory map** with buildings at their in-game positions, which FRM already reports.
- **Multiple users and AWS.** The planned path is a modular monolith now, then a few coarse
  services, with a small agent next to each game server pushing data outbound. That removes any
  need to reach into a user's network. Postgres and AWS come in only when a second user or
  managed hosting requires them.

## Links

<ul class="link-list">
<li><a href="https://github.com/Sour-Dev-Home/satisfactory-dash">Repository</a></li>
<li><a href="https://satis-manager.com">Live site</a></li>
<li><a href="https://github.com/Sour-Dev-Home/satisfactory-dash/tree/main/docs-vault/wiki/decisions">Architecture decisions</a></li>
</ul>
