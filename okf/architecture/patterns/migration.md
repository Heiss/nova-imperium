---
type: Architecture
title: 'Migration to the patterns'
description: 'The order in which the existing code moved to the patterns, the pull requests of the refactoring and what each step keeps unchanged.'
---

# Migration

* **[E]** The running release (milestone `next release`) is built as
  before; the migration converts its entries afterwards. The migration
  starts after that release, as infrastructure issues (the release loop
  puts infrastructure first, [Release loop](/ops/loop.md)).
* **[E]** Order, each step one small pull request without a change of
  behaviour (equivalence and E2E tests green); the owner confirmed it on
  2026-11-13 (#111): #112 first; then #113, #114, #116, #117 in parallel;
  #68 before #116, #117 and #118; #114 before #115; #113 and #114 before
  #118; #117 before #119 before #45 and #53 (and #95). #113 starts after
  the first pull request of #114, because the index requires `entry.ts` in
  every entry folder; the other #114 pull requests run in parallel with
  #113 (owner, 2026-11-13, replaces „#113 and #114 in parallel“):
  1. Folder skeleton, generated index, boundary rules.
  2. Texts apart from rules (after #94 and the first pull request of #114;
     built with #113).
  3. Components of the catalog with contract tests; production from the
     components; the resources page from `ProducerTable`. One pull request
     per component group: production (`produces`, `consumes`, `storage`,
     `leveled`), combat (`combat`, `unit`), flight (`mobile`), limits
     (`limit`, `energyThreshold`), then `ProducerTable` (owner, 2026-11-13,
     #114). All groups are built: production (#114, first pull request),
     combat (second), flight (third), limits (fourth) and `ProducerTable`
     (fifth).
  4. Generic events in `settle` with the property tests. Built with #115.
  5. Missions as strategies. Built with #116.
  6. Repositories per aggregate.
  7. Client state module and generic components; `main.ts` shrinks per view.
     First pull request of #118 built: the state module and the four lists
     through `CatalogList` (section 9); the second the Übersicht through
     `Overview` (section 9); bundle 1 the header line, the navigation and
     the resource bar (section 9); bundle 2 the Sternenkarte and bundle 3
     the fleet view (section 9); bundle 4 Nachrichten and Neuigkeiten
     (section 9); bundle 5 Highscore, Achievements and Optionen
     (section 9); the other views follow.
  8. Places (O11), its own pull request before #45 and #53 (owner,
     2026-11-12). Built with #119.

* **[E]** The battle with several parties is no migration step; it is built
  with #55. Built: see section 5.
