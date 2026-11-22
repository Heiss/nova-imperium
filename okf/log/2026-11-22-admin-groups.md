---
type: log-entry
date: 2026-11-22T10:00
kind: Decision and code
issues: [357, 358, 118]
---

The settings of the admin panel under headings by feature, in groups that fold (#357, owner, 2026-11-22): in „Neue Runde“ and in the tab „Universum“ the same headings in the same order, every group open at the start. The heading comes from the registry: each file with `roundSettings` exports `roundHeading`, and the generated `round-settings.gen.ts` lists the sections (`ROUND_SECTIONS`), so a new feature gets its group without a change of the views; the base values of the universe stand first under „Universum“. Every heading is a name the game already uses, listed with its source in `okf/features/admin.md` as a proposal [V]. A folded group keeps its fields, so saving sends every value as before; a value the server will refuse unfolds its group, is marked and takes the focus, and „Neue Runde“ stays open then. Not part of it: the explanations behind a question mark (#358).

Existing tests changed by the new markup: `src/test/gen-features.test.ts` (the generated file now imports the heading and lists the sections), `src/test/admin-reference.test.ts` (the comparison with the view before #118 strips the group wrappers, `ungrouped()`, and compares every field as before), `src/client/views/market.test.ts` (the warning of a gaining round trip stands right above the note of the box, no longer right after the one table) and `src/client/features/admin.test.ts` (unchanged; its fake element has no `focus`, so the focus is asked for only where an element has it). Also `e2e/incoming-fleets.spec.ts` (its admin flow reopened „Neue Runde“ after a refused value; the dialog stays open on a refusal now, so it checks that instead; every assertion on the refusals stays).
