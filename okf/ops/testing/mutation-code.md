---
type: Policy
title: 'Code of the sharded mutation runs'
description: 'The scripts and jobs of the sharded mutation runs (#131): plan, gate, caches, tolerance and the previous plan.'
---

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
    mutants, a file the report does not know costs as much as the mean of
    the files that have a weight above 0, else its lines (2026-11-20, see
    [Mutation tests and shards](/ops/testing/mutation-tests.md)). A TypeScript file heavier than half a
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
    without a state of as many shards as `SHARDS` (12; 6 until 2026-11-20)
    every entry is new, which is the greedy split of #131. Then each shard above 1.5 times the mean weight gives
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
    that is gone drops out. No smoothing. A file of the plan in the state
    that the report leaves out (no mutants) is kept with an empty list, so
    it weighs 0 and is not new in the next plan (2026-11-20).
  * `numbers` prints the numbers 1 to N of the plan in `MUTATION_PLAN` as a
    JSON list: the plan job writes it as its output `shards`, the matrix of
    the shard jobs (2026-11-20). `planOf` is the plan as a function (weigh,
    cut, settle, join) that `plan` calls and the tests use.
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
  * `drop-static` (#201) removes every mutant with `static: true` from
    `reports/stryker-incremental.json` and keeps the rest of the file;
    without the file it does nothing, and a file that is not a report (no
    `files`, a file without its list of mutants, broken JSON) fails the
    step, as it fails `config`. Shown locally on `guilds.ts` (184 mutants,
    4 static): with a new test that kills `linkify: true`, an incremental
    run without the step reused 183 of 184 results and kept „Survived“;
    after the step it reused 180, ran the 4 static ones and reported it
    killed.
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
  as job output), „Mutation tests (shard N of 12)“ (`mutation-shard`, matrix
  1 to N from the output `shards` of the plan, N = `SHARDS`, the name takes it
  from `strategy.job-total`, `fail-fast: false`, incremental after `drop-static` (#201),
  `--force` when the head branch is `release/*`, uploads `mutation-shard-N`), „Mutation tests“ (`mutation`,
  the gate: merge, total, floors). The CI Gate requires all three when the
  output `mutation` of „Detect changes“ is `true`, and accepts their skip
  only when it is `false` (#146) or `reuse` (#167, below) or `partial`
  (#309: then „Mutation tests (changed files)“ must succeed instead, and
  the three jobs stay skipped); any other value fails. `mutation.yml` (nightly and „Run
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
