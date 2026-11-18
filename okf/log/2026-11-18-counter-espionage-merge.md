---
type: log-entry
date: 2026-11-18T21:00
kind: Code
issues: [175, 229, 285]
---

#175 brought up to main: #229 comes from main in its final form (#295), so the branch's old copy is gone and the activity line of the Auspex-Bericht is built on main's `activityText` (a planet within the first threshold shows „Aktiv“, later „Aktivität vor x Minuten“; [V] without activity „Keine Aktivität in der letzten Stunde.“ stays). What a report shows (`spyScore`, `spyParts`) is read from `src/core/spy.ts` (#285). [V] The danger table and formula of the Lexicanum article „Auspex-Lehre“ still describe the old chance (`counterChance` of `src/core/spy.ts`, `2 · √ships ÷ 2^lead`), which the game no longer uses; the article is left as it is until the owner decides its wording (see [Espionage defense](/features/espionage-defense.md)). The Lexicanum asks the check of the mission which ships it takes with the espionage technology the mission needs, so „nur Spähschädel“ stays.
