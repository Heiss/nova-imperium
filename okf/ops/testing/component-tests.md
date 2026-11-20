---
type: Policy
title: 'Tests of components'
description: 'The contract tests per component, the rows of the resources page, and Svelte components and state modules in Vitest.'
---

# Tests of components

* **[E]** Contract tests per component (#114): each component under
  `src/core/components/` has its test next to it
  (`src/core/components/<component>.test.ts`), which runs for every entry
  that has the component, read from the generated index; a new entry needs
  no new test code. A property test (`src/core/production.test.ts`) keeps
  `prod()` bit-identical to its form before #114 (owner, 2026-11-13), and
  `src/core/battle-reference.test.ts` keeps `battle()` bit-identical to its
  form before the combat components (#114, second pull request), and
  `src/core/flight-reference.test.ts` keeps speed, fuel and cargo of a
  fleet bit-identical to their form before the flight component (#114,
  third pull request), and `src/core/limits-reference.test.ts` keeps the
  room for units and the energy need and shortage bit-identical to their
  form before the limits group (#114, fourth pull request). For the
  generic events of #115, `src/core/settle-reference.test.ts` keeps
  `settle()`, `accrue()` and `production()` bit-identical to their form
  before (300 generated cases, fast-check seed 115) and checks settling in
  steps within the tolerance of #47, stocks ≥ 0 and the storage limit;
  `src/server/game/research-reference.test.ts` keeps the planets that a
  new research settles, on two databases in memory. See
  [Design patterns](/architecture/patterns.md), section 12.

* **[E]** The rows of the resources page (#114, `ProducerTable`): the
  property test `src/core/producer-rows.test.ts` checks that the rows of
  `producerRows()` add up to `prod()` of the planet as it runs, bit for bit
  where `prod()` adds in the same order (owner, 2026-11-14).

* **[E]** Svelte components and state modules in Vitest (#118): the
  Vitest configuration loads the Svelte plugin of the build
  (`@sveltejs/vite-plugin-svelte`), so tests import `.svelte` and
  `.svelte.ts` files; a component test renders with `render()` of
  `svelte/server` (no DOM, no new dependency) and reads the markup as text
  (`src/client/views/catalog-list.test.ts`: every entry of a kind gets one
  row). The state module `src/client/logic/state.svelte.ts` lies in the
  measured `src/client/logic/` and is mutated like the other logic; Stryker
  instruments it without breaking the runes (measured 2026-11-14).
