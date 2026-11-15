---
type: log-entry
date: 2026-11-13
kind: Code
issues: [167, 146]
---

#167 built: a pull request into `main` whose newest head only merged `main` takes over the green „Mutation tests“ of the head before (its first parent, read through the API with `checks: read`) unless the merge changes a file of the mutation run (mutated, test or mutation configuration, as in #146) that the pull request changes too, or the test tool chain in the lockfile; owner revised the rule after the first one would have taken over 0 of the ten recent merges of `main` (each changed `okf/log.md`, nine brought in tests): other files from `main` no longer block, and the takeover happens once in a row; „Detect changes“ writes `mutation=reuse` (`scripts/mutation-reuse.ts`), the CI Gate accepts the skip only then and after finding that green run again, anything else runs the jobs as before; checked that the `GITHUB_TOKEN` with `checks: read` reads the check runs of any commit of the repository; measured again on the same ten merges: 9 pass the files and the tool chain, 3 would have taken over a result, the others lacked a green „Mutation tests“ on the first parent (cancelled, or pushed together with the merge) (see [Test strategy](/ops/testing.md)).
