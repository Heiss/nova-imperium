---
type: log-entry
date: 2026-11-25T21:30
kind: Feature
issues: [405, 377, 396]
---

The points and the highscore are computed in one pass, N times a day, not on every call of the state (#405, owner, 2026-11-25). The setting „Highscore-Aktualisierungen pro Tag (0 = Echtzeit)“ stands in „Neue Runde“ and in the universe settings, 0 to 24, 3 by default: passes at 00:05, 08:05 and 16:05 server time, as in the classic game up to 0.78b; 0 makes a pass at most every 10 s. The clock of the server makes the pass of a slot at its time, „Neue Runde“ at once; the state, the guilds and the finds of an expedition read it, the noob protection of an attack or a missile computes the exact points of its two players, the archive of a round a fresh pass. The highscore shows „Stand: HH:MM“. The pass is kept in the memory of the server; a restart makes a new one at the first reader. #377 is not built, so the pass runs in the existing clock of the fleets.

Measured again (#396 asked for it), median of 41 calls of the state of one player, a synthetic universe of 9 planets (mines 18/15/12, ships and defense) and 4 moons per player, SQLite in memory, Xeon 2.1 GHz, idle: 20 players 40.6 ms before, 14.9 ms with the stored pass, 27.6 ms for a call that makes a new pass; 40 players 69.1 ms before, 28.4 and 51.4 ms. The universe differs from the one of #396 (46 to 51 ms for 20 players), so only the numbers of this entry compare with each other.
