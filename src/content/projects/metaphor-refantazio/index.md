---
name: "Metaphor: ReFantazio accessibility mod"
summary: >-
  An accessibility mod for blind players of Metaphor: ReFantazio. Reloaded-II hooks speak story dialogue via screen readers.
description: >-
  An open-source, single-player mod and reverse-engineering notebook for Metaphor: ReFantazio on PC, a game on a proprietary engine with no built-in screen-reader support found. The mod loads through Reloaded-II, finds game functions by byte signatures pinned to an exact game build (the SHA-256 of the executable), and installs hooks only when the running build matches. Hook code is a thin Windows-only layer; feature logic lives in plain .NET libraries that architecture tests keep free of Windows APIs, raw memory and networking. Every feature hands its announcements to one announcer, which speaks through Prism (NVDA, JAWS, ZoomText, OneCore, SAPI) and, in dev builds, writes a transcript. The first feature speaks story dialogue lines through two hooks on the game's message functions. Every engine claim cites a saved source or is flagged; no game content ever enters the repository or CI. In progress: no release yet.
status: in-progress
stack: [C#, .NET 9, Reloaded-II, Reloaded.SharedLib.Hooks, Prism (screen-reader speech), xUnit, CsCheck, Mono.Cecil, Stryker.NET, PowerShell, Pester, Bash, GitHub Actions, CodeQL, OpenSSF Scorecard, Dependabot, markdownlint-cli2, Vale, lychee, jscpd]
repoUrl: https://github.com/Sour-Dev-Home/metaphor-refantazio
emphasis: secondary
order: 6
---

## The problem

Metaphor: ReFantazio on PC runs on a proprietary engine, so modding it is mostly reverse engineering, and the Steam release ships with Denuvo Anti-tamper. A survey of official sources, reviews and the Steam page found no built-in text-to-speech, menu narration or screen-reader support. To give blind and visually impaired players speech, a mod has to find the game functions that show text, hook them, and hand that text to the player's screen reader, all without touching the DRM.

## How the mod is built

It is a Reloaded-II mod that depends on Reloaded-II's shared hooks library, which the loader already ships, so players install nothing extra. The code is split by risk ([ADR 0003](https://github.com/Sour-Dev-Home/metaphor-refantazio/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0003-thin-hook-layer.md)):

- **`Metaphor.Core`** (plain `net9.0`): the known game builds, the hook signatures and the scan that finds them, the announcer, a text cleaner, the transcript, the mod's status file and a round-trip test harness.
- **`Metaphor.Features.Dialogue`** (plain `net9.0`): turns dialogue-line events into announcements. Features depend on Core's interfaces, never on each other.
- **`Metaphor.Hooks`** (`net9.0-windows`): the only project allowed to touch game memory. It holds the entry point, the hook loader, the adapters every hook goes through, the hooks themselves, the memory reader and the speech backend.

Architecture tests enforce [fourteen rules](https://github.com/Sour-Dev-Home/metaphor-refantazio/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/coding-standards.md) on every assembly built from `src/`. Windows APIs, raw memory and networking stay out of everything except the hook layer, and native libraries load only from System32, with one exception approved in an ADR for the speech library. Every hook is a class that names the game builds it was checked on, reads game memory only through one reader, and declares pointer-sized delegates. There is one hook per game function, and each hook takes its dependencies through its constructor.

Hooks don't install themselves. Shared adapters create, store and activate each hook, catch anything its code throws and always call the original function, so a hook only decodes arguments and a bug in it can't skip the game's own code.

At startup, the hook loader ([ADR 0006](https://github.com/Sour-Dev-Home/metaphor-refantazio/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0006-hooks-through-reloaded-shared-hooks.md)) checks the running **game build** against the builds each hook names, scans memory for each signature, and installs a hook only where its signature matches exactly once. A failed hook is logged and the rest still install, and the status file reports hooks loaded out of hooks expected. A game build is identified by the SHA-256 of the executable, with the Steam build ID as a readable label.

A hook decodes each call once and hands the event to observers in Core. The dialogue feature is one such observer: it uses two release hooks, one on the game's message-file compile function (`CompileMsgFile`) and one on its message request by label (`MsgRequestByName`).

## One voice for every feature

Every feature hands its announcements to one announcer ([ADR 0004](https://github.com/Sour-Dev-Home/metaphor-refantazio/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0004-announcements-and-transcript.md)). Unit tests check the exact text with a recording announcer, and Debug builds also write a transcript, so a run can be checked without listening to it.

Behind the announcer, speech goes through [Prism](https://github.com/ethindp/prism) v0.18.3, which the build fetches by SHA-256, checks again and loads by full path. Its backends are created only from a fixed list (NVDA, JAWS, ZoomText, OneCore, SAPI), so no DLL is ever loaded by bare name ([ADR 0005](https://github.com/Sour-Dev-Home/metaphor-refantazio/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0005-prism-speech-backend.md)). If Prism doesn't start, the mod stays silent instead of failing.

## Finding a function to hook

Analysis stays inside the limits set by [ADR 0002](https://github.com/Sour-Dev-Home/metaphor-refantazio/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0002-analysis-methods-under-denuvo.md): reading the source of open-source community mods that already hook this game, writing a Reloaded-II mod that reads memory and hooks functions, and opening the shipped executable in a disassembler as it is. Anti-debug plugins, dumping or unpacking protected code, and patching DRM checks are ruled out.

The [add-a-hook playbook](https://github.com/Sour-Dev-Home/metaphor-refantazio/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/contributors/how-to/add-a-hook.md) turns that into steps, each ending in evidence:

1. **Find the function**, cheapest source first: community mods' source, saved at a commit; then what the game reports at runtime (its script functions by name, logged by development-only listening hooks); then the disassembler.
2. **Write a byte signature** with wildcards, and check it matches exactly once both in the executable on disk (an offline checker) and in the running game (a spike script). A first spike showed that on the pinned build, all 15 signatures it tried matched exactly once on disk and once in memory, at the same address relative to the module.
3. **Pin the calling convention** from the cited source, declaring integers pointer-sized.
4. **Write the hook** against a shape interface, with the logic in a plain library, unit-tested with fakes.
5. **Prove it in the game**: a smoke test that shows `hooks n/n` and quits the game unattended, then a real run, saved as a raw source naming the method, the game build and the steps.

For the dialogue feature, I ran the opening scene with NVDA on and confirmed by ear that each line was spoken once, in order, over the voice acting. The transcript had one line per request, in request order.

## How knowledge moves

Knowledge moves in one direction, and each step cites the one before. A source the project relies on (a community mod's code at a commit, tool docs, or a capture of a run with its tool versions, game build and steps) is saved under `docs/raw-sources/` with a header the checks enforce, and never edited afterwards. Findings about the game are pinned to a game build. Decisions that follow from the evidence become ADRs, and ADRs become architecture rules that tests enforce, or data files whose entries point back at their raw sources (the hook signatures and the known game builds). Anything without a source is marked `[NEEDS VERIFICATION]`.

The playbook closes the loop: each new hook starts from the raw sources, and its proof in the game becomes a new raw source.

## Guardrails

- **No game content.** The check command blocks executables, archives and other game content, and CI never sees any: no fixtures from the game, no secrets carrying it, and no self-hosted runner with the game installed ([ADR 0001](https://github.com/Sour-Dev-Home/metaphor-refantazio/blob/f3a698077790e2d7317190976823cc081640f0d4/docs/adr/0001-ci-never-sees-game-content.md)). Run captures that contain game text stay on my machine.
- **Single-player only.** No online features and no DRM or anti-tamper circumvention. If a protection blocks a method, the work stops and looks for another route.
- **Cite or flag.** Every engine claim cites a saved raw source or a reproducible note, or says `[NEEDS VERIFICATION]`. The checks fail a raw source without its header and a finding without its game build.
- **Personal information.** The check command scans for general patterns and, on pushes to `main`, for a private list held as a repository secret.
- **Supply chain.** Actions pinned to commits, read-only tokens by default, CodeQL and a known-vulnerability check as required jobs, Dependabot, a weekly OpenSSF Scorecard, and a CI rebuild in a second checkout that must match byte for byte.

## Progress so far

Work started in mid-November 2026, and there is no release yet.

- **13–14 Nov:** the repository skeleton, a survey of community modding tools, a glossary and the first ADRs; one check command with the game-content blocker and the personal-information scan; a .NET skeleton with Windows CI, architecture tests, a ruleset on `main`, and supply-chain and docs checks.
- **15 Nov:** the round-trip harness, the known-builds list, a smoke-test harness, a dev deploy script, a mod entry point that loads in Reloaded-II, the offline signature checker, and a weekly slow suite with mutation testing and duplication checks.
- **16 Nov:** the runtime signature scan and the disk-versus-memory spike; the announcer, transcript and text cleaner; Prism speech; the hook loader with its build check; listening hooks; spoken story dialogue ([PR #80](https://github.com/Sour-Dev-Home/metaphor-refantazio/pull/80)); then the hook layer refactored to constructor-injected services, one hook per function and shared adapters.

## What's next

From the open issues:

- **Dialogue gaps:** speak the speaker name the screen shows, dialogue choices and the lines that don't go through `MsgRequestByName`; fill placeholder tags; don't talk over the voice acting; repeat the last line on a key.
- **Menus:** a spike looking for one point where every menu's focus moves, then the title screen, reply choices, settings and the in-game menu.
- **Tooling and hardening:** a deeper hook layer, deny rules and a required security review for hook code, a spike on building on Linux, and support for more screen readers.

## Links

- [Repository](https://github.com/Sour-Dev-Home/metaphor-refantazio) (code GPL-3.0, docs CC BY 4.0)
- [Architecture decisions](https://github.com/Sour-Dev-Home/metaphor-refantazio/tree/f3a698077790e2d7317190976823cc081640f0d4/docs/adr)
