---
type: Policy
title: 'Append-only migrations and the size ratchet'
description: 'The job that keeps migrations append-only and the ratchet that keeps src/client/main.ts from growing.'
---

# Append-only migrations and the size ratchet

* **[E]** Migrations are append-only: the job "Migrations append-only"
  compares `MIGRATIONS` with the base of the pull request (or the previous
  tip of `main` on a push) and blocks when a released migration was moved,
  removed or changed, whitespace included, or when its ID changed (#213),
  and the same against the last release tag. It also blocks a list that is
  not in strict order of valid IDs and a new migration with an ID older
  than the newest migration of the last release, the newest CalVer tag of
  all refs (owner, 2026-11-16); unreleased migrations may be merged in any
  order. On a hotfix branch it blocks every new migration (O19). It reads
  the migrations from their files (`src/server/db/migrations/`) and older
  layouts of a base from `schema.ts`. `pnpm check` runs the same gate
  offline against the local `origin/main` (`pnpm check:migrations`; a
  warning without `origin/main`), so a changed migration of `main` fails
  before the push (owner, 2026-11-16). It runs
  for every change. A schema
  snapshot (`src/server/db/schema.snapshot.sql`) shows the resulting schema in
  the review. See [SQLite storage](/data/sqlite.md).

* **[E]** Size ratchet of `src/client/main.ts` (#242, owner,
  2026-11-16; form of 2026-11-19, #317 part 4: „lowered on main only“):
  `main.ts` must not grow while #118 takes it apart. It must not have more
  lines than it has on its base, the branch it goes into: no file holds a
  limit any more (`size-ratchet.json` is deleted), so no branch edits a
  number and two branches that shrink `main.ts` do not conflict for it.
  `scripts/size-ratchet.ts` (`pnpm lint:size`, part of `pnpm check` and of
  the CI job „Lint, types, unit tests with coverage, build“, so of the CI
  Gate) counts the lines of the working tree file and of the file on the
  base and fails when the file has more („move the code into a module or
  component (#118)“); fewer is fine and needs nothing. The base is
  `HEAD^1` in the CI (the job checks out two commits): the first parent is
  main for the merge commit that a pull request is tested as, so the
  check measures what this pull request changes and does not blame it for
  what main shrank after the branch started; for a push it is the commit
  before. Locally (`pnpm lint:size` without an argument) it is the merge
  base with `origin/main`, and the check is skipped when `origin/main` is
  not fetched; `node scripts/size-ratchet.ts <commit>` takes another base.
  The limit goes down by merge: the pull request that shrinks `main.ts`
  merges, `main` has the smaller file, and every later change is measured
  against it, so the freed lines never come back. What a branch does: keep
  `main.ts` at or below its length at the fork point (a feature puts its
  code into its own module); if it moves code out, it just commits the
  smaller `main.ts`, with no number to set. A feature that needs client
  code puts it into its own module, not into `main.ts`. Only `main.ts` is
  limited. Lines are counted as `wc -l` counts them, after Prettier, since
  `format:check` runs anyway [V]. Two pull requests whose changes of
  `main.ts` do not conflict in git cannot add up to growth: each is at or
  below its base, so the sum of their changes is at most zero. The change
  of #317 part 4 removed the exact-equality rule (a smaller `main.ts` no
  longer fails until the limit is lowered): that rule needed the file with
  the number, and its job, to keep the freed lines from coming back, is
  done by the base moving down.
