---
type: log-entry
date: 2026-11-19T23:00
kind: Code
issues: [189, 232, 274]
---

Regressions of the phone view (#189) found by E2E: the level buttons „▲ 5“ failed axe `label-content-name-mismatch` (the full text and the short label were both visible on the desktop, and `aria-label` differed from the short text on the phone), so the button now carries its full name as text (taken out of sight on a phone, `aria-hidden` short label) and no `aria-label`; the tab bar, the switch of the lists and the resources line of the header no longer push the page past 360 px (`minmax(0, 1fr)`, content widths, a flex line that wraps); the `kv` tables have fixed columns on a phone so the fleet form no longer widens the page, which had made the phone zoom out and the fixed tab bar miss its click target in `e2e/holding.spec.ts`; the heartbeat of the play time (#232) now reads the answer of `POST /api/playtime`, since an unread response kept its request open in the browser and `waitForLoadState('networkidle')` of the guild test (#274) never returned. The frozen reference of the catalog lists follows the button on purpose (see [Interface v2](/features/interface.md)).
