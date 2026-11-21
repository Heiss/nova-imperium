---
type: feature
title: Private messages
description: Conversations between two players in „Nachrichten“ with an inbox, replies, read marks, deleting from one's own view, a block list, the switch „only friends may write to me“, a push without the text, „Melden“ to the admin, kept until the round ends, the last 500 messages per conversation (issue #226).
---

# Private messages

Issue #226, part of the Classic features (#222). The owner lifted the
non-goal on 2026-11-21 (comment „Geklärt“), replacing the decision of
2026-11-16 („private messages stay a non-goal, #226 stays an idea“). The
model is the guild chat ([Guild chat](/features/guild-chat.md), #169); the
buddy list ([Buddy list](/features/buddy-list.md), #227) gives „only
friends“, the push kinds are those of #192 ([Push settings per
kind](/features/push-settings.md)). Sources: the three comments „Geklärt“
of 2026-11-21 and the answers to the open points of the same day (owner,
2026-11-21, Q22 to Q25).

# Decisions

* **[E]** Private messages between players are built in the full scope of the
  issue: send, inbox, reply, read, delete from one's own view, moderation,
  notifications and a block list (owner, 2026-11-21).
* **[E]** Conversations between two players, no subject, plain text of at
  most 1,000 characters (`MAX_CHAT_TEXT` of the guild chat), escaped on
  output (owner, 2026-11-21).
* **[E]** Kept until the round ends; a new round deletes all messages. The
  last 500 messages per conversation are kept, older ones go (owner,
  2026-11-21, D1).
* **[E]** Rate limit: one message every 2 seconds per sender, as the guild
  chat; above it the general limit of 120 actions per minute (#328) applies
  (owner, 2026-11-21).
* **[E]** Every player may write to every player. The sender is the
  authenticated account, never a field of the input.
* **[E]** A block list: a blocked player can no longer send to the one who
  blocked them. In addition every player has the switch „only friends may
  write to me“ (owner, 2026-11-21).
* **[E]** Blocked sender (Q23): a neutral refusal that is the same for a
  block and for „only friends“ and never says that it is a block. One
  internal code (`refused`) for both; the sender cannot tell them apart.
* **[E]** Place in the interface: tabs in the existing view „Nachrichten“
  (the reports, the inbox, the sent messages), one menu entry, one mark for
  unread (owner, 2026-11-21).
* **[E]** Notifications: the mark in the menu and a push without the text,
  „Neue persönliche Nachricht“, as its own kind in the push settings that
  can be switched off, on by default (owner, 2026-11-21).
* **[E]** Moderation (D2): the admin sees only reported messages; every
  access is an entry in the audit log (owner, 2026-11-21).
* **[E]** Deleted account (Q22): the conversation stays for the other player
  until the round ends; the sender shows as „Gelöschter Spieler“, the
  pseudonym of the round archive (#235 D4, `DELETED_PLAYER` of
  `src/core/round-report.ts`). Deleting an account keeps working.
* **[E]** „Melden“ (Q24): a button on each received message and the admin tab
  „Gemeldete Nachrichten“. It shows the reported message, its sender,
  recipient, time and who reported it; every opening is an entry in the audit
  log that names the reports and never the text. No context messages; the
  admin never sees a message that was not reported. Only the recipient of
  that message can report it, checked by id on the server.
* **[E]** Vacation mode (Q25): a player in vacation mode sends and receives
  messages as normal; there is no special handling.
* **[E]** The text of the journal of the round and of the audit log: the
  message text, e-mail addresses, passwords, codes and tokens are never
  stored there; the journal keeps the length of a text only (the allow-list
  `src/server/game/journal-input.ts`), a push never carries the text.

# Proposals as built

* **[V]** The text a refused sender sees: „Dieser Spieler nimmt keine
  Nachrichten von dir an.“ (`REFUSED_TEXT` in `src/core/private-messages.ts`).
  The wording is [V]; the neutral form is [E] (Q23).
* **[V]** Writing to oneself is refused: „Du kannst dir nicht selbst
  schreiben.“ The owner decided no text for it.
* **[V]** Words of the other refusals, as the guild chat: „Die Nachricht ist
  leer.“, „Die Nachricht darf höchstens 1.000 Zeichen haben.“, „Bitte warte
  kurz vor der nächsten Nachricht.“, and „Spieler nicht gefunden.“ (the words
  of the buddy list) for an unknown name. A refused message does not count
  for the rate limit.
* **[V]** The default of „only friends may write to me“ is off.
* **[V]** The block list and the switch are settings of the player and stay
  across a new round, as the buddy list (D2 of #227); the messages and the
  reports are deleted. The blocker may still write to the blocked player.
* **[V]** The recipient of a new message and the other player of an action
  are addressed by name (as a friendship request is); the reply, „Melden“,
  „Löschen“ and „Blockieren“ know the name from the conversation. The
  conversation with deleted accounts has the empty name; all deleted accounts
  of a player's conversations are shown as one conversation.
* **[V]** Deleting from one's own view: one message („Löschen“) or a whole
  conversation („Unterhaltung löschen“). The other side keeps it; a message
  that both sides deleted, or whose other account is deleted and that the
  remaining side deleted, is removed. A new message starts a conversation
  again, without the deleted ones.
* **[V]** Read: opening a conversation with new messages marks them read after
  0.6 s (as the reports are marked), by the action `readPrivateMessages`;
  only the recipient's own received messages change.
* **[V]** The mark: the existing mark of „Nachrichten“ (menu, „Mehr“, the bell
  of the phone) counts the unread reports and the unread private messages
  together, „N ungelesene Nachrichten“; the tab shows „Posteingang (N)“.
* **[V]** Delivery: the conversations are part of the player's own state and
  update with its refresh, the whole kept history of every conversation
  (as the guild chat, O15 k). Nobody else's state holds anything of them. See
  the open points about pagination.
* **[V]** Report: the report keeps a copy of the text at the time of the
  report, one report per message, so it outlives the message and the account.
  A report cannot be dismissed or deleted by the admin; a new round deletes
  all reports. A message the recipient deleted from its view cannot be
  reported any more. Admin texts: the tab „Gemeldete Nachrichten“ ([E]) with
  the columns „Von“, „An“, „Gesendet“, „Gemeldet von“, „Gemeldet“,
  „Nachricht“; the audit entry is the admin read `messageReports` with the
  ids of the reports in its detail.
* **[V]** Interface texts: the tabs „Berichte“ (the heading of the reports
  until now), „Posteingang“, „Gesendet“; the buttons „Neue Nachricht“,
  „Empfänger“ and „Antworten“ are those of the issue; further: „Senden“,
  „Melden“, „Löschen“, „Unterhaltung löschen“, „Blockieren“, „Freigeben“,
  „Nur Freunde dürfen mir schreiben“, „Blockierte Spieler“, „Du hast niemanden
  blockiert.“, „Keine Nachrichten.“, „Du hast noch nichts gesendet.“; the
  questions „Nachricht löschen?“, „Unterhaltung löschen?“ and „Nachricht der
  Spielleitung melden?“; the answers „Nachricht gemeldet.“, „Diese Nachricht
  hast du bereits gemeldet.“, „Diese Nachricht gibt es nicht.“ (also for a
  message of another conversation, so nothing is revealed), „Spieler
  blockiert.“, „Blockierung aufgehoben.“, „Gespeichert.“. The label of the push
  kind in the options is „Persönliche Nachrichten“.
* **[V]** The tab „Berichte“ is shown first; the reports are marked read when
  the view „Nachrichten“ is open, whatever tab is shown (unchanged).

# Rules as built

* `src/core/private-messages.ts`: `MAX_PM_TEXT`, `PM_HISTORY`, `PM_INTERVAL`,
  `pmTextError`, `pmTooSoon`, `sendError` (the facts of one attempt to the
  code), `PM_ERROR_TEXT`, `pmExcess`, `pmPair`, `pmUnread` and `PM_ACTIONS`
  (the actions that vacation mode lets through, `src/core/vacation.ts`).
* `src/server/game/private-messages.ts`: the actions `sendPrivateMessage`,
  `readPrivateMessages`, `deletePrivateMessage`, `deletePrivateConversation`,
  `reportPrivateMessage`, `blockPlayer`, `unblockPlayer` and
  `privateMessageOptions` (not guild actions: they work with guilds off), the
  part of the state `privateMessages` (order 230) and `adminMessageReports`,
  read by `POST /api/admin/message-reports` (`src/server/http/admin.ts`,
  audited as `admin.read` / `messageReports`).
* The kind `private-messages` of the push (`src/core/push.ts`), queued with the
  view kind `messages` and the text „Neue persönliche Nachricht“.
* Round: `roundReset` of the repository clears `private_messages` and
  `message_reports` and keeps `message_blocks` and `message_options`.

# Data and code

* Migration `20261121T1000-private-messages` (`src/server/db/migrations/226/`):
  `private_messages` (`sender` and `recipient` with `ON DELETE SET NULL`, text
  1 to 1,000 characters, `read`, `hidden_sender`, `hidden_recipient`; an index
  on the pair), `message_reports`, `message_blocks`, `message_options`, and a
  trigger that removes messages whose both accounts are deleted.
* Repository `src/server/db/repos/private-messages.ts` (`ctx.privateMessages`).
* Client: the feature `src/client/features/private-messages.ts` (the event
  `pm:act` of the components), `src/client/logic/private-messages.ts`, the
  components `MessagesTabs`, `PmInbox`, `PmThread`, `PmCompose`, `PmSettings`,
  `PmSent` and, for the admin, `AdminReports` in `src/client/views/`. Each form
  keeps its fields in its component; the view „Nachrichten“ is mounted once
  and follows the state, so the open tab, the open conversation and what is
  typed stay over the refresh of the state.

# Tests

* `src/core/private-messages.test.ts`, `src/server/game/private-messages.test.ts`
  (every action and refusal, the privacy of the state, the push, the reports,
  the deleted account, the round, the journal and the audit log),
  `src/server/http/private-messages.test.ts` (the admin read and its audit
  entry), `src/server/db/upgrades/20261121T1000-private-messages.test.ts`,
  `src/client/{logic,features,views}/private-messages.test.ts`, the admin tab in
  `admin-panels*.test.ts`, the mark in `navigation.test.ts`.
* `e2e/private-messages.spec.ts`, desktop and phone.

# Open

* **[U]** The whole history of every conversation travels with the state
  (as the guild chat does). With many conversations that grows; options:
  the last N messages per conversation in the state and the rest through a
  request, paging, or only the open conversation. Not decided.
* **[U]** The lock screen of the vacation mode hides the game, so a player in
  vacation mode reaches the messages through the server (they arrive, the
  push and the mark work) but the interface shows the lock screen. [E] is that
  there is no special handling of the vacation.
* **[U]** The admin can only read reports; what happens after a report (a
  warning, a ban, dismissing a report) has no tool of its own yet; the player
  moderation of the admin stays as it is.
