---
type: log-entry
date: 2026-11-17T06:30
kind: Feature
issues: [193]
---

#193 built with the owner's decisions of 2026-11-14 (D1 changed: the phone stays as it is; D2: slimmer while scrolled): on the desktop the header with the resources and the side menu stay in view while the page scrolls; the header sticks with its logo line above the screen, so it is slimmer while scrolled and full again at the top, and the menu sticks below it [V]; where the logo stands beside the resources (one line of 72 px, for example at 1,280 px with a short name) the header stays whole, since hiding the logo there would not make it slimmer [V]; `scroll-padding` keeps the keyboard focus clear of the header and, on the phone, of the tab bar [V]; the lengths come from the new `src/client/logic/sticky-header.ts`, wired in `src/client/views/frame.ts`, so `main.ts` does not grow; E2E test with axe in `e2e/sticky-header.spec.ts` (see [Interface v2](/features/interface.md)).
