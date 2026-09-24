## The problem

Satisfactory players who run a dedicated server can't see their factory's state without joining
the game. The data exists in two places, the game's own HTTPS API and a community mod (FRM) that
exposes factory and power data. Both are undocumented in the places that matter (units, sign
conventions, what "0" means), and FRM speaks only plain HTTP. So the project had two problems:
getting correct data out, and never exposing the game server itself to the internet.

## See it running

The [live demo](https://demo.satis-manager.com) runs the real dashboard against a made-up factory,
with no sign-in and no connection to the real API. This is a one-minute tour of it.

<figure class="diagram-frame">
<video controls playsinline preload="none" poster="/demo/satisfactory-dash-walkthrough-poster.png" aria-describedby="demo-video-caption">
<source src="/demo/satisfactory-dash-walkthrough.mp4" type="video/mp4">
</video>
<figcaption id="demo-video-caption">A 64-second screen recording of the demo. There is no audio.</figcaption>
</figure>

<details>
<summary>Text description of this video</summary>
<p>The recording starts on the demo's entry screen, which explains that the factory is made up and needs no sign-in, and clicks Enter demo. The Overview page shows all systems operational: a server with 3 of 4 players connected, two power circuits drawing 4,232.5 MW of 6,150 MW capacity, and 9 factory machines with 1 backed up. The Power tab shows each circuit's production, consumption, capacity, peak demand and battery state, with a chart of the last five minutes. The Factory tab lists every machine with its recipe and output rate, and marks a Rotor assembler as backed up. The Settings tab ticks the auto-pause option, and the page shows the change as pending until the server applies it. The tour ends back on the Overview page. A banner across the top of every screen says the data is not live.</p>
</details>

## Architecture

<figure class="diagram-frame">
<a href="/diagrams/satisfactory-dash-deployment.svg" target="_blank" rel="noreferrer">
<img src="/diagrams/satisfactory-dash-deployment.svg" alt="C4 deployment diagram: Cloudflare hosts the web app as Workers static assets and fronts api.satis-manager.com with TLS and a WAF login rate limit. On the owner's gaming PC, cloudflared runs an outbound-only tunnel that forwards over loopback HTTP to the Node.js backend API, which reads the Satisfactory dedicated server's HTTPS API and the FRM mod's HTTP API, both on loopback.">
</a>
<figcaption>Deployment today, generated from the Structurizr model that CI validates on every change. Click to view full size.</figcaption>
</figure>

<details>
<summary>Text description of this diagram</summary>
<p>The browser reaches the web app, served as static assets from Cloudflare Workers, over HTTPS. The web app calls api.satis-manager.com, which terminates TLS and enforces a WAF login rate limit, then routes traffic through an outbound-only Cloudflare Tunnel to cloudflared, running on the owner's gaming PC. cloudflared forwards over loopback HTTP to the backend API (Node.js, Express, TypeScript), which authenticates every request and validates every response against the shared zod contract. The backend reads and writes the Satisfactory dedicated server's HTTPS API (port 7777, application token) to read server state and toggle auto-pause, and reads the Ficsit Remote Monitoring (FRM) mod's HTTP API (port 8080, loopback only) for factory, power, and building data.</p>
</details>

<figure class="diagram-frame">
<a href="/diagrams/satisfactory-dash-backend-modules.svg" target="_blank" rel="noreferrer">
<img src="/diagrams/satisfactory-dash-backend-modules.svg" alt="C4 component diagram of the backend modular monolith: the web app calls identity (sign-in and sessions), servers (server discovery), telemetry (status, power history, factory) and settings (auto-pause). Telemetry and settings resolve the requested server through servers and reach the game only through the gameserver module, the one component that calls the game and FRM APIs.">
</a>
<figcaption>Backend modules. CI checks these boundaries against the real imports. Click to view full size.</figcaption>
</figure>

<details>
<summary>Text description of this diagram</summary>
<p>The backend is a modular monolith of five components, and a CI test checks these dependency boundaries against the real imports. The web app signs in and out through identity, which manages sessions, a logout denylist, and login rate limits. It discovers available servers through servers, the server registry. It reads status, power history, and factory data through telemetry, and reads and toggles auto-pause through settings — both telemetry and settings first resolve the requested server through servers. Neither talks to the game directly: only gameserver calls the Satisfactory dedicated server's HTTPS API (port 7777) and the FRM mod's HTTP API (port 8080, loopback), through vanilla and FRM clients built on shared zod schemas.</p>
</details>

These diagrams aren't hand-drawn — they're rendered from a
[C4 model](https://github.com/Sour-Dev-Home/satisfactory-dash/blob/main/docs-vault/workspace.dsl)
(Structurizr DSL) that CI validates on every change, with an ADR recording each decision.

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
- **Decisions are recorded.** Twenty-eight architecture decision records document context,
  trade-offs and the specific trigger that would reopen each one.

## What's next

- **A live factory map** with buildings at their in-game positions, which FRM already reports.
- **Accounts, in progress.** An accepted ADR adds Postgres and Google sign-in so more than one
  person can use the dashboard, closed to invited emails at first. Postgres runs locally on the
  game PC to start, no new network exposure and no added cost; multi-server config and the
  database foundation are already merged.
- **Multiple users and AWS.** The planned path is a modular monolith now, then a few coarse
  services, with a small agent next to each game server pushing data outbound. That removes any
  need to reach into a user's network. AWS comes in only when managed hosting is needed.

## Links

<ul class="link-list">
<li><a href="https://demo.satis-manager.com">Try the live demo</a></li>
<li><a href="https://github.com/Sour-Dev-Home/satisfactory-dash">Repository</a></li>
<li><a href="https://satis-manager.com">Live site</a></li>
<li><a href="https://github.com/Sour-Dev-Home/satisfactory-dash/tree/main/docs-vault/wiki/decisions">Architecture decisions</a></li>
</ul>
