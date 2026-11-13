---
title: Nova Imperium
description: A classic space strategy browser game for a group of friends – Node.js, SQLite, Svelte, self-hosted with Docker. How to play and run it, how to contribute, and how it is tested and released.
template: splash
hero:
  tagline: A classic space strategy browser game for a group of friends – Node.js, SQLite, Svelte, self-hosted with Docker.
  actions:
    - text: Getting started
      link: /nova-imperium/getting-started/
      icon: right-arrow
    - text: Decisions
      link: /nova-imperium/decisions/
      variant: minimal
---

Nova Imperium is played in the browser, in the style of the browser games of
2007/2008: mines, research, shipyard, defense, fleets, espionage, battles and
a highscore. The server computes everything itself, also while nobody is
online; the interface is German. A group runs it on its own server with
Docker Compose.

## The sections

- [Getting started](getting-started.md): play the game, install a server,
  or run it from source.
- [Contributing](contributing.md): issues, clarification with the owner,
  changelog fragments, labels and code style.
- [Git workflow](git-workflow.md): branches, the pull request flow, squash
  merges, the release pull request, release candidates, hotfixes and
  Renovate, with diagrams.
- [CI and checks](ci.md): every job of the CI, how the CI Gate decides,
  mutation tests, Trivy, gitleaks, CodeQL and CodeRabbit.
- [Automation](automation.md): how the workflows trigger each other and
  what each of them produces.
- [Operations](/docs/operations.md): reverse proxy, backup, updates and
  rollback, and every setting.
- [Decisions](/okf/index.md): the OKF bundle, the source of truth of the
  project. Every decision is marked **[E]** (confirmed by the owner),
  **[V]** (proposal) or **[U]** (unverified).

## For agents

[`agents.md`](https://heiss.github.io/nova-imperium/agents.md) is a map of
this site with a short description of every page and a link to its raw
Markdown; [`llms.txt`](https://heiss.github.io/nova-imperium/llms.txt)
points to it. Agents that work on the code start with
[`AGENTS.md`](/AGENTS.md) in the repository.
