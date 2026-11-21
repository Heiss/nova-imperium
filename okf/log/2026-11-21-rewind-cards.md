---
type: log-entry
date: 2026-11-21T14:00
kind: Decision and code
issues: [235]
---

Rest of the Runden-Rewind (#235), by the decisions of the owner of 2026-11-21: the cards 2 (Wirtschaft), 3 (Schwerpunkt), 4 (größter Verlust), 5 (Rückkehr) and 7 (Endzeit) are derived on read from the version 2 events of the round (`src/core/round-rewind-facts.ts`, `CARDS` in `src/core/round-rewind.ts`); a round with events of version 1, no events, or a seat that joined mid-round keeps the shorter form. The journal got its version 2 facts (finished research, colony and moon created or removed, unit costs, the refund of a demolition, the gift of the Endzeit, the closing settlement). The points curve and `play_session_id` are not built. Texts and rules that the owner has not decided are drafts [V] in `okf/features/round-archive.md`.

Follow-up of the same entry: card 4 of a round with events of version 1 says „Aus dem aufgezeichneten Teil der Runde.“ (Q19). Card 5 shows nothing when ships were consumed between the loss and the recovery that its fleet-value ledger does not subtract (a colonisation, an expedition fleet lost without a battle, a fleet that joined or held in a battle, and a few rarer ones), so it can miss a recovery but never claim a false one (Q26, the argument is in `okf/features/round-archive.md`); the expedition battle is now read from the side of the fleet's owner. Q17, Q18, Q20 and Q21 were recorded as decisions [V] of the coordinator.
