---
type: Policy
title: 'Test files and the takeover of a mutation run'
description: 'Which files start the mutation jobs, and when a pull request takes over the green run of the head before.'
---

# Test files and the takeover of a mutation run

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
