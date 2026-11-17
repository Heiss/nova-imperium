---
type: log-entry
date: 2026-11-17T12:01
kind: Feature
issues: [175, 229, 45, 53, 214]
---

#175, counter-espionage by the classic rules, built on the branch of #229 with the owner's answers of 2026-11-17: the chance is a percent, (probes / 4) · (target's espionage technology / spy's) · (1 + ships / 100), at most 100, drawn from 0 up to it for every spying (owiki „Spionagebericht“, oldid=77679); spying needs Auspex-Lehre 1, and a target at level 0 never detects. Detected probes fight the target's ships and defense with the battle of the Sturmangriff, now shared in `src/server/game/fight.ts`, with debris (#45), the moon roll (#53) and combat reports for both sides; only survivors deliver the Auspex-Bericht, and a target without ships and defense fights no battle. The report shows the target's activity by the rule of #229 (`planetActivity`). The refusal below Auspex-Lehre 1 follows the pattern of #214: the code `noSpyTech` in `src/core/espionage.ts`, the German message on the server. Taken as [V]: the defender's combat report title, the text without activity, the score from the probes sent; see okf/features/espionage-defense.md.
