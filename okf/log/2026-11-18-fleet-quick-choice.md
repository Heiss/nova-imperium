---
type: log-entry
date: 2026-11-18T03:56
kind: Feature
issues: [253, 119, 242, 290]
---

#253, the owner's „Geklärt“ of 2026-11-17, built on `claude/fitting-missions`: „Bergung“ beside the missions of the planet there and „Ziel wird geprüft …“ as built are now [E], and O20 is settled; the place the fleet starts from takes no mission [E], so the list „Auftrag“ is empty there and „Flotte losschicken“ is blocked, without a text for the empty list (`TargetSite.start` for `missionsFor`); a Trümmerfeld beside the start planet keeps its „Bergung“, a place of its own (#119) that the server accepts [V]; the fleet form gets the list „Schnellwahl“ [E] with the other own planets and moons as „Name [g:s:p]“, a moon with „(Mond)“, after „– wählen –“: `quickTargets()` of `logic/fleet.ts` gives the entries, the component enters the coordinates and „Zielart“ and the `change` listener of `main.ts` updates the missions, so `main.ts` gets no line (#242; 1,839 lines on top of #290); the list goes back to „– wählen –“ after a choice, is its own row below „Ziel“, left out without another own place, and at most 40 % of the screen wide for a 360 px phone [V]; the frozen view of `fleet-reference.test.ts` got the one new row, the unit and component tests and the E2E spec `fitting-missions` (desktop and a 360 px phone, axe) cover both; the fragment names the „Schnellwahl“ (see [Missions that fit the target](/features/fitting-missions.md), [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md), [Open points](/open-points.md)).
