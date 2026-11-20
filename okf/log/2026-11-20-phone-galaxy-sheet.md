---
type: log-entry
date: 2026-11-20T01:00
kind: Feature
issues: [189]
---

#189 built for the phone (up to 760 px, the desktop as before): the actions of a position of the Sternenkarte are behind a „⋯“ at the right of its row, which opens a bottom sheet (a modal dialog like „Mehr“) with the actions, the line „Flugzeit mit allen Schiffen“ and „Schließen“ [V, wording, the fleet the time is for]; the row keeps its actions for the desktop (hidden on a phone), a row with only „Aktiver Planet“ has no „⋯“. `ui.gsheet` keeps it open over a render; `logic/galaxy.ts` (`GalaxySheet`), `features/galaxy.ts` (`gsheet`), `Galaxy.svelte`. The reference test of the Sternenkarte expects the frozen rows with the new cell; the E2E specs that click an action on a phone open the sheet first (`galaxyAction()`). See [Interface v2](/features/interface.md).
