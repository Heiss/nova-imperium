---
type: Architecture
title: '11. Boundaries'
description: 'The dependency rules the CI Gate enforces between the core, the features, the server and the client.'
---

# 11. Boundaries

* **[E]** `.dependency-cruiser.cjs` enforces them in the CI Gate:
  a feature may import `src/core`, never another feature; `src/core` sees
  features only through the generated index; `*.server.ts` only from the
  server. No workspace packages: reuse stays inside the project.
* **[E]** Built with #112 as the rules `feature-not-feature` (a folder
  `src/features/<key>/` or `src/features/missions/<m>/` imports only its own
  files besides the core; the index of all features is no exception),
  `core-sees-features-through-index` and `server-parts-on-server`
  (`*.server.ts` only from `src/server`, other `*.server.ts` and tests).
  The rules that were there stay; `shared-stays-pure` is now
  `core-stays-pure`. `src/test/boundaries.test.ts` runs the real rules on a
  small project per rule: each violation fails, the allowed imports pass.
* **[E]** Built with #112 beyond the first decision and confirmed by the
  owner (2026-11-13):
  `feature-stays-pure` (the files of a feature other than `*.server.ts` and
  tests import neither server nor client, because the core reaches them
  through the index and the browser runs them); `server-not-client` and
  `server-runtime-deps` (no dev dependencies) cover the `*.server.ts` parts
  and `src/features` too; tests may import a `*.server.ts` part.
* **[E]** Built with #116 (owner, 2026-11-14, only `src/server` imports the
  server index): the rule `server-index-on-server` forbids
  `src/features/index.server.gen.ts` to every file outside `src/server`,
  tests included; `server-parts-on-server` lets that index import the
  `*.server.ts` parts. `src/test/boundaries.test.ts` checks both.
