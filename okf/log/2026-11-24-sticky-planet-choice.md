---
type: log-entry
date: 2026-11-24T19:15
kind: Feature
issues: [348, 193]
---

The planet choice stays in view while the page scrolls (#348; owner, 2026-11-21): on the desktop with a header of two lines only the logo goes; „Aktiver Planet“, „Kommandant …“ and „Logout“ stay as a line above the resources. The look was open [U]; taken as [V]: the logo keeps its place unseen, so nothing moves, and the header goes above the screen only down to the space it keeps above `#pinfo` (`src/client/logic/sticky-header.ts`, `style.css`). A one-line header and the phone are unchanged (#193). Tests: `src/client/logic/sticky-header.test.ts` (the hidden length from the top of `#pinfo`; its expected lengths of a header of two lines changed with the decision) and a new case in `e2e/sticky-header.spec.ts` at 1,100 px, which fails without the change.
