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
  (job „Detect changes“ in `.github/workflows/ci.yml`); the release pull
  request of `main` only in its full run (#147). This replaces
  the earlier rule of round 1 that the whole suite runs on every pull
  request. The mutation tests run in a pull request only when it changes
  what they test (#146, below).
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
  incremental on pull requests (only those that change what they test,
  #146; a head that only merged `main` takes over the green result of the
  head before, #167; the release pull request of `main` runs it
  completely in its full run, #147) and on
  pushes to `main` (unchanged code keeps its cached result),
  complete every night (owner, 2026-11-11). Tag workflows verify the
  earlier CI result.
* **[E]** Mutation runs are sharded into 6 parallel jobs everywhere (owner,
  2026-11-13: 4 jobs took 16.5 to 19 minutes each and missed the target of
  about 12 to 15 minutes; with 6 the measured times give about 41.5
  mutant-minutes per job, about 12 to 16 minutes; 8 would gain nothing,
  because the largest piece of `catalog.ts` alone weighs 40): pull
  requests and pushes to `main` (incremental), the release pull request and
  the nightly run (complete). A script splits the mutated files by their
  estimated run time, heaviest first onto the emptiest job (since #141
  every file stays on its job, below): the test time of their mutants in
  the last report, so static mutants weigh what they cost; a file the report does not know weighs by its lines. A file heavier
  than half a job is cut into line ranges between its top-level statements
  (owner, 2026-11-13: the split by mutant count left one job at 44 minutes
  and the others at 7 to 14). Each job keeps its own incremental cache. A
  gate job merges the six reports and checks the total score (80 %) and
  every per-file floor exactly as before; no mutant and no check is dropped
  (owner, 2026-11-12, #131).
* **[E]** Stable shards instead of feedback (owner, 2026-11-13, #141):
  every file (or cut range) stays on the shard it had in the last plan, so
  the shard keeps its cached results; the plan moves entries only when a
  shard is above a tolerance of about 1.5 times the mean planned weight,
  and new files go onto the lightest shard. The research (job logs and step
  timings of eight complete and two incremental runs) found: totals stable
  (−5 to +16 % between runs on the same code) but weights of the previous
  complete run left the shards 1.8 to 6.7 times apart (max ÷ min); static
  mutants cause the imbalance (static phase 15–99 % of the mutation phase,
  correlation 0.84 with shard time), not the fixed cost of about 80 s per
  shard; a factor per file improves the next spread by at most about 10 %,
  a factor per shard number harms (up to 25×), EMA 0.3, EMA 0.5 and the
  median of 3 differ by less than the noise; the bigger loss was a plan
  that moved entries on every run: two pushes to `main` took over only
  11 % (646 of 5866) and 14 % (845 of 5972) of the mutant results.
* **[E]** Signal and weights (owner, 2026-11-13, #141): D1, the mutant
  times of the report only (no wall-time factor, not Stryker's estimate);
  D2, every run updates the weights of the mutants it really ran, the
  others keep their old time (StrykerJS 10.1.1 copies only `status`,
  `statusReason` and `testsCompleted` into a result it takes over, so
  exactly the mutants that ran carry a `duration`); D3, no smoothing, the
  latest time counts.
* **[V]** Per-mutant noise (measured 2026-11-14 from the artifacts
  `mutation-report` of the complete runs 43394493218 and 43422574873, whose
  code differs by a few merges, so an upper bound): of 4622 mutants with a
  time in both, the ratio of the later to the earlier time is 0.46 / 0.81 /
  1.33 (10th / 50th / 90th percentile) for the 4149 others and 0.017 /
  0.85 / 21 for the 473 static mutants; per file (40 files with the same
  mutants) 0.22 / 0.84 / 1.34. Six shards planned with the weights of one
  run and weighed with the other end at 1.14 and 1.18 times the mean
  (both directions, current files and cuts). The other artifacts of those
  runs and of the release pull request runs were on storage hosts the
  session's proxy refused (`productionresultssa9`, `-sa15`, `-sa32`
  `.blob.core.windows.net`; `-sa1` and `-sa16` were reachable).
* **[E]** Before the merge of #131, one complete sharded run in its pull
  request is compared with the last nightly run: the total score and every
  file score must match (owner, 2026-11-12).
* **[E]** A pull request runs the mutation jobs only when it changes what
  they test (owner, 2026-11-13, #146): a file of the `mutate` globs of
  `stryker.config.json`, a test file, or one of `stryker.config.json`,
  `mutation-standard.json`, `vitest.config.ts`, `scripts/mutation-*.ts`
  and `tsconfig.json`; or when its lockfile diff changes a version of
  `@stryker-mutator/*`, `vitest` or `typescript`. Other dependency updates
  (Renovate, the fix of a security hotfix) and the `Dockerfile` skip them:
  the mutants and the tests stay the same, and lint, types, unit tests,
  build, E2E, the image, Trivy, the Compose stack and the upgrade test
  secure such a change. Pushes to `main` and `hotfix/**` keep the full
  suite with the mutation run on every push; that also keeps the shard
  caches and the weights current. The release pull request of a hotfix
  branch changes only `CHANGELOG.md`, `VERSION` and `changes/`, so it
  compares with the release tag the hotfix branch starts from, with the
  same rules as above: a hotfix that changes a mutated file, a test or the
  mutation configuration runs the mutation jobs, and so does one whose
  lockfile changes a version of the test tool chain; other dependency or
  `Dockerfile` changes do not. When no release tag lies below the base
  of such a release pull request, „Detect changes“ fails, as the
  migration check does (owner, 2026-11-13). The release pull request of
  `main` runs the complete mutation run in its full run only, after it is
  marked „Ready for review“; its draft runs no mutation job (owner,
  2026-11-13 and 2026-11-14, #147, see
  [Branching and release](/ops/branching-release.md)). Risk: a change
  that alters the results without touching these files is found by the
  nightly complete run only, up to a day later. Stryker's incremental mode would not notice
  such a change either (checked in its documentation before the build,
  2026-11-13; this replaces the [U] of the issue): „Stryker will not
  detect any changes you've made in files other than mutated files and
  test files“, and „Any other changes to your environment are not
  detected, such as updates to other files, updated (dev) dependencies, …“
  ([Incremental, Limitations](https://stryker-mutator.io/docs/stryker-js/incremental/)).
  An incremental run of a dependency update reuses every result and only
  repeats the dry run.
* **[E]** Test files for #146 (owner, 2026-11-13, O12): what Vitest
  runs (`test.include` of `vitest.config.ts`, `src/**/*.test.ts`) and the
  test helpers it imports (`src/test/**`, `src/server/test-helpers.ts`, as
  in the rule `tests-stay-out` of `.dependency-cruiser.cjs`). The E2E
  tests (`e2e/`) are not: Stryker does not run them.
* **[E]** A pull request into `main` whose newest head only merged `main`
  takes over the mutation result of the head before instead of mutating
  again (owner, 2026-11-13, #167, chosen with #141 to cut the waiting time
  of the release loop; „mutation only on `main`“ and a merge queue were
  not chosen). The earlier result is the check run „Mutation tests“ of the
  first parent of the head, read through the API; it must be `success`.
  The jobs need `checks: read`; no cache and no artifact. If the earlier
  green result cannot be found (a cancelled or deleted run, a first
  parent that is not a commit of the pull request), the mutation jobs run
  as before.
* **[E]** Which merge of `main` blocks the takeover (owner, 2026-11-13,
  revised on #167 after the first build measured the earlier rule: it
  would have taken over 0 of 10 merges, every one changed `okf/log.md`
  and nine brought in test files). The full mutation jobs run when the
  merge (first parent..head) changes a file of the mutation run (a
  mutated file by the `mutate` globs of `stryker.config.json`, a test
  file or a file of the mutation configuration, as defined in #146) that
  the pull request itself changes against `main` too, or when its
  lockfile changes the test tool chain (`@stryker-mutator/*`, `vitest`,
  `typescript`, the check of #146). Other files from `main`
  (documentation, `okf/`, other tests, other code) do not block. This
  replaces „no file the pull request changes“ and lifts „no test file“
  of the first decision. The push run of `main` and the nightly complete
  run still test everything. Risk: a change from `main` can change the
  result of the pull request's code without touching its files (a shared
  helper, another test, a mutation configuration the pull request leaves
  alone); the push run of `main` after the merge finds it.
* **[E]** The takeover happens once in a row (owner, 2026-11-13, #167): a
  head that took over a result has a skipped „Mutation tests“, so the
  next merge of `main` runs the jobs again.
  Checked before the build (2026-11-13, replaces the [U] of #167):
  the `GITHUB_TOKEN` is an installation access token of the GitHub Actions
  app, limited to the repository of the workflow, and the permission
  `checks: read` covers „List check runs for a Git reference“
  (`GET /repos/{owner}/{repo}/commits/{ref}/check-runs`) for any commit of
  that repository (GitHub docs: „GITHUB_TOKEN“, the permission table of
  the workflow syntax, and the permissions required for GitHub Apps; read
  from the sources of github/docs, the site was not reachable). Setting
  `permissions` on a job sets every permission not named to `none`, so the
  jobs name `contents: read` too. The check runs of a pull request run sit
  on its head commit, not on the merge commit `refs/pull/N/merge`
  (checked on #165: „Mutation tests“ of head `666a75d` from the run of
  event `pull_request`). The first run in a pull request proves the token.
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
  Since #116 the mission names live in
  `src/features/missions/<m>/texts.de.ts`, left out by the same glob, and
  `src/core/texts.ts` is gone (owner, 2026-11-14); its line in
  `stryker.config.json` stays, so the file stays out if it ever comes back.
  `src/core/missions.test.ts` requires one name per mission and no text
  file without a mission; the accessor `missionText(m)` in
  `src/core/text.ts` is mutated.
* **[E]** Contract tests per component (#114): each component under
  `src/core/components/` has its test next to it
  (`src/core/components/<component>.test.ts`), which runs for every entry
  that has the component, read from the generated index; a new entry needs
  no new test code. A property test (`src/core/production.test.ts`) keeps
  `prod()` bit-identical to its form before #114 (owner, 2026-11-13), and
  `src/core/battle-reference.test.ts` keeps `battle()` bit-identical to its
  form before the combat components (#114, second pull request), and
  `src/core/flight-reference.test.ts` keeps speed, fuel and cargo of a
  fleet bit-identical to their form before the flight component (#114,
  third pull request). See
  [Design patterns](/architecture/patterns.md), section 12.
* **[E]** Missions as strategies (#116, owner, 2026-11-14): contract tests
  for the rules of every mission (`src/core/missions.test.ts`) and for its
  server part (`src/server/game/missions.test.ts`) read the generated
  indexes, so a new mission is checked without new test code; each mission
  folder tests its own `canSend` and `onArrive` with a seeded random
  generator and a fixed clock. The property test
  `src/server/game/missions-reference.test.ts` keeps sending, the arrival
  and the coming home bit-identical to the code before #116 (a frozen copy
  of `arrival.ts` and of the sending part of `fleet-actions.ts`): on 400
  generated worlds and fleets (fixed fast-check seed 116) it builds two
  equal databases in memory, runs both versions, and compares the answer or
  message, every table and the next random number; a third case checks
  that the generated cases reach every message and every arrival.
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
  `hotfix/**`), never pull request code. So is the `pull_request_target`
  trigger of `release-ready.yml` (#147): it runs the workflow of `main`,
  checks out nothing, and only adds and removes a label on the release
  pull request of `main`.
* **[V]** `src/test/ci-release.test.ts` (#147) runs the shell of „Detect
  changes“ and of the CI Gate from `ci.yml` with bash and the inputs GitHub
  would give: the cheap run of the draft release pull request of `main`,
  its gate failing on purpose, every check required in every other release
  pull request, and every other pull request unchanged; it also checks that
  `ci.yml` keeps its event types and runs the step of `release-ready.yml`
  with a stub `gh`: label without the hotfix marker, refusal (draft and
  comment, no label) with it, nothing when the body cannot be read.
  `src/test/release-pr.test.ts` runs `scripts/release-pr.sh` in a
  throwaway repository with a stub `gh`: the release pull request of
  `main` is never marked ready, and its body carries the marker exactly
  while a released hotfix is not merged back.
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
    its mutants in the weights of `reports/mutation-state.json` (#141,
    below); without a state in `reports/mutation/mutation.json`, restored
    from the cache: the merged report of the last **complete** run
    (`stryker-weights-…`, saved by `mutation.yml` and by a release pull
    request), else the last merged report. The first complete sharded run planned with an
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
    one piece. Every piece and file stays on its shard of the plan in the
    state (#141): the shard with the whole file, or with the range that
    holds the piece's first line; a file that is cut now keeps its pieces on
    the shard of the whole file, a cut file that is whole again goes to the
    shard of its line 1. The others are new and go onto the lightest shard
    (the first of equal ones), heaviest first (equal weights by name);
    without a state of 6 shards every entry is new, which is the greedy
    split of #131. Then each shard above 1.5 times the mean weight gives
    entries to the lightest shard, as long as one fits there without
    lifting it above that limit: the lightest entry that brings the shard
    within the limit alone, else the heaviest that fits, and again; an entry
    without weight never moves. Then neighbouring pieces of a shard become
    one range and a file with all its pieces on one shard is whole again.
    It prints the plan as JSON: 6 sorted lists of `mutate` entries, `file`
    or `file:from-to`; the log names the new and the moved entries. It
    writes the state again: the new plan and the weights it used, the
    mutants with place, change, `static` and `duration` only.
  * `weights <state> <report>` (#141) replaces the weights of the state by
    the files of the merged report, each mutant with its `duration` in this
    run; a mutant without one (a result Stryker took over, or one without
    coverage) keeps the time of the same mutant in the old weights: the one
    at the same place with the same mutator and replacement, else, when its
    lines moved, the next old one of the same mutator, replacement and kind
    (static or not) that no new mutant has at its place, in order. A file
    that is gone drops out. No smoothing.
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
  the gate: merge, total, floors). The CI Gate requires all three when the
  output `mutation` of „Detect changes“ is `true`, and accepts their skip
  only when it is `false` (#146) or `reuse` (#167, below); any other value
  fails. `mutation.yml` (nightly and „Run
  workflow“) runs the same three jobs complete and keeps the merged report as the artifact
  `mutation-report` for 30 days.
* **[V]** Caches: per shard `stryker-shard<N>-<ref>-<sha>` (nightly with
  `-<run id>`), restored from the same shard on the same ref, then on
  `main`; the merged report `stryker-report-<ref>-<sha>`, saved by the gate
  job when the merge succeeded and restored by the plan job (the weights).
  The first run after the merge has no shard caches and tests every mutant
  once; a file that moves to another shard is tested again there.
* **[E]** Tolerance 1.5 times the mean planned weight (#141, `TOLERANCE`
  in `scripts/mutation-shards.ts`; owner, 2026-11-14): the owner's guide value, and just
  above the drift measured between two complete runs (a plan weighed with
  the other run's times ended at 1.14 and 1.18 times the mean, the earlier
  research saw shard totals move by −5 to +16 %), so noise alone moves no
  entry and keeps the shard caches; it still bounds the slowest shard at
  1.5 times the ideal. With every mutant of the files of one shard made 3
  times slower in the measured weights (1.75 times the mean), the next plan
  moved 2 entries and ended at 1.49, and the plan after it moved none.
* **[E]** Source of the previous plan (#141; owner, 2026-11-14): the state
  `reports/mutation-state.json` in the cache `stryker-state-<ref>-<sha>-<run
  id>-<attempt>`, next to the other mutation caches. The plan job restores
  the newest of its own ref, else of `main` (the same order as the shard
  caches, so the plan and the cached results of each shard belong
  together), plans, and uploads the new state as the artifact
  `mutation-state` (7 days). The gate job downloads it, runs `weights`
  after the merge and saves it when that succeeded, also when the gate
  fails, so every run updates the weights (D2). The merged report caches
  (`stryker-weights-…`, `stryker-report-…`) stay and are restored only
  without a state, for the first plan. Not chosen: a checked-in file
  (collides between parallel pull requests), the job output of an earlier
  run (not readable by a later one) and the artifacts (need the Actions
  API and a token in the plan job). A pull request saves its state under
  its own ref, which `main` never reads.
* **[E]** Points the decisions of #141 left open, confirmed by the owner
  (2026-11-14): a mutant whose lines moved takes the time of the next old
  mutant of the same mutator, replacement and kind (static or not); a
  failing `weights` step fails the gate job, so a bug is visible; the
  tolerance is an upper bound only, because the slowest shard sets the
  wall time; the merged report caches stay as the start while no state
  exists.
* **[V]** `scripts/mutation-changes.ts <from> <to>` (tests in
  `src/test/mutation-changes.test.ts`, #146) prints `true` or `false` and
  the reasons on stderr. It reads the changed files with
  `git diff --name-only --no-renames` (a moved file counts with its old
  and its new path) and matches them against the `mutate` globs of
  `stryker.config.json` (in order, the last matching pattern decides, as
  in the plan; a test checks that both agree on every file of `src/`),
  the test files and the mutation configuration. When `pnpm-lock.yaml`
  changed, it compares the keys `name@version` of the section `packages`
  of both lockfiles for the tool chain; it fails when the new lockfile
  names no version of one of the tools, so a changed lockfile format never
  skips the run unnoticed. „Detect changes“ sets up Node for it (no
  dependencies) and writes the output `mutation`: `true` on a push and in
  the full run of the release pull request of `main` (its draft writes
  `false` for every output, #147); in the release pull request of a
  hotfix branch the script compares the release tag below the base
  (`git describe --tags --abbrev=0 --match '[0-9]*.[0-9]*.[0-9]*'`, as
  the migration check does) with the merge commit, and fails without
  such a tag (decision above); every other pull request compares its
  base with the merge commit.
* **[V]** `scripts/mutation-reuse.ts` (tests in
  `src/test/mutation-reuse.test.ts`, #167). „Detect changes“ calls
  `decide <base> <tested> <head>` when `mutation-changes.ts` said `true`
  in a pull request into `main` that is not a release pull request:
  `<tested>` is the merge commit the CI checks out (`github.sha`), `<head>`
  the head commit of the branch (`pull_request.head.sha`), where the
  check runs are. It prints `reuse` when all hold, else `true` with the
  reasons on stderr: the head has two parents; the second is an ancestor
  of the base (a commit of `main`), the first is not (a commit of the pull
  request); the tested commit has the tree of the head (main did not move
  after the merge, so the tested code is the head's); no file of the merge
  (`git diff --no-renames` first parent..head) that base..tested changes
  too is a file of the mutation run (`reason` of `mutation-changes.ts`
  with the `mutate` globs of the checked-out `stryker.config.json`); the
  merge's lockfile keeps the test tool chain (`lockfileReason` of
  `mutation-changes.ts`, a lockfile without a tool version fails and so
  runs the jobs); and the newest check run (highest
  id) named exactly „Mutation tests“ of the app `github-actions` on the
  first parent completed with `success` (`gh api`, `check_name`,
  `filter=all`). A skipped one does not count, so a head that took over a
  result cannot pass it on: the next merge of `main` runs the jobs. Any
  failing git or API call prints `true`. The three mutation jobs then do
  not run. The CI Gate, with `checks: read`, accepts `reuse` only in a
  pull request whose three mutation jobs were skipped, and only after
  `verify <head>` found the first parent of the head (Git data API) with a
  green „Mutation tests“ again; for that it checks out `scripts/` and sets
  up Node only in that case. A push with `reuse` fails as before (the full
  suite).
* **[V]** Measured (2026-11-13, #167) with `mergeOfMain` and the check
  runs of the API on the ten merges of `main` into #162, #164, #165 and
  #166 (base = second parent, tested = the merge; whether `main` moved
  before the CI ran cannot be told afterwards). The earlier rule took
  over 0 of 10. The revised rule passes 9 of 10 on the files and the tool
  chain (no merge changed the test tool chain); with the green check run
  of the first parent, 3 of 10 would have taken over the result:
  - #162 `1729c60`: reuse.
  - #162 `fb2c016`: first parent `6bf7f3e` has no „Mutation tests“ (it
    was pushed together with the merge).
  - #164 `7931307`: reuse.
  - #164 `dc20542`: the newest „Mutation tests“ of `7f41314` was
    cancelled.
  - #164 `7f41314`: first parent `b534eb6` has no „Mutation tests“.
  - #165 `666a75d`: the newest „Mutation tests“ of `75c0c53` was
    cancelled.
  - #165 `75c0c53`: reuse.
  - #165 `710359d`: the newest „Mutation tests“ of `0a7f40a` was
    cancelled.
  - #165 `0a7f40a`: first parent `bddd266` has no „Mutation tests“.
  - #166 `29c685c`: blocked, `main` and the pull request both change
    `src/server/game/actions.ts` (mutated); its first parent's run was
    cancelled too.
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
  `src/features/<key>/texts.de.ts`, since #116 also
  `src/features/missions/<m>/texts.de.ts`, and the generated indexes
  `src/features/index.gen.ts` and `src/features/index.server.gen.ts` (see
  the decision above); the texts count
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
