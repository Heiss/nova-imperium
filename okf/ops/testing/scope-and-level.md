---
type: Policy
title: 'Scope of coverage and mutation, level at the introduction'
description: 'Which folders coverage and mutation measure and the test level at the introduction of the strategy.'
---

# Scope of coverage and mutation

* **[V]** Measured: `src/core`, `src/server`, `src/client/logic`. Not
  measured, like the Astro templates in muffelblog: the HTML templates
  (`src/client/views`), the browser glue
  (`src/client/main.ts`) and the process entry points (`main.ts`, `cli.ts`).
  The E2E suite and the Compose job run them.

* **[E]** Not mutated: the display texts in `src/core/texts.ts` and
  `src/features/<key>/texts.de.ts`, since #116 also
  `src/features/missions/<m>/texts.de.ts`, and the generated indexes
  `src/features/index.gen.ts` and `src/features/index.server.gen.ts` (see
  the decision above); the texts count
  for the coverage.

## Level at the introduction (2026-11-06)

* 24 test files, 190 unit tests; 99.5 % lines, 95.4 % branches.

* 11 E2E tests (8 game, 3 accessibility).

* Mutation score of the complete run: 92.6 % (2,403 killed, 10 timed out, 175 survived; client logic 96.9 %).
