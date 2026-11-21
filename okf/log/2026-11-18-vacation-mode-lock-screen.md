---
type: log-entry
date: 2026-11-18T22:10
kind: Decision and code
issues: [223, 230, 224]
---

#223 rebuilt after the owner's „Geklärt“ comment of 2026-11-18, which replaces the allow list of the build: in vacation mode nothing is allowed. The server refuses every own action except `endVacation` and `pushOptions` (the guild actions, `options`, renaming, the main planet, reading, the admin's actions, `jump` of #230 and `abandon` of #224 too, an action added later as well); the password change, the deletion of the account, the passkeys, the push routes and the sign-out are routes and stay open. A player in vacation mode gets a state without any game (`lockedState`) and the browser shows a lock screen instead of the game (`src/client/views/vacation-lock.ts`): „Urlaubsmodus“, „Dein Konto ist im Urlaubsmodus.“, „Urlaubsmodus beenden“ greyed out with „Du kannst den Urlaubsmodus in <Restzeit> beenden.“ as text next to it until the minimum duration is over, „Logout“ and the account options. The default of „Mindestdauer des Urlaubsmodus (Stunden)“ is 48 h now. [V] The texts of the lock screen are the owner's proposal to be checked after the build; the Lexicanum says nothing about the vacation mode. Only the player's own actions are locked, others can still write to him. `src/client/main.ts` has 1838 lines.
