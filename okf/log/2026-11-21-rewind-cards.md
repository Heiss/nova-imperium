---
type: log-entry
date: 2026-11-21T14:00
kind: Decision and code
issues: [235]
---

Rest of the Runden-Rewind (#235), by the decisions of the owner of 2026-11-21: the cards 2 (Wirtschaft), 3 (Schwerpunkt), 4 (größter Verlust), 5 (Rückkehr) and 7 (Endzeit) are derived on read from the version 2 events of the round (`src/core/round-rewind-facts.ts`, `CARDS` in `src/core/round-rewind.ts`); a round with events of version 1, no events, or a seat that joined mid-round keeps the shorter form. The journal got its version 2 facts (finished research, colony and moon created or removed, unit costs, the refund of a demolition, the gift of the Endzeit, the closing settlement). The points curve and `play_session_id` are not built. Texts and rules that the owner has not decided are drafts [V] in `okf/features/round-archive.md`.
