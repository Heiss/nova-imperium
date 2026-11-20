---
type: Architecture
title: Design patterns
description: The patterns the code follows so that the planned features (issues #45 to #95) are added as new files with generic rules instead of special cases, and parallel work does not collide.
tags: [architecture, patterns, catalog, economy, missions, client]
status: draft
generated: { by: claude-code/web, at: 2026-11-12T15:00:00Z }
---

# Design patterns

The patterns are split by topic into the notes below. The numbers of the
sections are the ones the code and the other notes cite („section 7 of the
design patterns“), so each stays with its number.

* [Why the patterns](/architecture/patterns/why.md) - the mechanics the planned features have in common, the goals
* [1. Catalog: typed composition](/architecture/patterns/01-catalog.md) - Catalog entries as typed data with components (produces, consumes, storage, limits, flight, combat) instead of special cases in a shared file.
* [2. Texts apart from rules](/architecture/patterns/02-texts.md) - Display texts live in their own files per entry, apart from the rules, so a renaming or a long explanation touches no rule.
* [3. Economy: piecewise linear with generic events](/architecture/patterns/03-economy.md) - Settling of a planet as piecewise linear segments that end at generic events, with no entry named in the core.
* [4. Missions: one strategy per mission](/architecture/patterns/04-missions.md) - Every mission is a folder with its rules, its name and its arrival, so a new mission adds files and no condition in a shared one.
* [5. Battle: pure function, consequences as a fixed pipeline](/architecture/patterns/05-battle.md) - The battle as a pure function and its consequences (debris, moon chance, loot) as a fixed pipeline.
* [6. Places](/architecture/patterns/06-places.md) - A place is coordinates plus a kind (planet, moon, debris); the model of places and its ids.
* [7. Server actions: commands](/architecture/patterns/07-server-actions.md) - Server actions as commands, their checks in pure functions of the core, and what the browser repeats.
* [8. Store: a repository per aggregate](/architecture/patterns/08-store.md) - One repository per aggregate instead of a single store, the transaction of runAction as the unit of work, and the thin Store facade.
* [9. Client: generic Svelte components](/architecture/patterns/09-client-components.md) - The client as generic Svelte components with a state module, the contract per component and the view-by-view conversion of #118.
* [10. Layout and registration](/architecture/patterns/10-layout-and-registration.md) - The folders of the core and of the features, the generated index and how entries and missions register themselves.
* [11. Boundaries](/architecture/patterns/11-boundaries.md) - The dependency rules the CI Gate enforces between the core, the features, the server and the client.
* [12. Tests per component](/architecture/patterns/12-tests-per-component.md) - Which tests each component of the patterns brings: contract tests, equivalence tests and the reference tests of the views.
* [13. Client features register themselves (#322, part 1 of #317)](/architecture/patterns/13-client-features.md) - A client feature exports its handlers as clientFeature from its own file; the list is generated and main.ts names none (#322).
* [14. Server features register themselves (#326, part 2 of #317)](/architecture/patterns/14-server-features.md) - A server module exports its actions and its part of the state as serverFeature; dispatch.ts and state.ts name no feature (#326).
* [15. Repositories and the round reset register themselves (#317)](/architecture/patterns/15-repositories-and-round-reset.md) - A repository exports repository, the tables a new round empties or keeps are declared as roundReset next to their owner; no shared list names a feature (#317).
* [16. Svelte views register themselves (#317)](/architecture/patterns/16-views.md) - A view exports clientViews (key, mount or html, anew, menu entry, glyph, tab) from its own module; mount.ts and index.ts name no view (#317).
* [Migration to the patterns](/architecture/patterns/migration.md) - the order of the refactoring and what each step keeps unchanged
