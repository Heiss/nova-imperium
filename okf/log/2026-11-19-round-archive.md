---
type: log-entry
date: 2026-11-19T19:00
kind: Feature
issues: [235, 231, 232]
---

#235 slice 1 built with the owner's decisions of 2026-11-16 (events, no stored statistics) and 2026-11-17 (D1 to D4, Lifetime): the archive of a round. A new round closes the running one first in the same transaction (a refused archive refuses the reset and nothing is lost), the admin action `closeRound` does the same without a reset, `deleteRound` removes a closed round; the close writes `player.final`, `guild.final` and `round.closed` events into the new tables `rounds`, `round_participants` and `round_events` (migration `20261120T0900-round-archive`, the running round gets the coverage „partial“), the settings change and the Endzeit are annotated as events of the running round, a deleted account is cut from the archive under the pseudonym „Gelöschter Spieler“ by a trigger [V]. The playtime of #231 and #232 is not part of it: the report has a named slot for it (D2). See [Round archive](/features/round-archive.md). Slices 2 and 3 on top: the report of one archived round and the history across rounds, in the box „Rundenarchiv“ of „Hilfe & Optionen“ and, for the admin, in the box „Rundenberichte“ of the tab „Universum“ [V, texts and places]. The Runden-Rewind is not built: it needs the in-round events of the issue's audit table.
