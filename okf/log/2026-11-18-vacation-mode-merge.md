---
type: log-entry
date: 2026-11-18T16:40
kind: Decision and code
issues: [223, 283, 290, 229, 55, 228, 278, 230, 224, 280, 242, 222]
---

#223 brought up to date with main and checked against the owner's „Geklärt“ comments. The minimum duration of the vacation mode is now an entry of the registry of the round settings (#283, #290): `VACATION_SETTING` in `src/core/vacation.ts` with the key `roundVacationHours`, the name `vacationHours`, the label „Mindestdauer des Urlaubsmodus (Stunden)“, 1 to 720, default 24, `live` (X1) and `order` 150, since 60 to 90 are taken on main (#229) and 100 to 140 by open branches (#55, #228); the hand wiring in the dialog „Neue Runde“, the reset action, `roundRules()` and `UNIVERSE_SPECS` is gone, labels, ranges, defaults and refusals are unchanged. The Sternenkarte (#278) marks the owner in vacation mode with „(u)“ in `Galaxy.svelte` from `galaxyPage()`. `jump` (#230) and `abandon` (#224) are refused in vacation mode like every action off the allow list, each with a test, and so is a scan by a player in vacation mode, while the Auspex-Phalanx may scan a planet whose owner is in vacation mode (owner, 2026-11-17, now [E]). The size ratchet (#280, #242) went down from 1850 to 1846 lines: the options handlers of „Hilfe & Optionen“ moved to `src/client/option-actions.ts`. The fragment `changes/urlaubsmodus.md` names the admin setting. Open: whether the guild actions, renaming and the main planet may stay allowed in vacation mode (#222 Q2 says „no own actions“).
