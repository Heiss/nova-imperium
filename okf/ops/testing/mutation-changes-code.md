---
type: Policy
title: 'Code of the changed-file and reuse runs'
description: 'The scripts that choose what a pull request mutates and reuse a green run, with the measured proof runs and the text module.'
---

# Code of the changed-file and reuse runs

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
  dependencies) and writes the output `mutation`: `true` on a push; a
  pull request into a hotfix branch compares its base with the merge
  commit. Until #387 it also wrote `true` in the full run of the release
  pull request of `main` (its draft wrote `false` for every output, #147),
  and in the release pull request of a hotfix branch the script compared
  the release tag below the base
  (`git describe --tags --abbrev=0 --match '[0-9]*.[0-9]*.[0-9]*'`, as
  the migration check does) with the merge commit and failed without such
  a tag. Since #387 a release pull request runs no mutation job (it
  changes only the metadata files): „Detect changes“ writes `false`. Every other pull request asks
  `node scripts/mutation-partial.ts plan <base> <merge commit>` (tests in
  `src/test/mutation-partial.test.ts`, #309): `true` (everything, in the
  shards, with the check of #167 for `reuse`), or the JSON list of the
  files to mutate, which „Detect changes“ writes as `mutation=partial` and
  `mutation-files=<list>`, `[]` as `mutation=false`. Since #370 a partial
  set of a pull request into `main` asks `scripts/mutation-nightly.ts check`
  first (a red or missing nightly run turns it into `true`), then
  `scripts/mutation-partial.ts parts` writes the parts as `mutation-plan` and
  `mutation-parts`; a push to `main` writes `mutation=nightly`.

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
