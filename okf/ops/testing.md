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
  (job „Detect changes“ in `.github/workflows/ci.yml`). This replaces
  the earlier rule of round 1 that the whole suite runs on every pull
  request.
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
* **[E]** The mail tests of #68 run against a second server of the E2E
  start (`e2e/env.ts`: port 8098, SMTP to the sink on 127.0.0.1:8025, login
  codes on), because SMTP and login codes on the first server would change
  the existing tests (the admin's „Kein SMTP eingerichtet“ and every login).
  The sink (`e2e/mail.ts`) writes each mail as a JSON line to a file the
  tests read. The new-round test runs there too: its own universe, so the
  reset touches no planet of the other tests. `e2e/seed.ts` lands any
  mission (`landFleet`), brings returning fleets home (`returnFleet`),
  finishes units of the shipyard queue (`finishUnits`) and dates the home
  planet back (`settledAgo`) (owner, 2026-11-13, #68).
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
* **[E]** Mutation runs are sharded into 6 parallel jobs everywhere (owner,
  2026-11-13: 4 jobs took 16.5 to 19 minutes each and missed the target of
  about 12 to 15 minutes; with 6 the measured times give about 41.5
  mutant-minutes per job, about 12 to 16 minutes; 8 would gain nothing,
  because the largest piece of `catalog.ts` alone weighs 40): pull
  requests and pushes to `main` (incremental), the release pull request and
  the nightly run (complete). A script splits the mutated files by their
  estimated run time, heaviest first onto the emptiest job: the test time
  of their mutants in the last report, so static mutants weigh what they
  cost; a file the report does not know weighs by its lines. A file heavier
  than half a job is cut into line ranges between its top-level statements
  (owner, 2026-11-13: the split by mutant count left one job at 44 minutes
  and the others at 7 to 14). Each job keeps its own incremental cache. A
  gate job merges the six reports and checks the total score (80 %) and
  every per-file floor exactly as before; no mutant and no check is dropped
  (owner, 2026-11-12, #131).
* **[E]** Before the merge of #131, one complete sharded run in its pull
  request is compared with the last nightly run: the total score and every
  file score must match (owner, 2026-11-12).
* **[E]** Display texts are not mutation-tested (owner, 2026-11-12, #131):
  the names, abbreviations, short and long texts of the catalog and the
  mission names live in `src/core/texts.ts`, which Stryker leaves out
  (`stryker.config.json`); it has no floor in `mutation-standard.json`.
  Since #113 the texts of each catalog entry live in
  `src/features/<key>/texts.de.ts`, which Stryker leaves out the same way
  (owner, 2026-11-13); `src/core/texts.ts` keeps the mission names, and the
  accessor `text(key)` (`src/core/text.ts`) is mutated.
  Each text was a static mutant that reloaded every test, most of the time
  of a run. Their exactness is guarded by the catalog, naming and
  explanation tests (`catalog.test.ts`, `src/test/naming.test.ts`,
  `explain.test.ts`) and `src/core/text.test.ts` (#113: every catalog entry
  has a name, an abbreviation and a short text, abbreviations are unique,
  no text without an entry); `src/test/mutation-shards.test.ts` checks that
  no text file is mutated. Game values stay mutated in
  `catalog.ts`, and since #114 in the `src/features/<key>/entry.ts` of
  each entry. See [Design patterns](/architecture/patterns.md).
* **[E]** Contract tests per component (#114): each component under
  `src/core/components/` has its test next to it
  (`src/core/components/<component>.test.ts`), which runs for every entry
  that has the component, read from the generated index; a new entry needs
  no new test code. A property test (`src/core/production.test.ts`) keeps
  `prod()` bit-identical to its form before #114 (owner, 2026-11-13), and
  `src/core/battle-reference.test.ts` keeps `battle()` bit-identical to its
  form before the combat components (#114, second pull request). See
  [Design patterns](/architecture/patterns.md), section 12.
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
  Checkouts keep no credentials, except where a job pushes with the release
  App's token: `tag.yml` (`scripts/release.sh` pushes the tag),
  `release-pr.yml` (`scripts/release-pr.sh` pushes `release/<branch>`) and
  the hotfix job of `security-hotfix.yml` (it pushes the hotfix branches).
  The `workflow_run` trigger of `tag.yml` is accepted on purpose: it runs
  only after a successful CI push run on `main` or `hotfix/**` of this
  repository and checks out the head branch of that run (`main` or
  `hotfix/**`), never pull request code.
* **[E]** Code hygiene blocks in the job „Lint, types, unit tests …“
  (owner, 2026-11-11): knip (`knip.json`: no unused files, exports or
  dependencies), jscpd (`.jscpd.json`: no copied block of 50 tokens or more
  in production code; tests, E2E and version 1 are excluded) and
  dependency-cruiser (`.dependency-cruiser.cjs`: `src/core` imports neither
  server nor client, the client never the server and the reverse, production
  code no test helpers, server, core and feature code no dev dependencies,
  no circular imports at runtime; the boundaries of the feature folders,
  see [Design patterns](/architecture/patterns.md), section 11, tested by
  `src/test/boundaries.test.ts` on a small project per rule).
* **[E]** A gitleaks finding that is no secret (a sample value in a test)
  is removed from the code; when it stays in the history, its fingerprint
  goes into `.gitleaksignore` (`commit:file:rule:line`), named in the pull
  request. First case: the sample token of `src/server/error-log.test.ts`
  in commit f45319c (#126, owner, 2026-11-12).
* **[E]** Security gates: gitleaks over the whole history, `pnpm audit --prod`
  (high blocks), CodeQL `security-extended` (severity ≥ 7.0 and every result of level
  „error“ block, `.github/scripts/codeql-gate.mjs`), Trivy on
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
| Equivalence | `src/core/equivalence.test.ts`, `catalog.test.ts` | The TypeScript rules compute exactly what version 1 computed: 400 random cases with a fixed seed for production, settling, costs, times, flights, and battles with the same random stream; the catalog is identical. Version 1 is frozen in `src/test/legacy/`. The pictures of version 1 were replaced by the icon set (issue #61, D5); `src/client/logic/icons.test.ts` checks that every catalog entry has an existing icon. |
| Unit | `src/**/*.test.ts` | Rules, store and one test file per repository in `src/server/db/repos/` (real SQLite in memory, #117), actions, arrivals, admin, accounts, configuration, mail, operator commands, HTTP API (a real server on a free port), client logic. |
| Upgrade | `src/server/db/migrations.property.test.ts`, `src/server/db/upgrades/` | Every migration runs on generated valid data of the version before (100 per pull request, 1000 nightly with a random seed); changing migrations have their own upgrade test. |
| Sync | `src/server/docs.test.ts`, `src/server/http/security.test.ts` | Every setting is in the docs, `.env.example` and `compose.yaml`; links resolve; the Caddyfile sends the same security headers as the server. |
| E2E | `e2e/game.spec.ts`, `e2e/flows.spec.ts`, `e2e/error-log.spec.ts` | Invitation, single use, login, building, production share, renaming, shipyard, fleet form, espionage with report, admin panel (invite, copy link, revoke, live settings, grow-only), phone layout; the flows of #68 in `flows.spec.ts`: attack with battle report, loot and the defender's report, transport arriving, „Rückruf“, the max and „alles“ buttons, too little Promethium, all fleet slots used, noob protection, galaxy navigation and „Wechseln“, the shipyard max button and its queue, deleting reports, probes per spying, guild membership, login code and „Passwort vergessen“ by mail, copying an invitation link, a new round, push on a server without Web Push, full storage and energy shortage; the error log and problem reports in `error-log.spec.ts`. |
| Accessibility | `e2e/a11y.spec.ts` | axe on every view. |
| Upgrade | `docker/upgrade.sh` in the same job | The last release writes data, the new image starts on the same volume: the data survive, a migration leaves a backup (fail closed, see [SQLite storage](/data/sqlite.md)). |
| Stack | `docker/smoke.sh` in the CI job "Docker image and Compose stack" | Headers through Caddy, uid 1000, invitation mail in Mailpit, registration with its link, admin by command, data after a restart, maintenance by `nova maintenance on\|off` and the Caddy maintenance page with the game stopped; plus: image without compiler, package manager or tests; a wrong setting stops the start; Trivy. |

# Code of the sharded mutation runs (#131)

* **[V]** `scripts/mutation-shards.ts` (tests in
  `src/test/mutation-shards.test.ts`):
  * `plan` lists the files of the `mutate` globs of `stryker.config.json`
    (in order, `!` removes) and weighs each by the test time (`duration`) of
    its mutants in `reports/mutation/mutation.json`, restored from the cache:
    the merged report of the last **complete** run (`stryker-weights-…`,
    saved by `mutation.yml` and by a release pull request), else the last
    merged report. The first complete sharded run planned with an
    incremental report: its reused results put shard 4 at 56 instead of 101
    mutant-minutes, 36 instead of about 22 minutes (owner, 2026-11-13). In
    that run the reported times matched the wall time of every shard
    (factor 0.35 to 0.41). A mutant without a time costs
    the mean of its kind (static or not), a report without times counts
    mutants, a file the report does not know costs its lines times the mean
    of a mutant that is not static. A TypeScript file heavier than half a
    shard is cut after each top-level statement that the next one does not
    share (TypeScript parser, so the plan job installs the dependencies);
    each piece weighs its mutants by their start line, and a piece without
    weight joins its neighbour. Stryker mutates a node only when it lies
    wholly in one range, and no node spans two top-level statements, so no
    mutant is lost; one statement (for example `RES` in `catalog.ts`) stays
    one piece. The pieces and files are split greedily, heaviest first
    (equal weights by name) onto the lightest shard (the first of equal
    ones); then neighbouring pieces of a shard become one range and a file
    with all its pieces on one shard is whole again. It prints the plan as
    JSON: 6 sorted lists of `mutate` entries, `file` or `file:from-to`.
  * `config <n>` writes `reports/stryker-shard.config.json`: the
    configuration of `stryker.config.json` with only the files of shard n
    and `thresholds.break: null`, and prunes the shard's incremental file to
    its files and, of a cut file, to the mutants wholly in its ranges; a
    cut file whose source changed since the cached run starts without its
    cache, because Stryker moves cached mutants of a changed file to their
    new lines and reports a moved one outside the ranges again (CodeRabbit
    on #133). Stryker keeps and reports again the old results of files it
    does not mutate this time; without the pruning a file that moved to
    another shard would be reported twice (seen locally).
  * `merge <out> <report>...` checks that every shard of the plan ran once,
    matched by the `mutate` list in its report, and reported only its own
    files and no file twice; a cut file may be in several reports, but each
    shard reports only mutants in its ranges, no mutant is in two reports,
    and its ranges cover it from line 1 to its last line without overlap.
    Then it writes the union of the files (the mutants of a cut file
    joined) with the
    thresholds of `stryker.config.json`, without `testFiles` and `config`
    (test ids are numbered per shard). Stryker leaves files without mutants
    (`types.ts`, `index.ts`) out of its report, so completeness is checked
    by the lists, not by the files present.
* **[V]** `scripts/mutation-gate.ts --report <path>` reads the merged report;
  it now also fails a total below the break threshold of
  `stryker.config.json` (80 %; the shards run without it) and prints every
  file with its counts and the total, so two runs can be compared.
* **[V]** Jobs in `ci.yml`: „Mutation plan“ (`mutation-plan`, once, the plan
  as job output), „Mutation tests (shard N of 6)“ (`mutation-shard`, matrix
  1 to 6, `fail-fast: false`, incremental, `--force` when the head branch is
  `release/*`, uploads `mutation-shard-N`), „Mutation tests“ (`mutation`,
  the gate: merge, total, floors). The CI Gate requires all three when code
  changed. `mutation.yml` (nightly and „Run workflow“) runs the same three
  jobs complete and keeps the merged report as the artifact
  `mutation-report` for 30 days.
* **[V]** Caches: per shard `stryker-shard<N>-<ref>-<sha>` (nightly with
  `-<run id>`), restored from the same shard on the same ref, then on
  `main`; the merged report `stryker-report-<ref>-<sha>`, saved by the gate
  job when the merge succeeded and restored by the plan job (the weights).
  The first run after the merge has no shard caches and tests every mutant
  once; a file that moves to another shard is tested again there.
* **[V]** Proof run (decision above): „Run workflow“ of „Mutation tests
  (nightly)“ on a branch runs the complete sharded run there:
  `gh workflow run mutation.yml --ref <branch>`. The display texts leave
  the mutated code in the same pull request, so `catalog.ts` and the total
  differ from a run before it; the like-for-like proof is a branch with the
  sharding commit only on the same `main` as a complete unsharded run
  (`gh workflow run mutation.yml --ref main` before the merge). The gate
  log lists every file with its counts; Stryker's table of the unsharded run
  shows the same counts.
* **[V]** Text module (#131): `src/core/texts.ts` exports `BUILD_TEXT`,
  `RES_TEXT`, `SHIP_TEXT`, `DEF_TEXT` (`n`, `ab`, `ds`, `lt` keyed by the
  entry key) and `MISSION_TEXT`; every catalog entry starts with
  `...BUILD_TEXT.<key>` and so on, `MISSION` takes its values from
  `MISSION_TEXT`. The objects are equal to before; only the order of the
  fields inside an entry changed (texts first). Measured locally (2026-11-13):
  `catalog.ts` had 426 mutants, 420 of them static (180 of them the texts);
  now 246, 240 static (empty objects and lists, drive names, `once`), score
  99.59 % (245 killed, 1 survived) above its floor of 98.76 %, 19 minutes
  for this file alone with 4 test runners.

# Scope of coverage and mutation

* **[V]** Measured: `src/core`, `src/server`, `src/client/logic`. Not
  measured, like the Astro templates in muffelblog: the HTML templates
  (`src/client/views`), the browser glue
  (`src/client/main.ts`) and the process entry points (`main.ts`, `cli.ts`).
  The E2E suite and the Compose job run them.
* **[E]** Not mutated: the display texts in `src/core/texts.ts` and
  `src/features/<key>/texts.de.ts` (see the decision above); they count
  for the coverage.

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
  claiming“, which now also checks that the resource bar rises by the
  reward of day 1, owner 2026-11-13).
* **[E]** Push in the E2E suite: the test covers the notice of a server
  without Web Push and „Deaktivieren“; sending stays with the unit tests of
  `web-push.ts` (owner, 2026-11-13, #68). A real subscription would need
  `NOVA_WEB_PUSH=1` with an HTTPS address and a push service.

# Risks

* **[U]** The CI workflows were written after muffelblog and checked locally
  step by step (lint, types, tests, coverage, Stryker, Playwright, image
  build, Compose stack with smoke test, gitleaks); the first run on GitHub is
  the proof.
* Mutation tests take minutes; the incremental run keeps pull requests and
  pushes to `main` fast. Stryker's incremental mode only notices changes in
  mutated files and tests, not in helpers or configuration; the complete
  nightly run catches what it misses.
