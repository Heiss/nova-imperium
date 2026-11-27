---
type: log-entry
date: 2026-11-27T16:50
kind: Code
issues: [426]
---

#426 part 4 built with the owner's decisions of 2026-11-26 (192a, 193b) and the coordinator's choices of 2026-11-27 [V]: the lines of the overview cards „Achtung“ and „Bereit“ register themselves like the push kinds and the pages of the Lexicanum. Each source is a file of `src/client/logic/overview-cards/` that exports `overviewLines`, entries of card, order and a function of the view state: the attacks on the way and too little energy in „Achtung“, the reward, the unread messages and the empty build queues of the other places in „Bereit“, each with its constants and texts, moved unchanged. `scripts/gen-features.ts` writes `overview-cards/lines.gen.ts`; `overview-cards.ts` sorts the sources of each card by order, stops the start at a card and an order defined twice, and names no source. „Läuft“ stays as it was: it has one source, the orders of the shown place. The three cards were compared before and after on 400 generated states, byte for byte, and the existing tests run unchanged.
