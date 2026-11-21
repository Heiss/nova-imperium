---
type: feature
title: Private messages
description: Conversations between two players in „Nachrichten“ with an inbox of previews, a conversation that loads when it is opened, the tab „Gesendet“, replies, read marks, deleting from one's own view, a block list, the switch „only friends may write to me“, a push without the text, „Melden“ to the admin, kept until the round ends, the last 500 messages per conversation (issue #226).
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
* **[E]** Lock screen (Q28, owner, 2026-11-21): the lock screen of the vacation
  mode offers „Nachrichten“ (the inbox and replying) and nothing else of the
  interface. This changes the view the owner decided on 2026-11-18
  ([Vacation mode](/features/vacation-mode.md)): the lock screen held the
  notice, „Urlaubsmodus beenden“, „Logout“ and the account options only, and
  keeps exactly that. Added: „Nachrichten“ with the tabs „Posteingang“ and
  „Gesendet“ and replying. The reports („Berichte“) were not reachable from the
  lock screen and stay unreachable.
* **[E]** The text of the journal of the round and of the audit log: the
  message text, e-mail addresses, passwords, codes and tokens are never
  stored there; the journal keeps the length of a text only (the allow-list
  `src/server/game/journal-input.ts`), a push never carries the text.

# Proposals as built

* **[V]** Q32 (coordinator, 2026-11-21; replaces the state of 50 messages per
  conversation of Q27): the state carries per conversation only the newest
  message as the preview (`last`), the unread count of the whole conversation
  and `more` (whether older messages exist than `last`); the 500 kept per
  conversation stay the owner's rule. The conversation that is open loads its
  newest `PM_PAGE` (50, `src/core/private-messages.ts`: a technical page size,
  not a rule of the owner) by the action `openPrivateConversation {name}` when
  the player opens it (the click on its name in the inbox, or sending to it),
  oldest first, with `more`, answered as the data of the action (no new
  state). The name is the other player's name, empty for the deleted accounts,
  and is checked like the names of the other actions: an unknown name is
  refused with „Spieler nicht gefunden.“, only the player's own messages of
  that conversation come, none it deleted from its own view, nothing is stored.
  Older pages load through `olderPrivateMessages {before}` (Q27: the id of the
  oldest message the browser shows; at most 50 per call, oldest first; the
  conversation is the one of the message `before`, found like every message id
  (`ownMessage`): an id of another conversation, a message the player deleted
  from its own view and an unknown id are refused with the same words, „Diese
  Nachricht gibt es nicht.“; the SQL is parameterised). The button is „Ältere
  Nachrichten laden“ above the messages of an open conversation while `more`
  of the loaded thread.
* **[V]** Q32, the open conversation: the browser tells the server which
  conversation it has open and the id of the newest message it holds with the
  poll and with every action request: `GET /api/state?pm=<name>&pmAfter=<id>`
  and the fields `pm`, `pmAfter` of the body of `POST /api/action` (next to
  `planet`). The state then carries `privateMessages.open = { with, messages }`:
  the messages of that conversation with an id above `pmAfter`, oldest first
  (at most the 500 kept, so nothing is missed between two polls, and nothing
  is sent twice once the browser names the newer id). Only the player's own
  side of the conversation, none it deleted; a name no player has gives no
  `open`, and an odd `pm` or `pmAfter` (not a text, not a whole number from 0)
  is a plain poll. The browser names nothing until the conversation has
  loaded, then the newest id it holds; it adds what comes (by id, so a message
  that came twice is held once) and deletes a message it deleted from its own
  view. `src/server/game/private-messages.ts` (`pmOpenOf`) reads the two
  fields, `StateView.pmOpen` carries them to the part of the state; the lock
  state carries `open` too. Nothing of it is stored, journaled or logged: the
  path of a request is logged without its query, and the journal keeps only the
  fields of the allow-list.
* **[V]** Q33 (coordinator, 2026-11-21): the tab „Gesendet“ stays (owner) and
  loads its newest 50 sent messages by the action `sentPrivateMessages
  {before?}` when the tab is opened (a click or a key on the tab), newest first,
  with `more` and the name of each recipient (null for a deleted account, shown
  as „Gelöschter Spieler“), and the same button „Ältere Nachrichten laden“ for
  the next page (`before` the id of the oldest sent message shown). Checked
  like the other actions: only messages the player sent and did not delete from
  its own view; a cursor that is a foreign, a received, an odd or an unknown id
  is refused like an unknown message, „Diese Nachricht gibt es nicht.“, and
  nothing is stored. „Löschen“ in the list removes the message from it at once.
  The list is not part of the state; it is loaded again each time the tab is
  opened.
* **[V]** Q34 (coordinator, 2026-11-21): on an open conversation of the lock
  screen „Melden“, „Löschen“ and „Blockieren“ stay as built. Both new loads
  work on the lock screen (`PM_ACTIONS`, so the vacation mode lets them
  through), and so does the open conversation of the poll.
