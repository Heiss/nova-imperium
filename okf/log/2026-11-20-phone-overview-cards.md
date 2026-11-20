---
type: log-entry
date: 2026-11-20T00:10
kind: Feature
issues: [189]
---

#189, D5 built for the phone (up to 760 px, the desktop as before): the cards „Läuft“ (orders with countdown and bar), „Achtung“ (a hostile fleet on its way, too little energy with a link) and „Bereit“ (a reward, new messages) right after the title of the Übersicht [V, what counts and the wording]; `logic/overview-cards.ts` with tests, `views/OverviewCards.svelte`, `phone-only` section. Not built: the idle build queue of another planet, which needs the server to send those queues [open point]. `rewardHint()` of `logic/menu-hints.ts` is exported for the card. The reference test of the Übersicht expects the frozen view plus the cards of the component. See [Interface v2](/features/interface.md).
