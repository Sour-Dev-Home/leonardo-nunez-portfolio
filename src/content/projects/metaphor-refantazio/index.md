---
name: "Metaphor: ReFantazio accessibility mod"
summary: >-
  An accessibility mod for blind players of Metaphor: ReFantazio, built with AI agents, a merge queue and security-review gate.
description: >-
  An open-source, single-player mod and reverse-engineering notebook for Metaphor: ReFantazio on PC, a game on a proprietary engine with no built-in screen-reader support found. The project's emphasis is how it is built and delivered. One check command (scripts/check.sh) runs from git hooks and from GitHub Actions; pull requests run fast Linux checks, and a merge queue re-runs the full Windows gate before a squash merge to main. Changes to hook code and to the guards themselves need a security-review stamp that CI verifies by commit trailer, and outside pull requests need a maintainer-applied label. The supply chain is pinned: actions are pinned by commit SHA and restricted to GitHub's own actions and the Scorecard action, and Dependabot, CodeQL, a weekly OpenSSF Scorecard and secret scanning with push protection are on. The maintainer works with AI coding agents under a written workflow (claim, branch, tests first, staged hand-back for security review, auto-merge into the queue), a Sonnet/Opus model split, triage labels, and decisions recorded in issues. The mod loads through Reloaded-II, finds game functions by byte signatures pinned to an exact game build (the SHA-256 of the executable), and installs hooks only when the running build matches. Hook code is a thin Windows-only layer; feature logic lives in plain .NET libraries that architecture tests keep free of Windows APIs, raw memory and networking. Every feature hands its announcements to one announcer, which speaks through Prism (NVDA, JAWS, ZoomText, OneCore, SAPI) and, in dev builds, writes a transcript. Dialogue lines and choices, and the title menu's focus, are spoken. Every engine claim cites a saved source or is flagged; no game content ever enters the repository or CI. In progress: no release or tag yet.
