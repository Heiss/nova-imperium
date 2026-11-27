---
type: log-entry
date: 2026-11-27T11:50
kind: Code
issues: [426]
---

#426 part 3 built with the owner's decisions of 2026-11-26 (192a, 193b) and the coordinator's choices of 2026-11-27 [V]: the marks of the menu register on their views. A `clientViews` entry carries `hint: { mark, join? }`, `mark({ state, unread })` the line or nothing, the function in `src/client/logic/`; `assembleHints` collects them as `MENU_HINTS`, which `navigation.ts` hands to `menuHints()`, so neither names a view. „Nachrichten“, „Achievements“, „Flotte“, „Gilden“ and „Freunde“ have one, no new generator, and no text changed. [V] A mark replaces a completed text of its view, or with `join` follows it after „ · “, and only „Flotte“ joins, as before: one rule of joining would be the same in every state the client reaches, since only „Flotte“ meets a completed text there, but `src/test/frame-reference.test.ts` generates a completed text for every view, and with two modes the frame stays byte-identical against the frozen composition it now holds. [V] The mark of „Neuigkeiten“ is the one still set by hand in `navigation.ts`: it needs the news and the version seen, which are not in the state of the server.
