---
type: Policy
title: 'Mutation runs of a pull request'
description: 'A pull request mutates only what it changes: when the jobs start, the partial run, its floors and parts, the nightly check, and the nightly issue.'
---

# Mutation runs of a pull request

* **[E]** A pull request runs the mutation jobs only when it changes what
  they test (owner, 2026-11-13, #146): a file of the `mutate` globs of
  `stryker.config.json`, a test file, or one of `stryker.config.json`,
  `mutation-standard.json`, `mutation-floors.txt`, `vitest.config.ts`,
  `scripts/mutation-*.ts` and `tsconfig.json`; or when its lockfile diff changes a version of
  `@stryker-mutator/*`, `vitest` or `typescript`. Other dependency updates
  (Renovate, the fix of a security hotfix) and the `Dockerfile` skip them:
  the mutants and the tests stay the same, and lint, types, unit tests,
  build, E2E, the image, Trivy, the Compose stack and the upgrade test
  secure such a change. Since #370 (owner, 2026-11-26, 195a and 200a) a
  push to `main` runs no mutation job: the result of the pull request
  counts on the identical tree (#342), and without such a proof the gate
  passes and says that the nightly complete run tests the tree („Detect
  changes“ writes `mutation=nightly`; the CI Gate refuses any mutation job
  on such a push and the value anywhere else). Until #370 pushes to `main`
  and `hotfix/**` kept the full
  suite with the mutation run on every push; pushes to `hotfix/**` still do (since #342 a push skips it
  when the pull request it merged passed its own mutation jobs, complete or
  partial, on the identical tree; owner, 2026-11-21, O23); a push that runs it also keeps
  the shard caches and the weights current, after a proven one the nightly
  run does. Until #387 the release pull request of a hotfix
  branch compared with the release tag the hotfix branch starts from, with the
  same rules as above (a hotfix that changed a mutated file, a test or the
  mutation configuration ran the mutation jobs, and so did one whose
  lockfile changed a version of the test tool chain; other dependency or
  `Dockerfile` changes did not; without a release tag below the base
  „Detect changes“ failed, owner, 2026-11-13), and the release pull request of
  `main` ran the complete mutation run in its full run only, after it was
  marked „Ready for review“, its draft no mutation job (owner,
  2026-11-13 and 2026-11-14, #147). Since #387 a release pull request runs
  no mutation job (it changes only the metadata files, owner, 2026-11-23, see
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

* **[E]** A pull request mutates only what it changes (owner, 2026-11-18,
  #309; the measured runs of 2026-11-18 took 54 to 70 minutes for the
  slowest of the 6 shards of that time, almost the whole CI time, and every merge of
  `main` made every other pull request run again): in a pull request that
  is no release pull request (head `release/*`) and goes into no hotfix
  branch (base `hotfix/*`), the mutation tests run for the files of the
  `mutate` globs that it changes and for the source of each test file it
  changes, in one job „Mutation tests (changed files)“ without shards
  (since #370 in parts of about 12 files, below). The
  complete run in 12 shards (6 until 2026-11-20) stays for pushes to `hotfix/**` (to `main` until #370),
  the pull requests into a hotfix branch and the
  nightly run, with their caches, weights and plan state (the release pull
  requests ran it too until #387; the pushes to `main` until #370, since
  then only the nightly run writes the caches of `main`). The owner accepts
  that a pull request which lowers the score of a file it does not touch is
  found only at night (until #387 also in the release pull request); unit tests and E2E
  stay complete in every pull request. The nightly run opens or updates the
  issue „Mutation floor missed on main“ when its gate fails, so that such a
  drop is seen the next morning (below).

* **[V]** The set of the partial run (`scripts/mutation-partial.ts`, #309,
  the coordinator's proposal that the build follows): the files of the
  `mutate` globs changed against the base that still exist, and, for a
  changed `*.test.ts`, the mutated sources of the same name: without
  `.test`, without each dotted suffix of the name (`x.property.test.ts`,
  `x.routes.test.ts`, `x.facade.test.ts` test `x.ts`), also with the ending
  `.svelte.ts` (`state.test.ts` tests `state.svelte.ts`), and for a test in
  `src/test/` the script of the same name in `scripts/`
  (`size-ratchet.test.ts` tests `scripts/size-ratchet.ts`). A test file with
  no such source adds nothing; neither does a test helper (`src/test/**`
  that is no `*.test.ts`, `src/server/test-helpers.ts`): the nightly run
  tests them. A change of the mutation configuration (`stryker.config.json`,
  `vitest.config.ts`, `scripts/mutation-*.ts`, `tsconfig.json`) or of the
  versions of Stryker, Vitest or TypeScript in the lockfile (the rule of
  #146) still runs everything in the shards; no file in the set means no
  mutation job. A change of `mutation-floors.txt` is no reason to run
  everything (see the next paragraph); a change of `mutation-standard.json`
  is. Test files whose source the name
  does not find (78 of 212 on 2026-11-18: 8 tests of views whose component
  is not mutated, 23 in `src/test/`, 6 `*-reference` tests, 18 upgrade
  tests and 23 others such as `fleet.test.ts` or the mission tests) are
  still open (#309): until the owner decides a rule, their changes are
  tested by the nightly run.

* **[V]** Floors in the partial run (the coordinator, 2026-11-18, #309,
  form of 2026-11-19, #317 part 4): almost every feature pull request
  raised or added a floor, and the first three pull requests after #312
  (#300, #306, #281) all ran the complete 6 shards of that time because the file of the
  floors counted as mutation configuration in #146, which defeated the
  partial run. Now, when `mutation-floors.txt` changes,
  `scripts/mutation-partial.ts` reads it at the base and at the head
  (`git show <sha>:mutation-floors.txt`) and adds every file whose floor
  was added, changed (raised or lowered) or removed to the set, when the
  file is in the `mutate` globs and exists at the head: a pull request
  proves a new or raised floor in its own run, and a file whose floor
  entry was removed is checked against the new-file minimum. The file holds
  nothing but floors (the format below), so every change of it is a change
  of floors. A line that is not `<file> <floor>`, a file with two lines, or
  a file that is missing at either side (the change that introduces it, so
  once) runs everything in the shards, as does another file of the mutation
  configuration changed at the same time, `mutation-standard.json`
  (`newFile`, `security`, `securityTarget`) included. `mutation-floors.txt`
  stays a mutation configuration for the complete runs: the pull request
  into a hotfix branch and the
  takeover of #167 (`reason` of `scripts/mutation-changes.ts`) run as
  before (so did the release pull request of a hotfix branch until #387). A lowered floor is not refused by anything today (the file is
  checked by `src/test/mutation-floorfile.test.ts` for its form only, and
  the people who write floors never lower one): it joins the partial set
  and is checked against its new, lower value. Nothing was built against it.

* **[V]** The floors in `mutation-floors.txt`, not in `mutation-standard.json`
  (#317 part 4; the owner's line is „one line per file, merged by union“,
  2026-11-19; the exact form is the builder's [V]): one line per file, `<path> <floor>`
  with a single space, sorted by path (plain code-unit order, as `sort()`),
  nothing else, a newline at the end, a floor as the shortest number
  (`93.4`, not `93.40`). `mutation-standard.json` keeps `securityTarget`,
  `newFile` and `security` and refuses a `floors` key. Two branches that add
  or change floors of different files change different lines, and git merges
  them without a conflict, unless both insert at the same place or at the
  end of the file; `.gitattributes` has `mutation-floors.txt merge=union`
  for that case: the merge keeps the lines of both sides, so two new files
  at one place are both there, and a file that both sides changed (or whose
  line lay next to a line the other side added) has two lines. That is
  never silently resolved: `scripts/mutation-floorfile.ts` refuses a file
  with two lines by its name and both floors, the gate, the partial plan,
  `scripts/mutation-floors.ts` and a unit test of the real file all read it
  through that function, and the same test fails a file that is not sorted
  (two new lines at one place come out in the order of the two branches).
  After a merge that touched the file run `node scripts/mutation-floors.ts
  --format`: it sorts the file, or names the file with two lines; keep the
  line of main or the higher one, never a value below main's, and delete
  the other. Where one side changed a floor and the other removed it, the
  merge keeps the changed line; a floor of a file that is gone is harmless
  (nothing is checked against it) and is dropped by the next run of
  `scripts/mutation-floors.ts`. GitHub's own merge ignores
  `.gitattributes`, so a pull request whose floors conflict is brought up
  to date with a local `git merge main`. A branch does not write floors
  (next paragraph), so it does not conflict here in practice.

* **[E]** Floors come from the merged report of a complete CI run only
  (owner, 2026-11-19, #304, option 1): the report of the shards after
  `scripts/mutation-shards.ts merge`, kept as the artifact `mutation-report`
  (30 days) by the nightly run (`mutation.yml`) and by the complete run of a
  pull request or a push (`ci.yml`, job „Mutation tests“). A local Stryker
  run, a partial run and an incremental one are no source of floors: the
  load of the machine bends them (a timeout counts as killed), and the
  report of one Stryker run has `config` and `testFiles`, which the script
  refuses. The main agent writes the floors:
  `gh run list --workflow mutation.yml --branch <branch> --limit 5`,
  `gh run download <run-id> -n mutation-report -D reports/ci`, a checkout of
  the commit of that run (`gh run view <run-id> --json headSha`), then
  `node scripts/mutation-floors.ts reports/ci/mutation.json` (`--dry-run`
  first to read the changes). A session whose proxy does not open the
  storage host of the artifacts (`productionresultssa<N>.blob.core.windows.net`,
  seen on 2026-11-20 for the artifacts of the run 44619270864; the job logs
  come from `api.github.com` and work) takes the numbers from the log of the
  gate step, which prints every file of the merged report with its score:
  `gh run view <run-id> --json jobs --jq '.jobs[] | select(.name ==
  "Mutation tests (complete)") | .databaseId'`, `gh api
  repos/<owner>/<repo>/actions/jobs/<job-id>/logs > reports/ci/gate.log`
  (the job is „Mutation tests“ in a complete run of `ci.yml`), then `node
  scripts/mutation-floors.ts --log reports/ci/gate.log`. The log of a
  partial run or of no gate step is refused. The script adds the measured score of a file
  without a floor (rounded down to two decimals, as the gate counts it),
  raises the floor of a file whose score is higher, and drops the floor of
  a file that no longer exists; it keeps the floor of a file the report
  leaves out. A file below its floor, or below the minimum of a new file
  (80 %) or a new security file (90 %), stops it: it lists those files and
  writes nothing, because a floor never goes down and the tests are to be
  raised, not the report ignored. The floors of a complete run are then
  committed in their own commit; the pull request proves them in its run
  (the partial rule above, at any size since #370). A builder
  records no floor and adds no line for a new file. `node
  scripts/mutation-gate.ts --update` is gone (it stops with this rule);
  the gate only checks.

* **[V]** The job „Mutation tests (changed files)“ (`mutation-partial` in
  `ci.yml`, #309; since #370 the parts `mutation-partial-part` run Stryker
  and this job merges their reports and checks them, see the parts above):
  `needs: changes`, runs when the output `mutation` is
  `partial` and reads the list from the output `mutation-files`. It mutates
  every mutant of the files of the set with Stryker's incremental file
  switched off (`scripts/mutation-partial.ts config <n>` writes
  `reports/stryker-partial.config.json` for part n), restores and saves no cache (the
  shard caches `stryker-shard…`, the plan state `stryker-state-…`, the
  merged reports `stryker-report-…` and `stryker-weights-…` stay what the
  complete runs wrote, so a partial result never reaches a plan or a
  weight), and then runs `node scripts/mutation-gate.ts --partial`: Stryker
  ran exactly the files of the set (its `mutate` list in the report, as the
  merge of the shards checks it) and no other file is in the report, and
  each file is at or above its floor in `mutation-floors.txt`, a file
  without a floor at 80 % (a new security file 90 %); no total score, which
  says nothing over a few files. Stryker leaves a file without mutants (a
  `types.ts`) out of its report, so a file of the set missing in the report
  is a notice, not a failure (seen on 2026-11-18 with `src/core/types.ts`
  and `index.ts` in a run of five files: three files in the report). The
  report is kept as the artifact `mutation-partial-report` for 7 days. The
  CI Gate requires the job when the output is `partial` and refuses
  `partial` in a push and a pull request into a hotfix branch; since #387
  it refuses any mutation job in a release pull request. A head that only merged `main` runs the partial job again
  (no takeover, #167 applies to the complete run only): it is short. Cost:
  without the incremental file every mutant of a changed file runs, and the
  dry run of the whole test suite (about 3 minutes on a loaded machine)
  comes first.

* **[E]** No limit of the size (owner, 2026-11-26, #370, 189a): a pull
  request into `main` mutates only the files it changes, at any number of
  files. The limit of 12 files of one job (`PARTIAL_LIMIT`, the coordinator,
  2026-11-19, #309), above which the complete run ran, is gone: #424 ran
  the complete run on 2026-11-26 for 13 files. A change of the mutation
  configuration or of the test tool chain still runs the complete run in
  the pull request (189a). The history of the limit: measured on
  2026-11-19, the partial run of #281 (11 files, two of them without
  mutants) took 9 minutes, that of #318 (33 files) more than 60 minutes
  without an end, in one job.

* **[E]** More than 12 changed files: the partial run is split over several
  jobs, so it stays fast (owner, 2026-11-26, #370, 190a). **[V]** The
  parts (`scripts/mutation-partial.ts parts`, tests in
  `src/test/mutation-partial.test.ts`): one part for each 12 files begun
  (`PART_FILES`), at most `SHARDS` (12), split by the measured weights as
  the shards are (`weigh` and `split` of `scripts/mutation-shards.ts`): the
  test time of the mutants in the weights of the last complete run, a file
  they do not know as the mean file, without weights by the lines; whole
  files, no line ranges, no part empty. A set of up to 12 files is one
  part. „Detect changes“ restores the weights read only from the cache
  `stryker-state-refs/heads/main-…` of the complete runs on `main` (the
  nightly run writes it) and saves nothing, so a partial result still never
  reaches a plan or a weight; it writes the plan as the output
  `mutation-plan` and its numbers as `mutation-parts`. The matrix job
  `mutation-partial-part`, „Mutation tests (changed files, part N of M)“,
  runs Stryker on one part (`scripts/mutation-partial.ts config <n>`,
  every mutant, no incremental file, no cache) and uploads its report. The
  job `mutation-partial`, „Mutation tests (changed files)“ as before, merges
  the reports (`scripts/mutation-partial.ts merge`: every part ran exactly
  once with exactly its files, the check of the shards) into one report that
  names all files of the plan as the files Stryker ran, and
  `scripts/mutation-gate.ts --partial` checks it as before. The name of the
  job stays, so the proof of a push (#342) and the takeover keep finding it.

* **[E]** The complete run comes only from the nightly run on `main`
  (`mutation.yml`), with one exception: while the last nightly complete run
  on `main` is red or missing, pull requests run the complete run, until a
  nightly run is green again (owner, 2026-11-26, #370, 194a via 197b).
  **[V]** „The last nightly complete run“ is the newest completed run of
  `mutation.yml`, event `schedule`, on `main`, of this repository; a
  cancelled run does not count and a run still going is not completed, so
  the newest completed one decides; it is green only when it succeeded.
  `scripts/mutation-nightly.ts check` (tests in
  `src/test/mutation-nightly.test.ts`) asks the API with the token of the
  workflow (`GET .../actions/workflows/mutation.yml/runs?branch=main&event=schedule&status=completed`,
  `actions: read`, which „Detect changes“ already had for #342) and counts
  every error of the lookup as missing. „Detect changes“ asks it only in a
  pull request into `main` whose partial set is not empty; when the run is
  not green, the output is `true` (the complete run, with the check of #167
  for `reuse`). It writes the line that names the run as the output
  `mutation-nightly`, and the CI Gate prints it („Last nightly complete
  mutation run: …“).

* **[E]** A release needs no extra mutation condition (owner, 2026-11-26,
  #370, 196c). The owner accepts the risk: unit tests and E2E stay complete
  in every pull request, mutation measures the tests and not the game, and a
  gap shows up one night later as a red nightly run, which step 1 of the
  release loop fixes first. Hotfix branches keep their rule
  (`scripts/mutation-changes.ts`, [V]).

* **[V]** The nightly issue (#309): `mutation.yml` had no notice of a failed
  gate (a failed scheduled run mails only the person who last changed the
  schedule). Its gate job (`issues: write` on that job only, the token of
  the workflow, `gh`, no new action) opens the issue „Mutation floor missed
  on main“ with the failures of the gate, or edits the body of the open one,
  when the step „Total score and no file below its floor“ failed on `main`
  (not when a shard did, not on a proof run on another branch). It closes
  nothing; the owner closes it.
