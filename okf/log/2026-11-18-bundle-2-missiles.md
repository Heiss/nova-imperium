---
type: log-entry
date: 2026-11-18T23:55
kind: Code
issues: [54, 95, 190]
---

#54 built into the bundle with #95 and #190, with the owner's decisions of 2026-11-18: the Mondbruch cuts the cargo the fleet carried to the holds left, like the loot (carried cargo first, then the loot, in the order of the classic loot); „Vermessen“ is hidden at a locked position like „Landnahme“; the survey notes of the owner are [E]. The missiles stay out of the shared battle of `src/server/game/fight.ts` (`fighting`, `idle`); the Raketenangriff has the mission order 90 (Mondbruch 70, Vermessung 80); the last rebuild of `fleets`, the migration of the missiles, lists every mission and keeps `aim`. A missile launch is refused at a player in vacation mode with the text of the fleets, a player in vacation cannot launch, the missiles count in the total of the highscore only, and missiles in flight to a moon that breaks are lost, not rerouted to its planet [V] ([Missiles](/features/missiles.md), [Moons](/features/moons.md)).
