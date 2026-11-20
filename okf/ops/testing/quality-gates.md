---
type: Policy
title: 'Quality gates'
description: 'Mutation standard per file, coverage, ESLint complexity and code hygiene that block in the CI.'
---

# Quality gates

* **[E]** Mutation standard per file (owner, 2026-11-11,
  `mutation-standard.json`, `mutation-floors.txt`,
  `scripts/mutation-gate.ts`): no file may fall below its recorded floor; a
  new file needs 80 %, a new security file 90 %. Security files
  (authentication, sessions, passkeys, admin rights, moderation, account
  deletion, audit, request limits) aim for 90 %. The floors are raised from
  the merged report of a complete CI run with
  `node scripts/mutation-floors.ts` (owner, 2026-11-19, #304; before, the
  pull request that added tests raised them with
  `mutation-gate.ts --update` from a local run). Floors never go down.

* **[E]** Coverage blocks below 90 % of the lines and 85 % of the branches.

* **[E]** ESLint blocks: cyclomatic complexity ≤ 10, cognitive complexity
  (sonarjs) ≤ 10, nesting ≤ 4, functions ≤ 50 lines (tests are free of the
  length rule). The dense code of version 1 was rebuilt into small functions;
  no place is exempted.

* **[E]** Code hygiene blocks in the job „Lint, types, unit tests …“
  (owner, 2026-11-11): knip (`knip.json`: no unused files, exports or
  dependencies), jscpd (`.jscpd.json`: no copied block of 50 tokens or more
  in production code; tests, E2E and version 1 are excluded) and
  dependency-cruiser (`.dependency-cruiser.cjs`: `src/core` imports neither
  server nor client, the client never the server and the reverse, production
  code no test helpers, server, core and feature code no dev dependencies,
  no circular imports at runtime; the boundaries of the feature folders,
  see [Design patterns](/architecture/patterns.md), section 11, tested by
  `src/test/boundaries.test.ts` on a small project per rule).
