---
type: feature
title: Guild chat
description: One chat per guild with the rights „Chat lesen“, „Chat schreiben“ and „Chatnachrichten löschen“ of the ranks, plain text of at most 1,000 characters, events of the server (joining, leaving, removal, a new rank, an attack at its launch), a red mark on „Gilden“, the last 500 messages per guild, deleted at every new round, read by the admin with an entry in the audit log (issue #169).
---

# Guild chat

Issue #169, label `next release`. Before it, guild members had no way to
talk inside the game. The owner's decisions are those of the issue and of
its comment „Geklärt“ (owner, 2026-11-14), from the conversation of
2026-11-14. The chat follows the switch of #191 (see
[Guilds on or off per round](/features/guild-switch.md)), the rights are
those of the ranks of #163 (see [Guild ranks](/features/guild-ranks.md)),
the pushes the kinds of #192 (see [Push settings per kind](/features/push-settings.md)).

The first pull request built the chat and left eleven details open as
[O15](/open-points.md). The owner settled them in the comment „Geklärt,
Nachtrag“ (owner, 2026-11-15) on the issue; the same pull request builds
them: the event messages (D3, D4), the push kinds while guilds are off,
the push text, the red mark on „Gilden“, the chat rights of existing
ranks and the notice that the game master reads the chat.

# Decisions

The answers of the conversation of 2026-11-14 (in quotes where the owner's
words are quoted) and the D-numbers of the issue they belong to:

