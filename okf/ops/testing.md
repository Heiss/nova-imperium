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
* **[E]** Mutation runs are sharded into 4 parallel jobs everywhere: pull
  requests and pushes to `main` (incremental), the release pull request and
  the nightly run (complete). A script splits the mutated files by their
  estimated run time, heaviest first onto the emptiest job: the test time
  of their mutants in the last report, so static mutants weigh what they
  cost; a file the report does not know weighs by its lines. A file heavier
  than half a job is cut into line ranges between its top-level statements
  (owner, 2026-11-13: the split by mutant count left one job at 44 minutes
  and the others at 7 to 14). Each job keeps its own incremental cache. A
  gate job merges the four reports and checks the total score (80 %) and
  every per-file floor exactly as before; no mutant and no check is dropped
  (owner, 2026-11-12, #131).
* **[E]** Before the merge of #131, one complete sharded run in its pull
  request is compared with the last nightly run: the total score and every
  file score must match (owner, 2026-11-12).
* **[E]** Display texts are not mutation-tested (owner, 2026-11-12, #131):
  the names, abbreviations, short and long texts of the catalog and the
  mission names live in `src/shared/texts.ts`, which Stryker leaves out
  (`stryker.config.json`); it has no floor in `mutation-standard.json`.
  Each text was a static mutant that reloaded every test, most of the time
  of a run. Their exactness is guarded by the catalog, naming and
  explanation tests (`catalog.test.ts`, `src/test/naming.test.ts`,
  `explain.test.ts`) and `src/shared/texts.test.ts` (every catalog entry
  has its texts, no text without an entry). Game values stay mutated in
  `catalog.ts`. See [Design patterns](/architecture/patterns.md).
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
| E2E | `e2e/game.spec.ts` | Invitation, single use, login, building, production share, renaming, shipyard, fleet form, espionage with report, admin panel (invite, copy link, revoke, live settings, grow-only), phone layout. |
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
    JSON: 4 sorted lists of `mutate` entries, `file` or `file:from-to`.
  * `config <n>` writes `reports/stryker-shard.config.json`: the
    configuration of `stryker.config.json` with only the files of shard n
    and `thresholds.break: null`, and prunes the shard's incremental file to
    its files and, of a cut file, to the mutants wholly in its ranges. Stryker keeps and reports again the old results of files it
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
  as job output), „Mutation tests (shard N of 4)“ (`mutation-shard`, matrix
  1 to 4, `fail-fast: false`, incremental, `--force` when the head branch is
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
* **[V]** Text module (#131): `src/shared/texts.ts` exports `BUILD_TEXT`,
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

* **[V]** Measured: `src/shared`, `src/server`, `src/client/logic`. Not
  measured, like the Astro templates in muffelblog: the HTML templates
  (`src/client/views`), the browser glue
  (`src/client/main.ts`) and the process entry points (`main.ts`, `cli.ts`).
  The E2E suite and the Compose job run them.
* **[E]** Not mutated: the display texts in `src/shared/texts.ts` (see the
  decision above); they count for the coverage.

# Level at the introduction (2026-11-06)

* 24 test files, 190 unit tests; 99.5 % lines, 95.4 % branches.
* 11 E2E tests (8 game, 3 accessibility).
* Mutation score of the complete run: 92.6 % (2,403 killed, 10 timed out, 175 survived; client logic 96.9 %).

# Risks

* **[U]** The CI workflows were written after muffelblog and checked locally
  step by step (lint, types, tests, coverage, Stryker, Playwright, image
  build, Compose stack with smoke test, gitleaks); the first run on GitHub is
  the proof.
* Mutation tests take minutes; the incremental run keeps pull requests and
  pushes to `main` fast. Stryker's incremental mode only notices changes in
  mutated files and tests, not in helpers or configuration; the complete
  nightly run catches what it misses.
