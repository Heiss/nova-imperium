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
* **[E]** Every pull request brings E2E tests for each of its acceptance
  criteria that a player can see or do in the browser (owner, 2026-11-10).
  Logic that the browser cannot reach in reasonable time (for example a build
  that takes hours) is set up with `e2e/seed.ts` (planet, research, a
  colony, a finished queue). A test that passes at once is checked once by
  breaking the code it covers. Existing gaps are collected in an issue.
* **[E]** The gaps of #68 (game flows without a browser test, the table in
  the issue) are closed in one pull request (owner, 2026-11-13), fleet and
  battle first (attack with battle report and loot, transport arriving,
  recall, the max buttons, too little fuel, all fleet slots used, noob
  protection), then guilds, accounts, admin and the rest. Each area is
  checked against the specs again first; a flow that turns out covered is
  named in the pull request.
* **[E]** Flights, battles and queues of these tests are set up through
  `e2e/seed.ts` in the test database (land any fleet at once, finish a
  queue), as the colony test does; the server gets no test clock and no
  test-only code (owner, 2026-11-13, #68).
* **[E]** Mails in E2E tests (for example „Passwort vergessen“) go through
  real SMTP to a small mail sink that the E2E start runs on 127.0.0.1
  (`smtp-server` of the nodemailer project, a dev dependency); the test
  reads the link from the received mail. No production code changes for it
  (owner, 2026-11-13, #68).
* **[V]** The mail tests of #68 run against a second server of the E2E
  start (`e2e/env.ts`: port 8098, SMTP to the sink on 127.0.0.1:8025, login
  codes on), because SMTP and login codes on the first server would change
  the existing tests (the admin's „Kein SMTP eingerichtet“ and every login).
  The sink (`e2e/mail.ts`) writes each mail as a JSON line to a file the
  tests read. The new-round test runs there too: its own universe, so the
  reset touches no planet of the other tests. `e2e/seed.ts` lands any
  mission (`landFleet`), brings returning fleets home (`returnFleet`),
  finishes units of the shipyard queue (`finishUnits`) and dates the home
  planet back (`settledAgo`).
* **[E]** Accessibility with axe (WCAG 2.1 A and AA) on the login and all 12
  views, with a self-test that proves the check finds problems
  (`e2e/a11y.spec.ts`). A look with a screen reader and the keyboard is still
  open.
* **[E]** Property-based upgrade tests of every migration on generated data
  (fast-check), and an own upgrade test for every migration that changes
  existing tables or data; see [SQLite storage](/data/sqlite.md).
* **[E]** Mutation tests with Stryker, a total score below 80 % blocks;
  incremental on pull requests and on pushes to `main` (unchanged code keeps
  its cached result), complete every night (owner, 2026-11-11). Tag
  workflows verify the earlier CI result.
* **[E]** Mutation standard per file (owner, 2026-11-11,
  `mutation-standard.json`, `scripts/mutation-gate.ts`): no file may fall
  below its recorded floor; a new file needs 80 %, a new security file 90 %.
  Security files (authentication, sessions, passkeys, admin rights,
  moderation, account deletion, audit, request limits) aim for 90 %; the
  pull request that adds tests raises the floors with
  `node scripts/mutation-gate.ts --update`. Floors never go down.
* **[E]** Coverage blocks below 90 % of the lines and 85 % of the branches.
* **[E]** ESLint blocks: cyclomatic complexity ≤ 10, cognitive complexity
  (sonarjs) ≤ 10, nesting ≤ 4, functions ≤ 50 lines (tests are free of the
  length rule). The dense code of version 1 was rebuilt into small functions;
  no place is exempted.
* **[E]** The workflows are checked by the job „Workflow lint“ for every
  change (owner, 2026-11-11): actionlint (syntax, expressions, shell) and
  zizmor (security). Every action is pinned to a commit hash with the version
  as a comment; Renovate updates both (`helpers:pinGitHubActionDigests`).
  Checkouts keep no credentials, except the tag workflow, which pushes the
  tag. Its `workflow_run` trigger is accepted on purpose: it runs only after
  a successful CI push run on `main` and checks out `main`.
* **[E]** Code hygiene blocks in the job „Lint, types, unit tests …“
  (owner, 2026-11-11): knip (`knip.json`: no unused files, exports or
  dependencies), jscpd (`.jscpd.json`: no copied block of 50 tokens or more
  in production code; tests, E2E and version 1 are excluded) and
  dependency-cruiser (`.dependency-cruiser.cjs`: `src/shared` imports neither
  server nor client, the client never the server and the reverse, production
  code no test helpers, server and shared code no dev dependencies, no
  circular imports at runtime).
* **[E]** A gitleaks finding that is no secret (a sample value in a test)
  is removed from the code; when it stays in the history, its fingerprint
  goes into `.gitleaksignore` (`commit:file:rule:line`), named in the pull
  request. First case: the sample token of `src/server/error-log.test.ts`
  in commit f45319c (#126, owner, 2026-11-12).
* **[E]** Security gates: gitleaks over the whole history, `pnpm audit --prod`
  (high blocks), CodeQL `security-extended` (severity ≥ 7.0 blocks), Trivy on
  the image (holes with a fix: in a release pull request, a pull request into
  and a push to `hotfix/**` high and critical block; other pull requests
  block on the critical holes they bring in, compared with the image of the
  base branch; a push to `main` blocks on every critical hole; owner
  2026-11-12). CodeQL runs for every pull
  request, documentation included, because the ruleset of `main` requires a
  CodeQL result for the exact commit (owner, 2026-11-11).
* **[E]** Migrations are append-only: the job "Migrations append-only"
  compares `MIGRATIONS` with the base of the pull request (or the previous
  tip of `main` on a push) and blocks when a released migration was moved,
  removed or changed, whitespace included. It runs for every change. A schema
  snapshot (`src/server/db/schema.snapshot.sql`) shows the resulting schema in
  the review. See [SQLite storage](/data/sqlite.md).

# Kinds of tests in this project

| Kind | Where | What it proves |
|---|---|---|
| Equivalence | `src/shared/equivalence.test.ts`, `catalog.test.ts` | The TypeScript rules compute exactly what version 1 computed: 400 random cases with a fixed seed for production, settling, costs, times, flights, and battles with the same random stream; the catalog is identical. Version 1 is frozen in `src/test/legacy/`. The pictures of version 1 were replaced by the icon set (issue #61, D5); `src/client/logic/icons.test.ts` checks that every catalog entry has an existing icon. |
| Unit | `src/**/*.test.ts` | Rules, store (real SQLite in memory), actions, arrivals, admin, accounts, configuration, mail, operator commands, HTTP API (a real server on a free port), client logic. |
| Upgrade | `src/server/db/migrations.property.test.ts`, `src/server/db/upgrades/` | Every migration runs on generated valid data of the version before (100 per pull request, 1000 nightly with a random seed); changing migrations have their own upgrade test. |
| Sync | `src/server/docs.test.ts`, `src/server/http/security.test.ts` | Every setting is in the docs, `.env.example` and `compose.yaml`; links resolve; the Caddyfile sends the same security headers as the server. |
| E2E | `e2e/game.spec.ts`, `e2e/flows.spec.ts`, `e2e/error-log.spec.ts` | Invitation, single use, login, building, production share, renaming, shipyard, fleet form, espionage with report, admin panel (invite, copy link, revoke, live settings, grow-only), phone layout; the flows of #68 in `flows.spec.ts`: attack with battle report, loot and the defender's report, transport arriving, „Rückruf“, the max and „alles“ buttons, too little Promethium, all fleet slots used, noob protection, galaxy navigation and „Wechseln“, the shipyard max button and its queue, deleting reports, probes per spying, guild membership, login code and „Passwort vergessen“ by mail, copying an invitation link, a new round, push on a server without Web Push, full storage and energy shortage; the error log and problem reports in `error-log.spec.ts`. |
| Accessibility | `e2e/a11y.spec.ts` | axe on every view. |
| Upgrade | `docker/upgrade.sh` in the same job | The last release writes data, the new image starts on the same volume: the data survive, a migration leaves a backup (fail closed, see [SQLite storage](/data/sqlite.md)). |
| Stack | `docker/smoke.sh` in the CI job "Docker image and Compose stack" | Headers through Caddy, uid 1000, invitation mail in Mailpit, registration with its link, admin by command, data after a restart, maintenance by `nova maintenance on\|off` and the Caddy maintenance page with the game stopped; plus: image without compiler, package manager or tests; a wrong setting stops the start; Trivy. |

# Scope of coverage and mutation

* **[V]** Measured: `src/shared`, `src/server`, `src/client/logic`. Not
  measured, like the Astro templates in muffelblog: the HTML templates
  (`src/client/views`), the browser glue
  (`src/client/main.ts`) and the process entry points (`main.ts`, `cli.ts`).
  The E2E suite and the Compose job run them.

# Level at the introduction (2026-11-06)

* 24 test files, 190 unit tests; 99.5 % lines, 95.4 % branches.
* 11 E2E tests (8 game, 3 accessibility).
* Mutation score of the complete run: 92.6 % (2,403 killed, 10 timed out, 175 survived; client logic 96.9 %).

# E2E inventory (2026-11-13, #68)

* 78 E2E tests in four files (67 desktop, 11 phone): `game.spec.ts` 50,
  `flows.spec.ts` 15, `error-log.spec.ts` 8, `a11y.spec.ts` 5. Locally the
  suite took 3.2 minutes before #68 and 4.6 minutes after it; in the CI it
  took 2.8 minutes on `main` before.
* Flows of #68 found covered already: „Abbrechen“ of a research with refund
  („research starts on a colony with its own lab and is paid there“) and the
  daily reward („filters achievements and keeps tomorrow’s reward after
  claiming“).
* **[U]** Push: a real subscription needs `NOVA_WEB_PUSH=1` with an HTTPS
  address and a push service; the E2E server has neither, so the test covers
  the refusal of such a server and „Deaktivieren“ only.

# Risks

* **[U]** The CI workflows were written after muffelblog and checked locally
  step by step (lint, types, tests, coverage, Stryker, Playwright, image
  build, Compose stack with smoke test, gitleaks); the first run on GitHub is
  the proof.
* Mutation tests take minutes; the incremental run keeps pull requests and
  pushes to `main` fast. Stryker's incremental mode only notices changes in
  mutated files and tests, not in helpers or configuration; the complete
  nightly run catches what it misses.
