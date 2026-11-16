---
type: log-entry
date: 2026-11-15T09:09
kind: Fix
issues: [216, 169]
---

review of #216 (CodeRabbit), the guild chat of #169: the answer of „Chat lesen“ opened the admin's chat dialog even when the admin had logged out while the request was on its way, so the guild chat stood over the login (owner, 2026-11-15: fixed in this pull request); it now opens only while the same admin is still signed in (`sameSignIn` in `src/client/logic/guild-chat.ts`); after a message went through, the text field emptied even when the player had typed a new draft meanwhile; it now empties and takes the focus only while it still holds the sent text (`clearsChat`); unit tests for both and E2E checks in `e2e/guild-chat.spec.ts` that hold the server's answer, both failing before the fix; the accessibility test waits for the toast „Gilde verlassen.“ before it loads the Leitung's page again.