* **[V]** Q35 (coordinator, 2026-11-21): kept as built.
* **[V]** No load without a click (#335): the three loads are sent only from the
  handler of a click or a key (the conversation's name, the tab, the button
  „Ältere Nachrichten laden“, sending a message to a conversation); the poll
  and any redraw never send one, no `$effect` and no start of a component
  calls one (a test reads the four components and pins it). The class of the
  new actions in `src/core/action-kind.ts` (the file does not exist on this
  branch) is for the main agent: `click` for `openPrivateConversation`,
  `sentPrivateMessages` and `olderPrivateMessages`.
* **[V]** The inbox shows each conversation as the name, the time and the
  preview (the newest message on one line, cut with „…“ by the style
  `.pm-preview`), no text of its own. The open conversation and a reply being
  typed stay over the poll: the components are mounted once and the thread is
  kept in the component.
* **[V]** Blocking does nothing to earlier messages: only future sends are
  refused (Q29, coordinator, 2026-11-21). A test pins it
  (`does nothing to earlier messages`).
* **[V]** The admin can only view a report; what happens next is the existing
  player moderation of the admin (Q30, coordinator, 2026-11-21). No tool of its
  own.
* **[V]** On the lock screen „Nachrichten“ is a section below the notice with
  the heading „Nachrichten“ (one level below the title „Urlaubsmodus“); it
  has the tabs „Posteingang“ and „Gesendet“, the conversations with the
  messages, „Antworten“ and the actions of an open conversation („Melden“,
  „Löschen“, „Unterhaltung löschen“, „Blockieren“). It has no „Neue
  Nachricht“, no list of recipients (the lock state holds no players), no
  settings („Nur Freunde dürfen mir schreiben“, „Blockierte Spieler“) and no
  „Berichte“. The lock state carries the key `privateMessages` and nothing
  else of the game. The section is mounted once (`src/client/views/
  vacation-lock.ts`), so the open conversation and a reply being typed stay
  over a render.

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
* **[V]** Delivery: the conversations (the previews) are part of the player's
  own state and update with its refresh; the messages of the open conversation
  come with it as `open` (Q32). Nobody else's state holds anything of them.
  Size of one poll for 20 conversations of 500 messages of 1,000 characters:
  10,587,750 bytes with the whole history, 1,064,698 with a page of 50 per
  conversation (Q27), 27,356 with the preview only (Q32).
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
  `reportPrivateMessage`, `blockPlayer`, `unblockPlayer`,
  `privateMessageOptions`, `olderPrivateMessages`, `openPrivateConversation`
  and `sentPrivateMessages` (not guild actions: they work with guilds off), the
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
* Q27, Q32, Q33: `paging (Q27, …)`, `the open conversation (Q32, …)` and
  `„Gesendet“ (Q33, …)` in `src/server/game/private-messages.test.ts` (the
  preview only in the state, the newest 50 of a conversation by the action, the
  older pages in order without gap or duplicate, the page borders, the messages
  newer than the browser holds, hidden messages left out, a foreign, odd or
  unknown name or id refused like an unknown one, nothing written, the cap of
  500), the query of the poll in `src/server/http/private-messages.test.ts`,
  `src/server/game/private-messages-size.test.ts` (the size of one poll with 20
  conversations of 500 messages of 1,000 characters; printed with
  `NOVA_PRINT_SIZES=1`), `an open conversation (Q27, Q32)` and `the sent
  messages (Q33)` in `src/client/logic/private-messages.test.ts`, the loads in
  `src/client/features/private-messages.test.ts`, `no load without a click` in
  `src/client/views/private-messages.test.ts`, `refresh` in
  `src/client/sync.test.ts`, the extra fields in `src/client/logic/act.test.ts`,
  the address in `src/client/logic/address.test.ts`.
* Q28, Q34: `carries the own private messages on the lock screen` (the two
  loads and the open conversation included) and the allow-list in
  `src/server/game/vacation.test.ts`, `the tabs on the lock screen` in
  `src/client/views/private-messages.test.ts`, the place in
  `src/client/views/vacation-lock.test.ts`, the E2E case in
  `e2e/vacation.spec.ts`.
* Q29 `does nothing to earlier messages`, the checks of the report (a foreign
  id, an unknown id and an odd id answer alike and store nothing; „Gelöschter
  Spieler“ for a deleted sender, recipient or reporter; the copy of the text
  cleared with the round) in `src/server/game/private-messages.test.ts`; the
  text in no table but the messages and the reports, no journal, audit or
  error log row and no log line in `src/server/http/private-messages.test.ts`.

# Open

* **[U]** The lock screen shows no „Neue Nachricht“ and no settings; the
  owner said „the inbox and replying“ ([V] reading, Q28). Not decided whether a
  player in vacation mode may also write a first message, block or report.
* **[V]** The admin can only view a report; what happens after a report (a
  warning, a ban, dismissing a report) has no tool of its own; the player
  moderation of the admin stays as it is (Q30).
