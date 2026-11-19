---
type: log-entry
date: 2026-11-19T16:00
kind: Code
issues: [175, 78, 223, 95, 190, 54, 318, 55]
---

Bundle 2 (#175, #78, #223, #95, #190, #54) brought up to date with #318 (Wache stellen, #55). The migration of holding `20261119T0744-holding` stays as on main and rebuilds `fleets` from the schema before the bundle, so the three rebuilds of the bundle (Mondbruch, Vermessung, Raketenangriff) got the IDs `20261119T0810-moonbreak`, `20261119T0811-planet-survey` and `20261119T0812-missiles`, run after it in this order and keep the column `hold`, the state `hold` and the mission `hold`; their upgrade tests were renamed and the schema snapshot is the result of all migrations. The fleets that hold defend a planet in the Sturmangriff through the shared `src/server/game/fight.ts` (`defenders`, one party per fleet in `battleOf`, the cargo of the held fleets in the loot, a report for every owner); the Mondbruch and the detected Auspex-Erkundung fight without them, as #55 built it (open question to the owner). The mission orders are each once again: Wache stellen 70, Mondbruch 80, Vermessung 90, Raketenangriff 100. The Wache stellen is refused at a player in vacation mode by the generic check of the target kind (`vacation` before the noob protection and `notAlly`), and every own action of a player in vacation mode, a launch and a recall of a Wache stellen included, is refused by the lock of #223; tests pin both.
