---
type: Policy
title: 'No catalog key outside src/features'
description: 'The test that finds a comparison with a catalog key outside src/features and what it scans.'
---

# No catalog key outside src/features

* **[E]** No comparison with a catalog key outside `src/features/` (#114,
  owner, 2026-11-14): `src/test/catalog-keys.test.ts` reads `src` with the
  TypeScript and Svelte parsers, as `src/test/naming.test.ts` does, and
  fails on a comparison (`===`, `!==`, `case`, `includes` on a fixed list)
  with a key from the folder names under `src/features/`. Its named
  allow-list (file, key, count, issue) counts the hits per file and key;
  the test fails when the real count is higher (a new comparison) and when
  it is lower (the stale count must be lowered), so counts only fall
  (owner, 2026-11-14). The generic events of #115 removed the entries of
  `settle.ts` and `server/game/actions.ts`; the lab and shipyard locks are
  allowed with #183;
  the report type `spy` (a word equal to a key) is allowed for good, as
  `permanent` (owner, 2026-11-14). See
  [Design patterns](/architecture/patterns.md), section 12.
