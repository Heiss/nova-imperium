---
type: log-entry
date: 2026-11-18T04:30
kind: Fix
issues: [230, 293, 242]
---

#230, the review of pull request #293 and its failed E2E run. The box „Warp-Tor“ is drawn again once when an own gate turns ready, so „Springen“ and the target are enabled when the countdown ends (`viewDue` in `src/client/logic/jump-gate.ts`, which now also holds the check of the finished orders, out of `main.ts`: 1,861 to 1,850 lines under the ratchet of #242); a redraw restores the picked „Zielmond“ only while its option is enabled (`keeps`); the state lists the Warp-Tore of the moons moved to now, not saved, so a gate finished since the last save has its new level (`gateState`). E2E: `e2e/seed.ts` makes a moon left on a slot by an earlier test anew for its new owner and drops its cooldown; `e2e/abandon-colony.spec.ts` puts its colony on slot 1 of the neighbouring system, not on slot 15, where a transport of an earlier test to its own colony, still in flight, refused the give-up for every player (the phone run comes after all desktop tests; the same race is on `main`). The log entry of 2026-11-17 marks the confirmed texts [E] (see [Moons](/features/moons.md), [Abandon a colony](/features/abandon-colony.md)).
