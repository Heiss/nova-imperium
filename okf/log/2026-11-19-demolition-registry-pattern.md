---
type: log-entry
date: 2026-11-19T09:00
kind: Code
issues: [202, 310, 283]
---

#202 brought up to date with main after #310, without a change of the game: the refund factor and the time of a demolition („Rückbau-Erstattung (%)“, order 180, and „Rückbau-Dauer (% der Bauzeit)“, order 190) are the `roundSettings` of `src/core/demolition.ts`, the pattern of #310, with the same keys, names, labels, ranges, defaults, orders and the one group `demolition` with the legend „Rückbau“, both `live`; the constants `DEMOLITION_REFUND_SETTING` and `DEMOLITION_TIME_SETTING` and their imports in `src/core/round.ts` are gone, and `src/core/round.ts` and the shared tests are those of main. [V] The tests of the feature pin its settings by the group `demolition`: the entries, the field ids, the rows of the universe settings, the stored values and the request in `src/core/demolition.test.ts`, the fieldset „Rückbau“ in `src/client/views/misc.test.ts`, the refusal texts of each value and of a group sent incomplete in `src/server/game/demolition.test.ts`; the registry of #283 holds main's list plus the orders 180 and 190.
