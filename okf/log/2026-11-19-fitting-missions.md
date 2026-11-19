---
type: log-entry
date: 2026-11-19T19:10
kind: Feature
issues: [253]
---

#253 built with the owner's „Geklärt“ comments of 2026-11-16 and 2026-11-17: the list „Auftrag“ of the fleet form shows only the missions that fit the target, hidden and not disabled, switching to the first one that fits when the coordinates change; a Trümmerfeld adds the Bergung, the start planet as the target offers none; the new select „Schnellwahl“ lists the other own planets and moons and enters the coordinates. The filter `missionsFor` (`src/core/mission-fit.ts`) uses the server's own check, now split as `fitError` and the mission's `canSend`, so browser and server cannot disagree; the noob protection and the vacation of another player and the allies of a Halten stay offered and are refused by the server [V]. „Ziel wird geprüft …“ is not built, because the browser has every planet and no lookup exists. [V]: the text „Kein Auftrag passt zum Ziel“ of the empty list. See [Cargo buttons of the fleet form](/features/fleet-cargo.md#missions-that-fit-the-target-and-the-schnellwahl-253).
