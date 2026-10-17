---
name: lanes
description: >-
  A workflow for building software with parallel Claude Code sessions ("lanes"): one fresh session per GitHub issue, with contracts at every handoff (the task issue form, contract files, the PR template, JSON reviewer verdicts) and required GitHub checks as the only gatekeeper, so unattended work can run overnight on low-risk issues. A Node.js test suite (158 tests as of PR #7) backs a lanes/gate status computed from the live diff and issue labels; a branch ruleset requires verify, security (an org-wide PII check) and CodeQL with no bypass, merged through a queue. Reviewer subagents (test-hunter, security, UI, architecture) each post a per-criterion verdict on the PR. The threat model is documented candidly: the gate stops honest mistakes and strangers, not a lane that turns hostile, and a dedicated GitHub App to close that gap is planned. Still a pilot: its first lane (trusting issue authors by repository write access, not GitHub's author_association field) ran end to end and merged; a progress dashboard is planned, not yet built.
status: in-progress
stack: [Node.js, GitHub Actions, Claude Code]
repoUrl: https://github.com/Sour-Dev-Home/lanes
emphasis: secondary
order: 2
---