| Owner (2026-11-14) | Issue | Decision |
| --- | --- | --- |
| only a guild chat | D1 | The non-goal „messages between players“ is lifted for the guild chat only; private messages and chats between guilds stay non-goals. Private messages stay a non-goal after the Classic features too (owner, 2026-11-16, #226 stays an idea). |
| „Lesen, Schreiben, Löschen“ | D2 | Three new rights in the list of #163: „Chat lesen“, „Chat schreiben“, „Chatnachrichten löschen“. The Leitung has all of them; the default rank gets read and write. |
| „Nur beim Start“ | D3 | An attack shows an event message only when the hostile fleet is launched, with the arrival time; no message about the outcome. |
| the events: joining and leaving, rank changes | D4 | Event messages when a member joined or left the guild or was removed, and for rank changes; no espionage events. |
| players choose their pushes in the options | D5 | Players choose in their options what they get pushed: guild events, guild chat messages, or both (the kinds `guild-events` and `guild-chat` of #192, every kind on by default). |
| „500 und Rundenende“ | D6 | Each guild keeps its last 500 messages, events included; every new round deletes all chats. |
| „Bleiben anonym“ | D7 | The messages of a member who left or was removed stay, shown as „ehemaliges Mitglied“; deleting an account anonymises its messages the same way instead of deleting them. |
| „Immer“ | D8 | Admins can read every guild chat; each time an admin opens one, the event log („Ereignisprotokoll“, the audit log) records it. |

* **[E]** The chat follows the guild switch of #191: while guilds are off
  there is no chat (owner, 2026-11-14).

The answers of the comment „Geklärt, Nachtrag“ (owner, 2026-11-15) to O15:

| O15 | Decision (owner, 2026-11-15) |
| --- | --- |
| a | **[E]** The attack event reads „⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft 20:15“: the target, the attacker, the member and the arrival, written only at the launch (D3, „Nur beim Start“). The member events are short sentences: „Anna ist der Gilde beigetreten.“, „Anna hat die Gilde verlassen.“, „Anna wurde aus der Gilde entfernt.“, „Anna ist jetzt Offizier.“. A deleted name shows as „ehemaliges Mitglied“. |
| b | **[E]** „Gildenereignisse“ (`guild-events`) and „Nachrichten im Gilden-Chat“ (`guild-chat`) are hidden in the options while guilds are off. This settles O14 b of #191. |
| c | **[E]** The push of a message reads „Neue Nachricht im Gilden-Chat“; a push never holds the text of the message. |
| f | **[E]** A red mark on „Gilden“ for messages unread since the member's last visit to the guild view, stored per member. |
| h | **[E]** Migration 20: every existing rank below the Leitung gets „Chat lesen“ and „Chat schreiben“; only the Leitung deletes. |
| j | **[E]** The players learn that the admin reads the chats (D8) from a sentence in the changelog and a fixed line in the chat box, „Die Spielleitung kann diesen Chat lesen.“. |
| d, e, g, i, k | **[V]**, taken as recommended without asking: the owner allowed this on 2026-11-15 when a recommendation is consistent with earlier decisions, and adjusts while testing. No „Melden“, because the admin reads every chat (D8); deleting follows the order of the ranks, a member may also delete its own messages, the Leitung everything; one message per member every 2 s; the whole history of up to 500 messages travels with the state; the chat is a box on the guild page until #118 migrates that view. Built as before. |
* **[E]** Unchanged from the issue, kept by the owner as proposals: plain
  text of at most 1,000 characters, escaped on output; a rate limit per
  member; event messages are written by the server and cannot be deleted;
  leaving the guild ends access to the chat; the interface texts (tab
  „Chat“, „Senden“, „Melden“, the red mark on „Gilde“) (owner, 2026-11-14,
  all [V]). Since 2026-11-15 there is no „Melden“ (O15 e), the chat is a
  box, not a tab (O15 d), and the red mark sits on the menu entry
  „Gilden“ (O15 f).

# Proposals as built

* **[V]** Keys of the rights: `chat-read`, `chat-write`, `chat-delete`
  (`GUILD_RIGHTS` in `src/core/guild-ranks.ts`); the rights are
  independent, as every right of #163: a rank that writes without reading
  gets the text field and no messages.
* **[V]** Deleting needs „Chatnachrichten löschen“ and follows the order of
  #163 D4: messages of members of a lower rank, of former members and
  deleted accounts (no rank, lowest) and the own ones; not those of an
  equal or a higher rank. The Leitung deletes every message. Without the
  right nobody deletes, not even the own messages (O15 g, taken as
  recommended, owner, 2026-11-15).
* **[E]** Existing guilds (migration 20, owner, 2026-11-15): every rank
  below the Leitung gets „Chat lesen“ and „Chat schreiben“, the default
  rank or not; no rank gets „Chatnachrichten löschen“, so only the Leitung
  deletes. Every other right stays.
* **[V]** Consequence of #163 for the chat rights: a member with „Ränge an
  Mitglieder vergeben“ who lacks a chat right of the default rank cannot
  give the default rank, and one with „Ränge verwalten“ cannot delete a
  rank with members (they would move to the default rank); the rules of
  2026-11-14 are unchanged. Migration 20 gives every existing rank below
  the Leitung both chat rights of the default rank, so this no longer
  happens in an existing guild unless its Leitung changes the rights (a
  test in `migration-20.test.ts` proves it for an Offizier with both
  rights). It stays for a rank made later: a new rank starts without
  rights (#163), so a holder with „Ränge an Mitglieder vergeben“ cannot
  give „Mitglied“ until the Leitung gives that rank the chat rights.
* **[V]** Messages: one line of plain text, control characters removed,
  trimmed; empty is refused („Die Nachricht ist leer.“), longer than 1,000
  characters (counted as characters, not as UTF-16 units) is refused, not
  cut („Die Nachricht darf höchstens 1.000 Zeichen haben.“). Links are not
  clickable.
* **[V]** Rate limit: one message per member every 2 seconds, the example
  of the issue („Bitte warte kurz vor der nächsten Nachricht.“); a refused
  message does not count.
* **[V]** A member who left shows as „ehemaliges Mitglied“ while not a
  member of the guild; one who joins again shows with the name again. The
  name is the current one, so a renamed player shows the new name.
* **[V]** Delivery: the chat is part of the normal state of the game and
  updates with its refresh (every 4 seconds), as the issue proposes. A
  member gets the messages only with „Chat lesen“; an outsider, an
  applicant and a rank without a chat right get none.
* **[V]** Push: a message queues the kind `guild-chat` for every other
  member with „Chat lesen“; it opens the guild view and reads „Neue
  Nachricht im Gilden-Chat“ ([E], owner, 2026-11-15), never the text or
  the writer.
* **[V]** Interface: a box „Chat“ on the page of the own guild, below
  „Mitglieder“, not a tab: the guild view has no tabs. The messages oldest
  first in a scrolling log (`role="log"`, „Noch keine Nachrichten.“ while
  empty) that keeps its place and follows new messages at its end, each
  with the name in bold, „ehemaliges Mitglied“ in italics, the time and
  the text; „Löschen“ where the own rank may, after „Nachricht löschen?“;
  below the field „Nachricht“ and „Senden“. Answers: „Nachricht
  gelöscht.“, none for a sent message; „Diese Nachricht gibt es nicht.“
  for a message of another guild or an unknown one. The first line of the
  box is the owner's notice „Die Spielleitung kann diesen Chat lesen.“
  ([E], 2026-11-15), shown to every rank with the box, also one that only
  writes; the admin's dialog has none.
* **[V]** Admin: a button „Chat lesen“ on every guild page for the admin
  opens the chat in the dialog („Chat [Kürzel] Name“, „Schließen“), without
  „Löschen“. Each opening is an admin read `guildChat` in the audit log
  with the guild in its detail, also when refused. While guilds are off
  the admin reads nothing either.
* **[V]** The warning of the dialog „Neue Runde“ says that every new
  round clears the chats (D6) and names the chat among what goes without
  guilds: „Eine neue Runde leert alle Gilden-Chats. Ohne Gilden werden
  alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat gelöscht.“

## Events, push and the red mark as built (2026-11-15)

* **[V]** Which changes write an event: accepting an application
  („beigetreten“); leaving („verlassen“; not withdrawing an application,
  not dissolving the guild, whose chat goes with it); removal („entfernt“);
  a new rank by „Rang ändern“ (not the same rank again), by handing over
  the Leitung (two events: the new Leitung „ist jetzt Leitung“, the old
  one with the rank it chose) and by deleting a rank (one event per member
  moved to the default rank). An account deletion writes none.
* **[V]** The attack event is written when an attack (the mission
  Sturmangriff, the rule `alertsGuild` of its `rules.ts`) is launched at a
  member of a guild, into the chat of the defender's guild only; not for
  Auspex-Erkundung, Versorgungsflug or the other missions, not for a
  player in no guild or an applicant. The target is the coordinates
  „[1:27:11]“, also for a moon. The outcome writes nothing (D3).
* **[V]** The arrival shows as the clock time of the browser, „20:15“; on
  another day than the event, with the day before it, „16.11., 01:02“.
* **[V]** Names in an event are the current names of the accounts: a
  member who left keeps the name in its events (only a deleted name
  changes, owner 2026-11-15), a renamed one shows the new name. A deleted
  member shows as „ehemaliges Mitglied“, at the start of a sentence
  „Ehemaliges Mitglied …“. A deleted attacker shows as „Unbekannt“, the
  name the fleet arrival uses for a player it does not know: the
  attacker is not a member, so „ehemaliges Mitglied“ would be wrong (see
  the open point in the report of the pull request).
* **[V]** An event has no author, is set in italics, shows its time and
  its sentence, and nobody deletes it; the server refuses with
  „Ereignisse lassen sich nicht löschen.“. It counts toward the 500 of the
  guild and is read with „Chat lesen“ only; the admin reads it too.
* **[V]** Push of an event: the kind `guild-events` to every member with
  „Chat lesen“ but the member it is about and the member who caused it
  (the one who accepted, removed or gave the rank); the attacked member
  gets none from the guild. Its text is „Gildenereignis“, like
  „Flottenereignis“ of the fleet; never a name or a place. It opens the
  guild view.
* **[V]** The red mark: the menu entry „Gilden“ (and „Mehr“ on a phone)
  gets the mark „Neue Nachrichten im Gilden-Chat“, like „Offene
  Gildenbewerbungen“; with both, „Offene Gildenbewerbungen · Neue
  Nachrichten im Gilden-Chat“, as the fleet joins its marks. It shows for
  a message of another member or an event newer than the member's last
  visit; the own messages never. The visit is the page of the own guild
  with the chat (not the list of guilds, which shows no chat): about
  0.6 s after it shows something new, the browser sends `seeGuildChat`
  with the newest message it shows, as „Nachrichten“ marks reports read.
  A rank without „Chat lesen“ has no mark. A new membership starts with
  nothing seen.

# Rules as built

* `src/core/guild-chat.ts`: `MAX_CHAT_TEXT` (1,000), `CHAT_HISTORY` (500),
  `CHAT_INTERVAL` (2,000 ms), `chatLength`, `chatTextError` and
  `canDeleteChat` (right and order, plain values as the rank rules);
  `CHAT_EVENTS`, `chatEventText` (the sentences of the owner) and
  `chatUnread` (the red mark); the check of each action as one function
  that returns a code (#214): `sendChatError`, `deleteChatError` (also the
  flag `delete` of each message) and `seeChatError`.
* `src/server/game/guild-events.ts` (a security file, mutation target
  90 %): `memberEvent`, `rankEvent` and `attackEvent`, called by the guild
  actions (`guilds.ts`), the rank actions (`guild-ranks.ts`) and `send`
  (`fleet-actions.ts`), and `notify`, the pushes of messages and events.
  Apart from `guild-chat.ts`, which imports the rank rules, so that no
  import goes in a circle.
* `seeGuildChat` (`guild-chat.ts`, in `GUILD` of `dispatch.ts`): needs
  „Chat lesen“; stores at most the newest message of the own guild and
  never goes back.
* `src/server/game/guild-chat.ts` (a security file, mutation target 90 %):
  the actions `sendGuildChat` and `deleteGuildChat`, both in `GUILD` of
  `dispatch.ts`, so `requireGuilds` refuses them while guilds are off;
  `chatState` (the chat of the state for a member) and `adminGuildChat`
  (the read of the admin). Every action finds the acting member with
  `actor` of #163 and checks the right of its rank on the server, with the
  checks of `src/core/guild-chat.ts`, and words their codes.
* `POST /api/admin/guild-chat` (`src/server/http/admin.ts`): an admin read,
  audited as `admin.read` / `guildChat`.
* A new round deletes all chats (`guilds.clearChats()` in `newRound`),
  guilds on or off; off deletes them with the guilds anyway.
* Account deletion: the foreign key sets the author of its messages to
  null; the chat of a guild the account led goes with the guild.

# Data and code

* Migration 20 (see [SQLite storage](/data/sqlite.md)): the CHECK of
  `guild_rank_rights.right_key` takes the three chat rights (a rebuild of
  the table); every rank below the Leitung gets `chat-read` and
  `chat-write`; table `guild_chat` (`id` AUTOINCREMENT, `guild_id` with `ON
  DELETE CASCADE`, `author` with `ON DELETE SET NULL`, `time`, `kind`
  (`message` or an event), `text` with a CHECK of 1 to 1,000 characters,
  empty only for joining, leaving and removal, `member` and `attacker` with
  `ON DELETE SET NULL`, `arrival` exactly for an attack; an event has no
  author, a message no member) with indexes on guild, author, member and
  attacker; `guild_members.chat_seen` (0 for every member), the newest
  message of the last visit.
* Repository (`src/server/db/repos/guilds.ts`): `chat` and `chatMessage`
  (with the current names of `member` and `attacker`), `addChat` and
  `addChatEvent` (both keep the newest 500 of the guild), `deleteChat`,
  `lastChat`, `seeChat`, `clearChats`; a new guild's Mitglied gets
  `MEMBER_RIGHTS`.
* Push: the view kind `guilds` (`PushKind`, the title in `web-push.ts`,
  the list of the service worker); each push carries its text as `body`.
  The options hide `GUILD_PUSH_TOPICS` (`src/core/push.ts`) while guilds
  are off; the stored choice stays.
* Missions: the typed rule `alertsGuild` (true for the attack only).
* Client: `chatBox` and `adminChatDialog` in `src/client/views/guilds.ts`
  (HTML, as the guild view; the move to Svelte belongs to #118), the
  handlers `guildChatDelete`, `guildChatAdmin` and the form
  `guildchatform` in `src/client/main.ts`, `keepChatScroll` for the place
  of the log, the types in `src/client/logic/types.ts`, the styles
  `.chat-log`, `.chat-text` (wrapping long words on a phone) and
  `.chat-event`; `arrivalAt` (`logic/format.ts`), the mark in
  `menuHints` and `chatToSee` (`logic/menu-hints.ts`), `seeChat` in
  `main.ts`.

# Tests

* `src/core/guild-chat.test.ts`: the limits, counting characters, the
  rule of deleting; properties for the length and the deletion rule.
* `src/server/game/guild-chat.test.ts`: every right allowed and refused
  (read, write, delete), outsiders and applicants refused, the order of
  deleting, messages of another guild, plain text stored as written, the
  limits, the rate limit, 500 per guild (and a property), leaving,
  removal and account deletion („ehemaliges Mitglied“, author null, the
  chat of a dissolved guild gone), the round with guilds on and off, the
  switch (actions, state and admin read refused), the push kind for every
  reader but the writer and its filter at delivery, and the admin read.
* `src/server/game/guild-switch.test.ts`: both chat actions in the list
  and refused while off; a round with guilds on keeps the guilds and
  deletes the chats.
* `src/server/db/repos/guilds.test.ts`, `src/core/guild-ranks.test.ts`,
  `src/server/game/guild-ranks.test.ts`: the new rights and the default
  rights of Mitglied.
* `src/server/db/upgrades/migration-20.test.ts`: hand-written data of
  version 19 (a guild whose default rank is not Mitglied included), the
  CHECKs and foreign keys, the cascade with the guild, anonymisation by
  account deletion, the new round, and generated data of version 19.
* `src/server/http/guild-chat.test.ts`: the admin read with its audit
  entries, refused for an unknown guild, while guilds are off and for a
  player.
* `src/client/views/guilds.test.ts`: what each rank sees, „Löschen“,
  „ehemaliges Mitglied“, every name and text escaped, the admin's button
  and dialog.
* `src/server/game/guild-events.test.ts`: every event (joining, leaving,
  removal, a new rank by „Rang ändern“, the hand-over and a deleted rank),
  none for an application, its refusal, its withdrawal or a dissolved
  guild, the attack with target, attacker, member and arrival only for the
  attack mission and a member, the names of former and deleted accounts,
  events never deletable, read only with „Chat lesen“ and by the admin,
  the push „Gildenereignis“ to the right members and its filter, and the
  red mark (`unread`, `seeGuildChat`).
* `src/core/missions.test.ts` and the tests of each mission: the rule
  `alertsGuild`; `src/client/logic/menu-hints.test.ts`,
  `push-options.test.ts`, `format.test.ts`, `views/misc.test.ts`: the
  mark, the hidden kinds, the arrival, the warning.
* `src/test/naming.test.ts` allows „Angriff auf“ in `core/guild-chat.ts`
  only: the owner's text of the attack event.
* `e2e/guild-chat.spec.ts`, desktop and phone: two members chat and the
  message arrives with the refresh, markup shown as text and never run,
  the rate limit and the length limit, deleting by the Leitung and refused
  for a Mitglied, an outsider without chat, leaving („ehemaliges
  Mitglied“); taking „Chat lesen“ and „Chat schreiben“ from Mitglied; the
  admin reads a chat and the audit log has the entry; the events
  (joining, a new rank, an attack launched by a third player through the
  Sternenkarte, removal, none deletable), the notice, and the red mark
  that comes with a message while the Leitung is elsewhere and goes on the
  page of the guild. `e2e/guild-switch.spec.ts`: the two push kinds hidden
  while guilds are off. `e2e/a11y.spec.ts`: axe on the empty chat, an
  event with the notice, a member with a message, the red mark on
  „Gilden“, the Leitung with „Löschen“, a former member and the admin's
  dialog.
