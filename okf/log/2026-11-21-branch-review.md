---
type: log-entry
date: 2026-11-21T16:00
kind: Code
issues: [226, 335, 223, 54, 332]
---

Review of the whole collecting branch (coordinator, 2026-11-21) for what a review of one package cannot see. #226 and #335: the browser names the open conversation in the body of every action (`pm`, `pmAfter`), and the rules of a round (`reset`, `'scalars'`) kept every number of the body, so `pmAfter` could reach the journal; `inputOf` of `src/server/game/journal-input.ts` now leaves it out like the type of the action (`pm` is a string, which no rule keeps), as [Private messages](/features/private-messages.md) says: nothing of the open conversation is journaled. Stale texts corrected: the class of the three loads of the private messages in `action-kind.ts` (the OKF still said the file was missing), the comment of the vacation check in `src/server/game/dispatch.ts` (#223: the private messages pass too), the lock state of [Vacation mode](/features/vacation-mode.md) (it carries `privateMessages`), the tear-down amount of [Missiles](/features/missiles.md) (#54: no field draft since #332, the list is redrawn in place) and the note on `data-nokeep` in the tests of the Svelte views.
