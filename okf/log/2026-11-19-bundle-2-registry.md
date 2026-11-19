---
type: log-entry
date: 2026-11-19T12:00
kind: Decision and code
issues: [310, 223, 78]
---

The second Classic bundle merged main again, now with the registry pattern of #310: the minimum duration of the vacation mode (#223) is registered by `export const roundSettings = [ … ] as const satisfies readonly RoundSetting[];` in `src/core/vacation.ts` (key `roundVacationHours`, name `vacationHours`, order 150, 1 to 720, default 48, live, no group, its own refusal text; `VACATION_SETTING` is gone). `src/core/round.ts` and the shared tests (`src/core/round.test.ts`, `src/core/universe.test.ts`, `src/server/game/round.test.ts`, `src/client/views/misc.test.ts`, `src/server/game/achievements.test.ts`, `src/server/game/guild-switch.test.ts`) are main's generic versions; the bundle's versions that listed the vacation setting beside the recognition settings are gone. The feature tests its own entry by key in `src/core/vacation.test.ts` (entry, field id, refusal, universe row, stored value, request shape) and `src/client/views/misc.test.ts` (the dialog field outside every fieldset); the highscore categories of #78 stay tested in `src/client/views/misc.test.ts`. Nothing of the game changes: the registry holds main's entries and the order 150.
