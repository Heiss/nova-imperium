---
type: log-entry
date: 2026-11-14
kind: Code
issues: [114, 185]
---

the catalog-key scan (#114) binds the item and index of `{#each}` only in its body and key, the value of `{#await}` only in `{:then}` and its error only in `{:catch}`, as Svelte does; before, a name bound there hid an outer list also in the list expression, `{:else}`, the pending part and the other branch (CodeRabbit on #185, a reply after the merge); with a self-test for every part (see [Test strategy](/ops/testing.md)).
