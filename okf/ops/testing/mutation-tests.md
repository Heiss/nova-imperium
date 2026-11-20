---
type: Policy
title: 'Mutation tests and shards'
description: 'Stryker mutation tests, the score that blocks, static mutants, the sharded runs, stable shards and their weights.'
---

# Mutation tests and shards

* **[E]** Mutation tests with Stryker, a total score below 80 % blocks;
  incremental on pull requests (only those that change what they test,
  #146; a head that only merged `main` takes over the green result of the
  head before, #167; the release pull request of `main` runs it
  completely in its full run, #147) and on
  pushes to `main` (unchanged code keeps its cached result),
  complete every night (owner, 2026-11-11). Tag workflows verify the
  earlier CI result.

* **[E]** Static mutants always run again (owner, 2026-11-14, #201):
  before every incremental run, the step „Static mutants run again“
  (`scripts/mutation-shards.ts drop-static`) removes the cached results of
  the static mutants from the incremental file of the shard; every other
  result stays cached. The release pull request and the nightly run stay
  complete (`--force`). A static mutant changes code that runs when its
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
