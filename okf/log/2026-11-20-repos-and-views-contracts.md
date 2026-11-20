---
type: log-entry
date: 2026-11-20T03:00
kind: Code
issues: [317]
---

#317, parts 2 and 3 of the second round of the clean-up (owner, 2026-11-20): the contracts. A repository is registered by `export const repository = { key, make }` in its own file of `src/server/db/repos/` (the type `Repositories` is derived from the generated list); the tables a new round empties are declared next to their owner as `roundReset` (`{ order, clears, when? }`, and `{ keeps }` for the tables that live through a round), and `newRound` runs them in the order of the numbers. A Svelte view is registered by `export const clientViews` in its own file of `src/client/views/` (key, `mount` or `html`, `anew`, menu entry with an order number, glyph, tab); the menu order of today is data. [V] The shape of the three contracts is the main agent's proposal. A characterization test (`src/server/game/round-reset.test.ts`) seeds a marked row into every table of the schema and checks which survive a new round, with guilds on and off, and the order of the `DELETE` statements; it was written before the change and passed unchanged after it. No game rule, text or behaviour changed.
