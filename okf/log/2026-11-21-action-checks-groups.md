---
type: log-entry
date: 2026-11-21T10:30
kind: Code
issues: [214, 225, 64]
---

#214, the player, rewards and fleet groups and F18: the checks of `rename`, `claimAchievement`, `claimDailyReward`, `send` and `recall` are pure functions that return the code of the first refusal in the order of the server, so they follow section 7 of [Design patterns](/architecture/patterns.md): the new `core/planet-name.ts`, `core/reward-checks.ts` (whose `achievementStatus` the page „Achievements“ asks too) and `core/fleet-checks.ts`. The server gathers the values and words the codes with the messages unchanged; the refusals and their order were pinned on the server first (`rename.test.ts`, `rewards-order.test.ts`, `fleet-order.test.ts`). One message changes, by the decision of the owner of 2026-11-21 on F12: an Auspex-Erkundung sent without ships is refused with the text of the Sternenkarte, „Keine Spähschädel auf dem Planeten.“, instead of „Keine Schiffe ausgewählt.“; the interface never sends such a request, so no visible text changes. The joining of an attack union (#225) stays as it is. F18: the list of requirements (#64) asks `buildErrors` and `researchErrors` and keeps its own reasons and order through its own code tables, compared with the old code on generated places (see [Checks of the server actions](/architecture/action-checks.md)).
