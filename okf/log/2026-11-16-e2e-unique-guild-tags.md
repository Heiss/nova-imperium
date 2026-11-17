---
type: log-entry
date: 2026-11-16T23:50
kind: Fix
issues: [269, 68, 267]
---

#269, eight E2E tests built a guild tag from the clock (a letter and `Date.now() % 1000000`), a pattern that repeated across Playwright workers before (#68); two workers or a repeat run could found two guilds with the same tag, and the server refuses a second guild with the same tag or name; like #267, each tag is now its letter and 6 random characters in capitals (`uniqueName`, within the rule of 2 to 8 letters or digits), and each guild name carries that tag, so it is unique too; the tests in `e2e/a11y.spec.ts`, `e2e/flows.spec.ts`, `e2e/guild-chat.spec.ts`, `e2e/guild-ranks.spec.ts` and `e2e/guild-switch.spec.ts` read tag and name back as before; no product change, every assertion kept.
