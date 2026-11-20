---
type: log-entry
date: 2026-11-20T09:00
kind: Code
issues: [235]
---

The thin Runden-Rewind of issue #235 (owner, 2026-11-20: the cards 1, 6 and 8 go into the update of 2026-11-22). `rewindOf(report, seat)` in `src/core/round-rewind.ts` derives the cards from the report of the archive on read: card 1 (round identity), card 6 (estimated active time, only if the round has play time for the seat) and card 8 (final place and the link to the full report); a round archived before the play time gets 1 and 8. The server action `roundRewind` (`src/server/game/round-report.ts`) carries the access check of `roundReport`; the running round and a seat that took no part have none. The browser shows it from „Rewind ansehen“ in the archive row (`RoundRewind.svelte`). The cards 2 to 5 and 7 wait for the in-round events. See [Round archive](/features/round-archive.md).
