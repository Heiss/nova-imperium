---
type: log-entry
date: 2026-11-19T17:30
kind: Decision and code
issues: [55, 223, 95]
---

The owner settled the open points of the three decisions of „Wache stellen“ (#55, „Geklärt“ comment of 2026-11-19): the fleet moves to the planet despite the limits, guards fight in the Mondbruch and the move reaches only fleets that took no part in the battle, no fuel refund, and an empty planet with a guard fights detected probes; each [V] of these is now [E] in [Holding and ACS](/features/holding-acs.md). One point changed: the owner of a guard now gets an info report, one per fleet, when the host's vacation (#223) sends it home, both at the start of the vacation and at the arrival at a host in vacation, and when the Mondbruch (#95) moves it to the planet. `sendHome` in `src/server/game/holding.ts` and `destroyMoon` in `src/server/game/moons.ts` write them (type `info`, push topic `fleet`, like „Flotte kehrt um“); no report goes to the host, the attacker's unrelated fleets or fleets that only fly to the broken moon. [V] Texts drafted from the owner's wording: „Wache heimgeschickt [g:s:p]“ with „Deine Wache bei <Ort> [g:s:p] wurde heimgeschickt: Der Gastgeber hat den Urlaubsmodus begonnen.“, and „Wache wechselt zum Planeten [g:s:p]“ with „Der Mond [g:s:p] wurde zerstört; deine Wache hält jetzt am Planeten.“
