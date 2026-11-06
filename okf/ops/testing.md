---
type: Policy
title: Test strategy
description: Kinds of tests, quality gates and the role of the CI Gate before a pull request goes to review.
tags: [tests, tdd, e2e, mutation, ci, vitest, playwright, stryker]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Decisions

* **[E]** The rules of muffelblog apply (round 1: "exactly muffelblog, at
  once"): the whole suite runs on every pull request; only a green "CI Gate"
  goes to review. No test is skipped or disabled to make the CI green.
* **[E]** Unit tests with Vitest; tests come first for new logic and check
  behavior, not markup.
* **[E]** E2E tests with Playwright in the browser against the real server and
  a fresh database (`e2e/`), desktop and phone size. Every page records
  Content-Security-Policy violations and script errors; there must be none.
* **[E]** Accessibility with axe (WCAG 2.1 A and AA) on the login and all 12
  views, with a self-test that proves the check finds problems
  (`e2e/a11y.spec.ts`). A look with a screen reader and the keyboard is still
  open.
* **[E]** Mutation tests with Stryker, a score below 80 % blocks;
  incremental on pull requests and `main`, complete every night and on a
  release tag.
* **[E]** Coverage blocks below 90 % of the lines and 85 % of the branches.
* **[E]** ESLint blocks: cyclomatic complexity ≤ 10, cognitive complexity
  (sonarjs) ≤ 10, nesting ≤ 4, functions ≤ 50 lines (tests are free of the
  length rule). The dense code of version 1 was rebuilt into small functions;
  no place is exempted.
* **[E]** Security gates: gitleaks over the whole history, `pnpm audit --prod`
  (high blocks), CodeQL `security-extended` (severity ≥ 7.0 blocks), Trivy on
  the image (critical with a fix blocks).

# Kinds of tests in this project

| Kind | Where | What it proves |
|---|---|---|
| Equivalence | `src/shared/equivalence.test.ts`, `catalog.test.ts`, `src/client/art.test.ts` | The TypeScript rules compute exactly what version 1 computed: 400 random cases with a fixed seed for production, settling, costs, times, flights, and battles with the same random stream; catalog and all 32 pictures are identical. Version 1 is frozen in `src/test/legacy/`. |
| Unit | `src/**/*.test.ts` | Rules, store (real SQLite in memory), actions, arrivals, admin, accounts, configuration, mail, operator commands, HTTP API (a real server on a free port), client logic. |
| Sync | `src/server/docs.test.ts`, `src/server/http/security.test.ts` | Every setting is in the docs, `.env.example` and `compose.yaml`; links resolve; the Caddyfile sends the same security headers as the server. |
| E2E | `e2e/game.spec.ts` | Invitation, single use, login, building, production share, renaming, shipyard, fleet form, espionage with report, admin panel (invite, copy link, revoke, live settings, grow-only), phone layout. |
| Accessibility | `e2e/a11y.spec.ts` | axe on every view. |
| Stack | `docker/smoke.sh` in the CI job "Docker image and Compose stack" | Headers through Caddy, uid 1000, invitation mail in Mailpit, registration with its link, admin by command, data after a restart; plus: image without compiler, package manager or tests; a wrong setting stops the start; Trivy. |

# Scope of coverage and mutation

* **[V]** Measured: `src/shared`, `src/server`, `src/client/logic`. Not
  measured, like the Astro templates in muffelblog: the HTML templates
  (`src/client/views`), the art data (`src/client/art.ts`), the browser glue
  (`src/client/main.ts`) and the process entry points (`main.ts`, `cli.ts`).
  The E2E suite and the Compose job run them.

# Level at the introduction (2026-11-06)

* 24 test files, 190 unit tests; 99.5 % lines, 95.4 % branches.
* 11 E2E tests (8 game, 3 accessibility).
* Mutation score of the complete run: 92.6 % (2,403 killed, 10 timed out, 175 survived; client logic 96.9 %).

# Risks

* **[U]** The CI workflows were written after muffelblog and checked locally
  step by step (lint, types, tests, coverage, Stryker, Playwright, image
  build, Compose stack with smoke test, gitleaks); the first run on GitHub is
  the proof.
* Mutation tests take minutes; the incremental run keeps pull requests fast,
  the nightly run is the complete one.
