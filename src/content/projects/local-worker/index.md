---
name: local-worker
description: >-
  An MCP server that offloads bulk reading (CI logs, diffs, long docs) and first drafts to a local Ollama model on the GPU, so large inputs never enter Claude's context — plus Markdown-to-PDF rendering and a weekly devlog CLI. 233 tests, CI on Ubuntu and Windows, with path confinement hardened through an independent bug hunt and two security reviews.
status: shipped
stack: [TypeScript, Node.js, MCP, Ollama, Vitest]
repoUrl: https://github.com/Sour-Dev-Home/local-worker
emphasis: secondary
order: 3
---
