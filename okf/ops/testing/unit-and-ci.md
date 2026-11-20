---
type: Policy
title: 'Rules and CI runs'
description: 'The rules of muffelblog this project follows, which pushes run the full suite, unit tests first, and the property tests of the migrations.'
---

# Rules and CI runs

* **[E]** The rules of muffelblog apply (round 1: "exactly muffelblog, at
  once"): only a green "CI Gate" goes to review. No test is skipped or
  disabled to make the CI green.

* **[E]** Every push to `main` and `hotfix/**` runs the full suite; a pull
  request runs what its changes need (owner, 2026-11-12): a change of
  documentation only (`okf/`, `docs/`, `changes/`, `website/`, Markdown
  at the top level) skips the code checks (lint, unit, E2E and mutation
  tests); the Docker image, Trivy and the Compose stack with the upgrade
  test run only when the pull request changes one of
  `Dockerfile`, `.dockerignore`, `compose*.yaml`, `docker/`, `package.json`,
  `pnpm-lock.yaml`, `.node-version`, `src/server/db/`, the server start
  (`main.ts`, `server.ts`, `config.ts`, `cli.ts`, `maintenance.ts` in
  `src/server/`) or `.github/workflows/ci.yml` – game code
  alone (for example `src/server/game/`) does not build the image – and
  always in a release pull request and in a pull request into `hotfix/**`
  (job „Detect changes“ in `.github/workflows/ci.yml`); the release pull
  request of `main` only in its full run (#147). This replaces
  the earlier rule of round 1 that the whole suite runs on every pull
  request. The mutation tests run in a pull request only when it changes
  what they test (#146, below), and then only for the files it changes
  (#309, below).

* **[E]** Unit tests with Vitest; tests come first for new logic and check
  behavior, not markup.

* **[E]** Property-based upgrade tests of every migration on generated data
  (fast-check), and an own upgrade test for every migration that changes
  existing tables or data; see [SQLite storage](/data/sqlite.md).
