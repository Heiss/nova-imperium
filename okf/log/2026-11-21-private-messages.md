---
type: log-entry
date: 2026-11-21T14:00
kind: Code
issues: [226, 222, 169, 328, 227, 192, 235]
---

#226, #222. Private messages between players ([Private messages](/features/private-messages.md)): conversations of two players in the view „Nachrichten“ with the tabs „Berichte“, „Posteingang“ and „Gesendet“, text of up to 1,000 characters, a rate limit of one message every 2 seconds per sender (as the guild chat, #169; above it the limit of #328), the last 500 messages per conversation, deleted by a new round, deleting from one's own view, a block list and the switch „only friends may write to me“ (the buddy list, #227) with one neutral refusal for both, the push kind `private-messages` without the text (#192), „Melden“ on a received message and the admin tab „Gemeldete Nachrichten“ with an audit entry per opening, and the sender „Gelöschter Spieler“ for a deleted account (the pseudonym of the round archive, #235). Decided by the owner on 2026-11-21 (Q22 to Q25 included); the wording of the refusal text is [V]. New: migration `20261121T1000-private-messages`, the repository `privateMessages`, the server module `src/server/game/private-messages.ts`, the client feature `private-messages`. The vacation mode lets the actions through. Changelog fragment `changes/private-nachrichten.md` as a draft.
