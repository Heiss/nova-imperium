---
type: log-entry
date: 2026-11-13
kind: Code
issues: [146, 147]
---

#146 built: a pull request runs the mutation jobs only when it changes a file of the `mutate` globs, a test file, the mutation configuration or the versions of Stryker, Vitest or TypeScript in the lockfile (`scripts/mutation-changes.ts`, output `mutation` of „Detect changes“); the CI Gate accepts their skip only then; pushes to `main` and `hotfix/**` keep them; the release pull request of a hotfix branch compares with its release tag, the one of `main` is unchanged (#147); owner: test files are Vitest's `src/**/*.test.ts` and the test helpers (O12), and the release pull request of a hotfix branch without a release tag below it fails; Stryker's documentation confirms that its incremental mode does not notice dependency or configuration changes (see [Test strategy](/ops/testing.md)).
