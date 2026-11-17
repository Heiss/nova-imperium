---
type: log-entry
date: 2026-11-17T01:08
kind: Fix
issues: [272, 68]
---

#272, the missing toast „Konto erstellt. Melde dich jetzt an.“ of `registerByMail` in the phone test of `e2e/guild-switch.spec.ts`, was a race in the client, not the install banner or a short timeout: opened with an invitation link, `boot()` asked `/api/state`, whose 401 went through `signedOut()`, and that rendered the login form at once; the registration came only after the answer of `/api/invite/check`. A `page.fill('#a_name')` that ran in between typed name and password into the login, and the registration then replaced it empty, so the click on „Imperium gründen“ stopped at the empty required fields (the snapshot of the issue); a slower answer sent the login itself („Name oder Passwort falsch.“). A temporary test that held the check until the name was typed reproduced the snapshot of the issue at every run. Now `signedOut()` renders nothing while `boot()` still decides, and `boot()` renders once, after the check: the page shows „Lade Universum …“ until then. A new test of „accounts by mail (#68)“ in `e2e/flows.spec.ts` holds the check and expects no login form; it failed before the fix and passes after it; the phone test of `e2e/guild-switch.spec.ts` passed 10 of 10 times under load with the fix.
