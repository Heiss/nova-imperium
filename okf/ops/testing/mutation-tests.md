---
type: Policy
title: 'Mutation tests and shards'
description: 'Stryker mutation tests, the score that blocks, static mutants, the sharded runs, stable shards and their weights.'
---

# Mutation tests and shards

* **[E]** Mutation tests with Stryker, a total score below 80 % blocks;
  incremental on pull requests (only those that change what they test,
  #146; a head that only merged `main` takes over the green result of the
  head before, #167; the release pull request of `main` ran it
  completely in its full run, #147, until #387: since then a release pull
  request runs no mutation job) and on
  pushes to `main` (unchanged code keeps its cached result),
  complete every night (owner, 2026-11-11). Tag workflows verify the
  earlier CI result.

* **[E]** Static mutants always run again (owner, 2026-11-14, #201):
  before every incremental run, the step „Static mutants run again“
  (`scripts/mutation-shards.ts drop-static`) removes the cached results of
  the static mutants from the incremental file of the shard; every other
  result stays cached. The nightly run stays complete (`--force`); the
  release pull request did too until #387, since then it runs no mutation
  job. A static mutant changes code that runs when its
  module loads (`static: true` in the report, written by StrykerJS for a
  mutant with static coverage, also when tests cover it as well); it has
  no coverage per test (`coveredBy: []`) and every test runs against it.
  StrykerJS 10.1.1 takes over the old result of a mutant that is not
  killed unless a test that covers it was added, and a static mutant never
  gets one: #197 added a test that kills `guilds.ts:16:57`
  (`linkify: true`), but the cache of `main` kept „Survived“ and shard 2
  failed (run 43598386538). A mutant missing from the incremental file is
  new to Stryker and runs. Cost: the nightly run of 2026-11-14
  (43578903192) has 1031 static mutants of 6069, 158 of 252
  mutant-minutes (39 to 85 % per shard), so an incremental shard takes
  about as long as the static part of its complete run instead of 2 to 5
  minutes.

* **[E]** Mutation runs are sharded into parallel jobs everywhere: 6 from
  2026-11-13 to 2026-11-20, 12 since (next paragraphs) (owner, 2026-11-13: 4 jobs took 16.5 to 19 minutes each and missed the target of
  about 12 to 15 minutes; with 6 the measured times give about 41.5
  mutant-minutes per job, about 12 to 16 minutes; 8 would gain nothing,
  because the largest piece of `catalog.ts` alone weighs 40): pull
  requests and pushes to `main` (incremental) and the nightly run
  (complete); the release pull request (complete) until #387. A script splits the mutated files by their
  estimated run time, heaviest first onto the emptiest job (since #141
  every file stays on its job, below): the test time of their mutants in
  the last report, so static mutants weigh what they cost; a file the report does not know weighs as much as the mean file the
  report knows (2026-11-20, below). A file heavier
  than half a job is cut into line ranges between its top-level statements
  (owner, 2026-11-13: the split by mutant count left one job at 44 minutes
  and the others at 7 to 14). Each job keeps its own incremental cache. A
  gate job merges the shard reports and checks the total score (80 %) and
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

* **[E]** More shards and a split that does not trust a missing weight
  (owner, 2026-11-20, #309, #321; the owner decided both): the complete
  runs, in `mutation.yml` (nightly and „Run workflow“) and in the sharded
  job of `ci.yml` (pull requests above 12 changed files, the release pull
  request until #387, #321), run in 12 shards instead of 6, and the plan weighs a file
  without a weight by the rule below. The change does not touch which tests
  run, a floor or the gate (the owner rejected changing the tests). Why:
  the complete run 44619270864 of `mutation.yml` on the collecting branch
  (head `b69a9b0`, 2026-11-19) took 82, 218, 144, 130, 114 and 173 minutes
  per shard job (the mutation phase 77, 212, 138, 122, 108 and 166), 861
  minutes of job time in all, for 19961 mutants of 387 files and 5046 tests;
  the nightly runs of `main` of 2026-11-18 and 2026-11-19 took 347 and 304
  minutes of job time in all, 42 to 81 and 28 to 68 minutes per shard.

* **[V]** The number lives once (the builder's choice): `SHARDS = 12` in
  `scripts/mutation-shards.ts`. The plan job writes a second output,
  `shards` (`node scripts/mutation-shards.ts numbers`, the numbers 1 to N of
  the plan in `MUTATION_PLAN`), which is the matrix of „Mutation tests
  (shard N of 12)“ in `ci.yml` and `mutation.yml` (`fromJSON`; in the CI
  with `|| '[1]'` because the output of a skipped plan job is empty); the
  job name takes the total from `strategy.job-total`. A test
  (`src/test/mutation-shards.test.ts`) fails a list of numbers in a matrix
  or a number in a job name. Nothing else pinned 6: the merge expects one
  report per shard of the plan (by the `mutate` list in the report), the
  cache of a shard is `stryker-shard<N>-…`, the CI Gate sees only the jobs
  `mutation-plan`, `mutation-shard` and `mutation`. The first run after the
  change: a previous plan of another number of shards is not used (`settle`),
  so every file goes by its weight; the caches of the shards 1 to 6 are
  pruned to the new files of their shard (`config`) and the shards 7 to 12
  start without one, so an incremental run (a push to `main`) tests most
  mutants once; a complete run is not affected. Twelve shard jobs run next
  to the other jobs of a pull request: where the account allows fewer
  concurrent jobs the rest waits in the queue. [U]

* **[V]** Why the split was unbalanced (job logs of run 44619270864): the
  plan job restored the state of `main`, whose plan lacked 125 of the 387 files, and
  planned six shards of 13.7 to 14.1 million ms each. Shard 1 held 26 files,
  none new, and ran about 1.3 times its plan; the other five held 21 to 28
  new files each and ran about 1.9 to 3.7 times theirs (elapsed time times 4
  runners over the planned weight, an upper bound). A new file weighed its
  lines times the mean mutant that is not static. In every shard Stryker
  warned that 270 to 860 static mutants (16 to 24 % of the mutants) were
  estimated to take 78 to 96 % of the time, and the progress lines agree: the
  mutants that are not static run first, 85 % of the mutants of a shard were
  done after 20 to 40 minutes (106 in shard 6) and the last 15 % took the
  rest, 57 to 179 minutes (shard 2: 656 static mutants in 179 minutes, about
  1.1 runner-minutes each; shard 4: 860 in 81, about 0.4).

* **[V]** What was measured to estimate a missing weight (the builder,
  2026-11-20, from the complete report of 2026-11-14: 132 files, 6069
  mutants, the sources of that commit; 600 random draws that make 30 to 50 %
  of the files unknown, the plan made with the estimate and measured with
  the real weights, the highest shard in times the ideal one at 6 and 12
  shards, differences of a few percent are noise). The time of a file hardly
  follows anything cheap: Pearson 0.34 with its lines, 0.32 with its bytes,
  0.35 with its real number of mutants, 0.42 with its imports; 63 % of the
  time is static mutants, 9.2 s each against 1.1 s for the others, and a
  static mutant costs 4 to 46 s depending on the file (the entries of the
  features about 45 s each; why is not measured). Estimates for
  the unknown files, 12 shards (6 shards): lines times the mean mutant that
  is not static, the rule before, 1.39 (1.20); lines, bytes or the number of
  mutable syntax nodes times the mean per unit 1.38 to 1.39; a fit on the
  nodes inside and outside functions 1.36 to 1.38; imports 1.35; the median file
  1.35; the mean of the files with the same name, else lines, 1.32; **the
  mean file 1.28 (1.14)**. A pessimistic factor on the weight of the new
  files, to spread them wider than lightest-first, did not help (1.39 to 1.40
  against 1.39 at 12 shards). The real number of mutants would need the
  instrumenter in the plan job and predicts no better than the lines.

* **[V]** The rule (the builder's choice by that measurement): a file the
  weights do not know, new since the run the plan restored, weighs as much
  as the mean of the files of the plan whose weight is above 0; without any
  such file it weighs its lines, as before. A file of the plan that the
  merged report leaves out has no mutants (`types.ts`, `index.ts`; 7 of 387
  files in the run): `weights` records it with an empty list, so it weighs 0
  and is no new file in every later plan. The plan job logs how many files
  had no weight. This fixes the guess, not its error: the first run of a
  ref still plans new files by a mean, so its shards are about 1.3 times the
  ideal apart (the same measurement), and the next run of the same ref
  plans with their measured times: the plan job restores the state of its
  own ref (`stryker-state-<ref>-…`, likewise `stryker-weights-` and
  `stryker-report-`) before that of `main`, and the gate job saves it also
  when the gate fails (it did in run 44619270864). A pull request run, ref
  `refs/pull/<n>/merge`, does not read the caches of the head branch
  (GitHub scopes a cache to the ref, the base branch and the default
  branch), so a „Run workflow“ run on the branch does not help the pull
  request of that branch. [U] (from the documentation, not tried)

* **[V]** What takes the time, for the next decision (not changed, the owner
  rejected changing which tests run): Stryker runs a static mutant against
  the whole suite until a test fails, so every test that is slow runs for
  every static mutant that a late test kills or no test kills. The unit test
  run of the collecting branch (CI run 44656204588, head `19faf80`, 376 test
  files, 5046 tests, 170 s with coverage) has these ten longest files:
  `src/server/db/migrations.property.test.ts` 65.1 s (82 tests),
  `src/server/http/app.routes.test.ts` 12.5 s, `src/server/http/app.test.ts`
  12.0 s, `src/server/game/economy-checks.test.ts` 11.3 s (3 tests),
  `src/server/game/abandon.test.ts` 10.8 s, `src/server/http/action-limit.test.ts`
  9.2 s, `src/server/db/database.test.ts` 7.6 s,
  `src/core/settle-reference.test.ts` 7.1 s (3 tests),
  `src/server/game/missions-reference.test.ts` 7.0 s (3 tests),
  `src/test/achievements-reference.test.ts` 6.1 s (3 tests). The ten take
  149 of the 279 s sum of the file times (53 %), the property test of the
  migrations alone 23 %; the mutation runs set `MIGRATION_RUNS=10` against 100
  there, so that file weighs about a tenth in them [U]. Stryker's dry runs of
  the six shards ran 3626 to 4147 tests in 3 min 40 s to 6 min 46 s (net 158
  to 302 s; the load of the runners differs). The time per file of the slow
  shard 2 is not measured: its report (artifact `mutation-shard-2`, id
  14591147574) and the state (`mutation-state`, id 14575123497) lie on a
  storage host the session's proxy refused
  (`productionresultssa30.blob.core.windows.net`), and the log of Stryker
  names counts, not times. [U] The measured top ten of 2026-11-14 are
  `src/server/http/app.ts` 833 s, `auth.ts` 664 s, `error-log.ts` 566 s and
  the entries `bc`, `dstar`, `bs`, `colony` of the features, 440 to 510 s each
  with 10 or 11 static mutants.

* **[V]** The expected time of a complete run (the builder, an estimate): the
  fixed cost of a shard is about 7 minutes (install, dry run); with 12 shards
  the job time of the collecting branch is about 861 + 6 × 7 = 903 minutes,
  75 per shard if they were equal. The measured spread of the six shards of
  `main` (longest over mean 1.34 on 2026-11-19, 1.40 on 2026-11-18) and the
  simulation above (1.28 at 12 shards for a run with 30 % unknown files) put
  the longest shard at about 1.3 times that: about 95 to 100 minutes for the
  first run of the branch (3.6 hours before), and with the measured weights
  of the next run about the same, because the spread of the weights between
  two runs is the same size (a plan weighed with the other run's times ended
  at 1.14 and 1.18 times the mean at 6 shards, above). For `main` the same
  estimate is (304 to 347 + 42) / 12 = 29 to 32 minutes times 1.3, so about
  40 to 45 minutes against 68 to 81. The estimate stands on one run of the
  branch and two nights of `main`; a complete run of the new setup replaces
  it.

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
