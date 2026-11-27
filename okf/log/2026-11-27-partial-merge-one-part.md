---
type: log-entry
date: 2026-11-27T06:40
kind: Fix
issues: [429, 427, 370]
---

After #429 every pull request with a partial set of one part failed „Mutation tests (changed files)“ (seen on #427): `actions/download-artifact` with a pattern puts a single artifact straight into `reports/parts/` without a folder of its own, so the glob `reports/parts/*/mutation.json` matched nothing and the merge read the literal path. The pull request of #429 had run only the complete run, so the path never ran before the merge. `scripts/mutation-partial.ts merge <out> <dir>` now takes every `mutation.json` below the folder, in both layouts, and fails unless there is one report per part of the plan; the check that every part ran exactly its files stays. The merges of the shards (`ci.yml`, `mutation.yml`) keep their glob: their plan has 12 shards, so the download always makes folders, and a plan of one shard would hit the same trap (#370). The same push says in the CI Gate, `okf/ops/testing` and `website/src/content/docs/ci.md` that without a proof the next nightly run tests `main` as it is that night, that the partial run is a matrix of parts with a merge job, and that a change of the mutation configuration runs the complete jobs only in a pull request.