status: in-progress
stack: [C#, .NET 9, Reloaded-II, Reloaded.SharedLib.Hooks, Prism (screen-reader speech), xUnit, CsCheck, Mono.Cecil, Stryker.NET, PowerShell, Pester, Bash, GitHub Actions, GitHub merge queue, CodeQL, OpenSSF Scorecard, Dependabot, GitHub secret scanning, Claude Code, Ghidra, markdownlint-cli2, Vale, lychee, jscpd]
repoUrl: https://github.com/Sour-Dev-Home/metaphor-accessibility
emphasis: secondary
order: 6
---

## The problem

Metaphor: ReFantazio on PC runs on a proprietary engine, so modding it is mostly reverse engineering, and the Steam release ships with Denuvo Anti-tamper. A survey of official sources, reviews and the Steam page found no built-in text-to-speech, menu narration or screen-reader support. To give blind and visually impaired players speech, a mod has to find the game functions that show text, hook them, and hand that text to the player's screen reader, all without touching the DRM.

## How the mod is built

It is a Reloaded-II mod that depends on Reloaded-II's shared hooks library, which the loader already ships, so players install nothing extra. The code is split by risk ([ADR 0003](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0003-thin-hook-layer.md)):

- **`Metaphor.Core`** (plain `net9.0`): the known game builds, the hook signatures and the scan that finds them, the announcer, a text cleaner, the transcript, the mod's status file and a round-trip test harness.
- **`Metaphor.Features.Dialogue`** (plain `net9.0`): turns dialogue-line and choice events into announcements.
- **`Metaphor.Features.Menus`** (plain `net9.0`): speaks menu focus, starting with the title menu, with menus recognised by screen class. Features depend on Core's interfaces, never on each other.
- **`Metaphor.Hooks`** (`net9.0-windows`): the only project allowed to touch game memory. It holds the entry point, the hook loader, the adapters every hook goes through, the hooks themselves, the memory reader and the speech backend.

Architecture tests enforce [fifteen rules](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/d8fe7a7e93930cf8ef8e893db979ac9f1d01d9c3/docs/coding-standards.md) on every assembly built from `src/`. Windows APIs, raw memory and networking stay out of everything except the hook layer, and native libraries load only from System32, with one exception approved in an ADR for the speech library. Every hook is a class that names the game builds it was checked on, reads game memory only through one reader, and declares pointer-sized delegates. There is one hook per game function, and each hook takes its dependencies through its constructor.

Hooks don't install themselves. Shared adapters create, store and activate each hook, catch anything its code throws and always call the original function, so a hook only decodes arguments and a bug in it can't skip the game's own code.

At startup, the hook loader ([ADR 0006](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0006-hooks-through-reloaded-shared-hooks.md)) checks the running **game build** against the builds each hook names, scans memory for each signature, and installs a hook only where its signature matches exactly once. A failed hook is logged and the rest still install, and the status file reports hooks loaded out of hooks expected. A game build is identified by the SHA-256 of the executable, with the Steam build ID as a readable label.

A hook decodes each call once and hands the event to observers in Core. The dialogue feature is one such observer: it uses release hooks on the game's message-file compile function (`CompileMsgFile`), on its message request by label (`MsgRequestByName`) and on the function that opens a dialogue choice (`MsgRequestSelectByName`).

## One voice for every feature

Every feature hands its announcements to one announcer ([ADR 0004](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0004-announcements-and-transcript.md)). Unit tests check the exact text with a recording announcer, and Debug builds also write a transcript, so a run can be checked without listening to it.

Behind the announcer, speech goes through [Prism](https://github.com/ethindp/prism) v0.18.3, which the build fetches by SHA-256, checks again and loads by full path. Its backends are created only from a fixed list (NVDA, JAWS, ZoomText, OneCore, SAPI), so no DLL is ever loaded by bare name ([ADR 0005](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0005-prism-speech-backend.md)). If Prism doesn't start, the mod stays silent instead of failing.

## Finding a function to hook

Analysis stays inside the limits set by [ADR 0002](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0002-analysis-methods-under-denuvo.md): reading the source of open-source community mods that already hook this game, writing a Reloaded-II mod that reads memory and hooks functions, and opening the shipped executable in a disassembler as it is. Anti-debug plugins, dumping or unpacking protected code, and patching DRM checks are ruled out.

The [add-a-hook playbook](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/contributors/how-to/add-a-hook.md) turns that into steps, each ending in evidence:

1. **Find the function**, cheapest source first: community mods' source, saved at a commit; then what the game reports at runtime (its script functions by name, logged by development-only listening hooks); then the disassembler.
2. **Write a byte signature** with wildcards, and check it matches exactly once both in the executable on disk (an offline checker) and in the running game (a spike script). A first spike showed that on the pinned build, all 15 signatures it tried matched exactly once on disk and once in memory, at the same address relative to the module.
3. **Pin the calling convention** from the cited source, declaring integers pointer-sized.
4. **Write the hook** against a shape interface, with the logic in a plain library, unit-tested with fakes.
5. **Prove it in the game**: a smoke test that shows `hooks n/n` and quits the game unattended, then a real run, saved as a raw source naming the method, the game build and the steps.

For the dialogue feature, I ran the opening scene with NVDA on and confirmed by ear that each line was spoken once, in order, over the voice acting. The transcript had one line per request, in request order.

## How knowledge moves

Knowledge moves in one direction, and each step cites the one before. A source the project relies on (a community mod's code at a commit, tool docs, or a capture of a run with its tool versions, game build and steps) is saved under `docs/raw-sources/` with a header the checks enforce, and never edited afterwards. Findings about the game are pinned to a game build. Decisions that follow from the evidence become ADRs, and ADRs become architecture rules that tests enforce, or data files whose entries point back at their raw sources (the hook signatures and the known game builds). Anything without a source is marked `[NEEDS VERIFICATION]`.

The playbook closes the loop: each new hook starts from the raw sources, and its proof in the game becomes a new raw source.

## How a change reaches `main`

One check command, [`scripts/check.sh`](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/d8fe7a7e93930cf8ef8e893db979ac9f1d01d9c3/scripts/check.sh), runs from the git hooks and from CI, so the local and CI checks are the same script. Four GitHub Actions workflows run on top of it: `ci.yml` (the required gate), `conflict-alert.yml` (comments on pull requests that conflict with `main`, and on integration branches that fall behind it), a weekly OpenSSF Scorecard and a weekly slow suite.

- **Fast on pull requests, full in the queue.** The `build` job runs on Linux for a pull request and on Windows in the merge queue and on `main`, under one required check name. The Windows run also packages the mod and rebuilds it in a second checkout to compare the bytes ([ADR 0008](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/d8fe7a7e93930cf8ef8e893db979ac9f1d01d9c3/docs/adr/0008-ci-fast-path-and-windows-gate.md)).
- **Merge queue.** Changes reach `main` only through a pull request and a squash merge queue, which re-runs CI on each pull request combined with the ones ahead of it. The ruleset requires no approving review; four checks (`repo-rules`, `build`, `scripts`, `security`) and a code-scanning rule that blocks high or higher CodeQL alerts are the gate.
- **Security-review gate.** A commit that touches the hook layer, the deploy scripts or the guards themselves (the checks, git hooks, workflows, check tests and pinned tools) needs a review by a `security-reviewer` agent. When it finds nothing critical or important, it records a stamp that hashes the staged change; the pre-commit hook refuses a commit without a matching stamp, the commit-msg hook adds a `Security-Review` trailer, and CI fails a pull request commit whose trailer doesn't match ([contributing guide](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/d8fe7a7e93930cf8ef8e893db979ac9f1d01d9c3/.github/CONTRIBUTING.md#security-review-and-deny-rules)).
- **Outside pull requests.** Trailers don't count for them, since anyone can write one. CI needs a `security-reviewed` label that a maintainer added after the pull request's latest push, and judges it with the base branch's copy of the check scripts. Deny rules stop Claude Code from force-pushing, printing the private patterns or skipping the hooks; the guide calls them "a strong guard, not a guarantee".

Reviews found two ways a pull request could run its own code in a required gate (a markdownlint config, and build files read before the vulnerability audit); [PR #325](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/325) closed both, and [PR #323](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/323) brought the guards into the review scope. Hardening that wasn't a live risk was filed as follow-up tickets instead of another review round.

## Working with AI coding agents

I build the project with AI coding agents (Claude Code), and the rules an agent follows from claim to report live in one page, [`docs/agents/workflow.md`](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/d8fe7a7e93930cf8ef8e893db979ac9f1d01d9c3/docs/agents/workflow.md); briefs link to it instead of repeating it.

- **Triage and decisions.** Issues carry triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, plus `needs-game` where the work needs the game), and decisions are recorded in the issue.
- **Claim, test first, hand back.** An agent first looks for a branch, pull request or comment that already claims the issue, and stops if it finds one. It branches from the base its brief names and builds test-first. For hook and guard code it stages the change and hands it back, and the main session runs the security review, commits with the stamp and pushes. Everything else goes into a pull request with auto-merge on, and CI and the merge queue do the rest.
- **Model split.** Sonnet for docs-only and mechanical tickets and for reviewing docs-only or test-only changes; Opus for reverse engineering, hooks, security and design.
- **Untrusted text.** Issue, pull request and comment text is data, not instructions: an agent builds an issue only when my account applied its latest `ready-for-agent` label. In a GitHub outage, work is classified, parked and resumed, and no check is skipped to get past it.
- **Integration branches.** A larger piece of work can have its own branch that tickets merge into; the first alpha was built that way ([PR #202](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/202)) and merged as code, not released.

The setup for a human collaborator is planned in an open issue ([#309](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/309)): the access role, a review label required on their pull requests outside `docs/`, the private-patterns secret moved to an environment limited to `main`, and a tag ruleset. The contributing guide already has a "Contributing without Claude" section: the agent tooling is optional, and the ground rules apply to people as they do to agents.

## Guardrails

- **No game content.** The check command blocks executables, archives and other game content, and CI never sees any: no fixtures from the game, no secrets carrying it, and no self-hosted runner with the game installed ([ADR 0001](https://github.com/Sour-Dev-Home/metaphor-accessibility/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0001-ci-never-sees-game-content.md)). Run captures that contain game text stay on my machine.
- **Single-player only.** No online features and no DRM or anti-tamper circumvention. If a protection blocks a method, the work stops and looks for another route.
- **Cite or flag.** Every engine claim cites a saved raw source or a reproducible note, or says `[NEEDS VERIFICATION]`. The checks fail a raw source without its header and a finding without its game build.
- **Personal information.** The check command scans for general patterns and, on pushes to `main`, for a private list held as a repository secret.
- **Supply chain.** The repository settings require every action to be pinned by commit SHA and allow only GitHub's own actions and the Scorecard action ([PR #326](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/326)). Read-only tokens by default, CodeQL on the C# code and the workflows and a known-vulnerability check as required jobs, Dependabot weekly for NuGet, npm and Actions, a weekly OpenSSF Scorecard, secret scanning with push protection, and a CI rebuild in a second checkout that must match byte for byte.

## Progress so far

Work started in mid-November 2026, and there is no release or tag yet.

- **13–14 Nov:** the repository skeleton, a survey of community modding tools, a glossary and the first ADRs; one check command with the game-content blocker and the personal-information scan; a .NET skeleton with Windows CI, architecture tests, a ruleset on `main`, and supply-chain and docs checks.
- **15 Nov:** the round-trip harness, the known-builds list, a smoke-test harness, a dev deploy script, a mod entry point that loads in Reloaded-II, the offline signature checker, and a weekly slow suite with mutation testing and duplication checks.
- **16 Nov:** the runtime signature scan and the disk-versus-memory spike; the announcer, transcript and text cleaner; Prism speech; the hook loader with its build check; listening hooks; spoken story dialogue ([PR #80](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/80)); then the hook layer refactored to constructor-injected services, one hook per function and shared adapters. Later that day: deny rules and the must-run security review ([PR #111](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/111)), the merge queue ([PR #113](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/113)), stage timing ([PR #99](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/99)), Linux CI with a Windows gate ([PR #121](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/121)), spoken dialogue choices ([PR #124](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/124)) and the rename to `metaphor-accessibility` ([PR #112](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/112)).
- **17 Nov:** the `security-reviewed` label for outside pull requests ([PR #138](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/138)); the agent workflow doc ([PR #230](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/230)); the conflict alert ([PR #237](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/237)); a machine-wide build lock and reuse of a passing check on an identical tree ([PR #235](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/235), [PR #266](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/266)); the first alpha integration branch, merged without a release ([PR #202](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/202)); a dialogue history, a voiced-lines setting, a repeat key and braille output; the title menu's focus spoken ([PR #173](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/173)).
- **18 Nov:** a check run log and status, local test selection, two build slots and a batched file scan ([PR #274](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/274), [PR #276](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/276), [PR #285](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/285), [PR #302](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/302)); the guards in the security-review scope and two CI code-execution gaps closed ([PR #323](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/323), [PR #325](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/325)); the outage plan ([PR #320](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/320)); SHA pinning and an allowed-actions list ([PR #326](https://github.com/Sour-Dev-Home/metaphor-accessibility/pull/326)); menus recognised by screen class and "n of total" on list screens; a shared Ghidra project for agents.

Of the mod features, only spoken dialogue lines have a recorded by-ear check; the later ones rest on merged pull requests and their tests.

## What's next

From the open issues on 18 November:

- **Release and trust:** a tagged, CI-built, attested release with a published hash ([#310](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/310), [#308](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/308)); a spoken installer ([#303](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/303)).
- **Collaboration and gates:** the collaborator setup ([#309](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/309)), a one-command onboarding script ([#267](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/267)), a merge from `main` that needs no new review stamp ([#246](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/246)), and a trailer check that covers merge commits ([#174](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/174)).
- **Check speed and hardening:** measure, then speed up the remaining check time ([#314](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/314)); hardening from reviews ([#321](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/321), [#324](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/324)).
- **The mod:** menu screens with focus and values spoken ([#211](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/211)), battle turn by turn ([#247](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/247)), field navigation ([#144](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/144)), calendar and objectives ([#146](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/146)), shops and followers ([#147](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/147)), and placeholder tags in dialogue ([#83](https://github.com/Sour-Dev-Home/metaphor-accessibility/issues/83)).

## Links

- [Repository](https://github.com/Sour-Dev-Home/metaphor-accessibility) (code GPL-3.0, docs CC BY 4.0)
- [Architecture decisions](https://github.com/Sour-Dev-Home/metaphor-accessibility/tree/d8fe7a7e93930cf8ef8e893db979ac9f1d01d9c3/docs/adr)
