---
type: log-entry
date: 2026-11-14
kind: Fix
issues: [189, 207]
---

#189 D7 built (owner, 2026-11-14: fixed at once, in its own pull request): no view is wider than a 360 px phone; measured at 360 and 390 px, the resources page was 588 px wide and the highscore 404 px with a player name of 20 characters, every other view and admin tab fit; on a phone the resources table shows every row as a block (name, the four values in two columns with their column heads, the share) and the highscore hides the column „Heimatplanet“ and shows its coordinates link small below the player name (owner, 2026-11-14, option 3 of three proposals: hiding the column alone would have taken the phone's way from the highscore to a player's system), and a name breaks only when it does not fit (owner, 2026-11-14, „Umbruch nur im Notfall“, after CodeRabbit on #207 found that a name of 20 × „W“ ran over the points at 360 px; a @phone test measures the name's text against the points cell); the new E2E test `e2e/phone-overflow.spec.ts` checks every view and admin tab at 360 px, and axe checks the resources page and the highscore on a phone (see [Interface v2](/features/interface.md)).
