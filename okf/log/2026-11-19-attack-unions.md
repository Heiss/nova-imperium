---
type: log-entry
date: 2026-11-19T20:30
kind: Code
issues: [225, 222, 55, 228, 223]
---

Attack unions (#225, part of the Classic features #222) built on `claude/acs` after #55, [V] in [Holding and ACS](/features/holding-acs.md#built-with-225), the owner's decisions of 2026-11-16 and 2026-11-17 [E]. An own Sturmangriff on its way opens a union, the leader invites allies (the setting `roundAllies` of #55), they join with a Sturmangriff to the same target (`send` with `union`), all fleets arrive together and fight as several attacking parties in one battle with the research of each owner (`battleOf`, `fight`, `raid` of `src/server/game/fight.ts`, as #55 did for the defenders); the loot is split by free cargo space, every owner gets the report, the debris takes every loss. Four live round settings: fleets 16, players 5, delay 30 %, cutoff off. Data: `fleets.union_id` and `attack_union_invites`, migration `20261120T0900-attack-unions`, no rebuild of `fleets`. No research was built: the issue names none. The defender (#228) sees each fleet as before; vacation (#223) and noob protection fall out of the checks of every attack. Open for the owner: the label of the setting `roundAllies` still says „Halten erlaubt für“; the union arrival the guild chat shows is that of the launch.
