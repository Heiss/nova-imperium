---
type: Policy
title: 'Rules and CI runs'
description: 'The rules of muffelblog this project follows, which pushes run the full suite, unit tests first, and the property tests of the migrations.'
---

# Rules and CI runs

* **[E]** The rules of muffelblog apply (round 1: "exactly muffelblog, at
  once"): only a green "CI Gate" goes to review. No test is skipped or
  disabled to make the CI green.

* **[E]** Every push to `main` and `hotfix/**` runs the full suite, except
  an expensive job that already succeeded on the identical tree in the pull
  request the push merged (owner, 2026-11-21, #342, [Proofs of a push
  run](/ops/testing/push-proofs.md)), and except the mutation jobs of a
  push to `main`, which never run there: the nightly run tests `main`
  (owner, 2026-11-26, #370, 195a, 200a); a pull request runs what its changes
  need (owner, 2026-11-12): a change of
  documentation only (`okf/`, `docs/`, `changes/`, `website/`, Markdown
  at the top level) skips the code checks (lint, unit, E2E and mutation
  tests); the Docker image, Trivy and the Compose stack with the upgrade
  test run only when the pull request changes one of
  `Dockerfile`, `.dockerignore`, `compose*.yaml`, `docker/`, `package.json`,
  `pnpm-lock.yaml`, `.node-version`, `src/server/db/`, the server start
  (`main.ts`, `server.ts`, `config.ts`, `cli.ts`, `maintenance.ts` in
  `src/server/`) or `.github/workflows/ci.yml` – game code
  alone (for example `src/server/game/`) does not build the image – and
  always in a pull request into `hotfix/**`
  (job „Detect changes“ in `.github/workflows/ci.yml`). Until #387 they also
  ran in a release pull request, in that of `main` only in its full run
  (#147); since #387 a release pull request runs no unit tests, E2E,
  mutation, image or website (it changes only the metadata files). This replaces
  the earlier rule of round 1 that the whole suite runs on every pull
  request. The mutation tests run in a pull request only when it changes
  what they test (#146, below), and then only for the files it changes
  (#309, below).

* **[E]** A pull request into `main` whose head does not contain the base
  commit of its event fails in „Detect changes“, before any expensive job
  (owner, 2026-11-27, #431, 203b and 205a): `git merge-base --is-ancestor
  <base> <head>` with the base and the head commit of the `pull_request`
  event, not the merge commit. The error says how to fix it: `git fetch
  origin && git merge origin/main`, then push. Why: the strict ruleset of
  `main` needs an up-to-date branch before the merge, so such a head would
  run its CI again after the update (#417: up to 170 minutes a run).
  **[V]** (#431): the checkout of „Detect changes“ has the whole history,
  and an error of the check (exit code other than 0 or 1) fails it too;
  pull requests into `hotfix/**` and release pull requests (`release/*`)
  keep their own rules; a run started before `main` moved compares with
  the base of its own event; pull requests of Dependabot and Renovate are
  included. Tests: `src/test/ci-release.test.ts`. The loop rule stays: `main`
  is merged into a branch only when it is the next to merge, on a conflict,
  or when it needs code from `main`, for pull requests nobody pushes to;
  whoever pushes takes in `main` first.
* **[E]** Unit tests with Vitest; tests come first for new logic and check
  behavior, not markup.

* **[E]** Property-based upgrade tests of every migration on generated data
  (fast-check), and an own upgrade test for every migration that changes
  existing tables or data; see [SQLite storage](/data/sqlite.md).
