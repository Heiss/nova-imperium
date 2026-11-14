---
title: Getting started
description: How to play Nova Imperium, how to run a server for your group, and how to run the game locally, as a demo or from source.
---

## Play

Nova Imperium runs on a server of your group, not on a platform; players
need only a browser, on the desktop or a phone. Nobody can register without
an invitation: an admin of the server enters your e-mail address in the
admin panel, and you get a link by mail or from the admin directly. The
link is valid once and for 7 days by default
([Invitations](/okf/features/invitations.md)). Open it, choose a name and a
password, and you are in.

The interface is German and stays German; there is no language switch
([Languages](/okf/ops/language.md)). In-game, „Neuigkeiten“ shows what
changed in each release ([Changelog in the game](/okf/features/changelog.md)).

## Run a server

[Install a server](/docs/getting-started.md) walks through it: Docker
Compose on a Linux server, a reverse proxy with HTTPS in front, the
settings in `.env`, the first invitation and the first admin, made with an
operator command, never through the web. Every setting is listed in
[Configuration](/docs/configuration.md); backup, updates, rollback and
hardening are in [Operations](/docs/operations.md).

Each release is an image on GHCR, `ghcr.io/heiss/nova-imperium:<version>`;
the operator picks the version with `NOVA_VERSION` and may skip releases
([Branching and release](/okf/ops/branching-release.md)).

## Run it locally

- **Demo with Docker**: `docker/init-env.sh --demo` and
  `docker compose up -d --build` start the game on `http://localhost:8080`
  with Mailpit as a mail sink on `http://localhost:8025`; nothing leaves the
  machine ([Install a server](/docs/getting-started.md), section „Try it
  locally“).
- **From source**: Node.js and pnpm, `pnpm install`, `pnpm build`, then
  `pnpm start` with `NOVA_PUBLIC_URL` set
  ([Development](/docs/development.md)). The server runs TypeScript
  directly; only the browser client is bundled with Vite.

## Find your way

- The decisions behind everything are in the [OKF bundle](/okf/index.md);
  start with [Overview and goals](/okf/overview.md), which also explains the
  markers **[E]**, **[V]** and **[U]**.
- How work reaches the game: [Contributing](contributing.md),
  [Git workflow](git-workflow.md), [CI and checks](ci.md) and
  [Automation](automation.md).
- This site is built from `okf/` and `docs/` in the repository
  ([Documentation website](/okf/ops/website.md)); the pages under Getting
  started, Contributing, Git workflow, CI and checks and Automation are
  written for the site and link to the decisions they describe.
