---
type: log-entry
date: 2026-11-17T02:30
kind: Fix
issues: [274, 273, 189, 134]
---

#274, the guild page once 363 px wide on a 360 px phone in `e2e/phone-overflow.spec.ts` (CI run 43992679036 of #273): with a guild of the longest tag (8) and name (32) without a space, measured at 360 px, the heading of the guild page (735 px), the column „Gilde“ of the guild list (table 707 px) and, for the Leitung, the column „Spieler“ of the members with a name of 20 wide letters (433 px) did not wrap; the heading, the column „Gilde“ and the column „Spieler“ now break a word that does not fit with `overflow-wrap: anywhere`, as #189 and #134 did for the highscore and the galaxy, nothing shortened and no text changed; a new E2E test at 360 px with such a guild, its Leitung and a member of 20 wide letters failed before the fix (715 px and 704 px) and passes after it.
