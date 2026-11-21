---
type: log-entry
date: 2026-11-21T16:00
kind: Code
issues: [226, 223]
---

#226, #223. Private messages, second step ([Private messages](/features/private-messages.md), [Vacation mode](/features/vacation-mode.md)). Q28 (owner): the lock screen of the vacation mode offers „Nachrichten“ with the tabs „Posteingang“ and „Gesendet“ and replying, and nothing else of the interface; the reports stay unreachable from it; the lock state carries the key `privateMessages`. Q27 [V] (coordinator): the state carries the newest 50 messages per conversation (`PM_PAGE`) with the unread count of all and `more`; older ones load through the new action `olderPrivateMessages` (parameterised SQL, only the player's own conversation, a foreign message refused like an unknown one). Q29 [V]: blocking leaves earlier messages as they are. Q30 [V]: the admin only views a report. Tests for the report checks (a foreign or unknown id, „Gelöschter Spieler“, the copy cleared with the round) and for the text in no journal, audit or error log row and no log line. The class of the new action in `src/core/action-kind.ts` is open (the file is not on the branch).
