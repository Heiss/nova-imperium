---
type: feature
title: Guild chat
description: One chat per guild with the rights „Chat lesen“, „Chat schreiben“ and „Chatnachrichten löschen“ of the ranks, plain text of at most 1,000 characters, the last 500 messages per guild, deleted at every new round, read by the admin with an entry in the audit log (issue #169).
---

# Guild chat

Issue #169, label `next release`. Before it, guild members had no way to
talk inside the game. The owner's decisions are those of the issue and of
its comment „Geklärt“ (owner, 2026-11-14), from the conversation of
2026-11-14. The chat follows the switch of #191 (see
[Guilds on or off per round](/features/guild-switch.md)), the rights are
those of the ranks of #163 (see [Guild ranks](/features/guild-ranks.md)),
the pushes the kinds of #192 (see [Push settings per kind](/features/push-settings.md)).

This first pull request builds the chat. The event messages (D3, D4) are
not built: their texts and what an attack message shows are open
([O15](/open-points.md)).

# Decisions

The answers of the conversation of 2026-11-14 (in quotes where the owner's
words are quoted) and the D-numbers of the issue they belong to:

| Owner (2026-11-14) | Issue | Decision |
| --- | --- | --- |
| only a guild chat | D1 | The non-goal „messages between players“ is lifted for the guild chat only; private messages and chats between guilds stay non-goals. |
| „Lesen, Schreiben, Löschen“ | D2 | Three new rights in the list of #163: „Chat lesen“, „Chat schreiben“, „Chatnachrichten löschen“. The Leitung has all of them; the default rank gets read and write. |
| „Nur beim Start“ | D3 | An attack shows an event message only when the hostile fleet is launched, with the arrival time; no message about the outcome. |
| the events: joining and leaving, rank changes | D4 | Event messages when a member joined or left the guild or was removed, and for rank changes; no espionage events. |
| players choose their pushes in the options | D5 | Players choose in their options what they get pushed: guild events, guild chat messages, or both (the kinds `guild-events` and `guild-chat` of #192, every kind on by default). |
| „500 und Rundenende“ | D6 | Each guild keeps its last 500 messages, events included; every new round deletes all chats. |
| „Bleiben anonym“ | D7 | The messages of a member who left or was removed stay, shown as „ehemaliges Mitglied“; deleting an account anonymises its messages the same way instead of deleting them. |
| „Immer“ | D8 | Admins can read every guild chat; each time an admin opens one, the event log („Ereignisprotokoll“, the audit log) records it. |

* **[E]** The chat follows the guild switch of #191: while guilds are off
  there is no chat (owner, 2026-11-14).
* **[E]** Unchanged from the issue, kept by the owner as proposals: plain
  text of at most 1,000 characters, escaped on output; a rate limit per
  member; event messages are written by the server and cannot be deleted;
  leaving the guild ends access to the chat; the interface texts (tab
  „Chat“, „Senden“, „Melden“, the red mark on „Gilde“) (owner, 2026-11-14,
  all [V]).

# Proposals as built

* **[V]** Keys of the rights: `chat-read`, `chat-write`, `chat-delete`
  (`GUILD_RIGHTS` in `src/core/guild-ranks.ts`); the rights are
  independent, as every right of #163: a rank that writes without reading
  gets the text field and no messages.
* **[V]** Deleting needs „Chatnachrichten löschen“ and follows the order of
  #163 D4: messages of members of a lower rank, of former members and
  deleted accounts (no rank, lowest) and the own ones; not those of an
  equal or a higher rank. The Leitung deletes every message. Without the
  right nobody deletes, not even the own messages ([O15](/open-points.md)).
* **[V]** Existing guilds (migration 20): only the default rank gets the two
  chat rights, as D2 says; every other rank keeps its rights and gets none.
  An existing Offizier therefore reads no chat until the Leitung gives it
  the right ([O15](/open-points.md)).
* **[V]** Consequence of #163 for the new default rights: a member with
  „Ränge an Mitglieder vergeben“ who lacks the chat rights can no longer
  give the default rank, and one with „Ränge verwalten“ can no longer
  delete a rank with members (they would move to the default rank); the
  rules of 2026-11-14 are unchanged.
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
  member with „Chat lesen“; it opens the guild view and shows the name of
  the kind, „Nachrichten im Gilden-Chat“, never the text or the writer
  ([O15](/open-points.md)).
* **[V]** Interface: a box „Chat“ on the page of the own guild, below
  „Mitglieder“, not a tab: the guild view has no tabs. The messages oldest
  first in a scrolling log (`role="log"`, „Noch keine Nachrichten.“ while
  empty) that keeps its place and follows new messages at its end, each
  with the name in bold, „ehemaliges Mitglied“ in italics, the time and
  the text; „Löschen“ where the own rank may, after „Nachricht löschen?“;
  below the field „Nachricht“ and „Senden“. Answers: „Nachricht
  gelöscht.“, none for a sent message; „Diese Nachricht gibt es nicht.“
  for a message of another guild or an unknown one.
* **[V]** Admin: a button „Chat lesen“ on every guild page for the admin
  opens the chat in the dialog („Chat [Kürzel] Name“, „Schließen“), without
  „Löschen“. Each opening is an admin read `guildChat` in the audit log
  with the guild in its detail, also when refused. While guilds are off
  the admin reads nothing either.
* **[V]** The warning of the dialog „Neue Runde“ names the chat: „Ohne
  Gilden werden alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat
  gelöscht.“ (as #191 planned).

# Rules as built

* `src/core/guild-chat.ts`: `MAX_CHAT_TEXT` (1,000), `CHAT_HISTORY` (500),
  `CHAT_INTERVAL` (2,000 ms), `chatLength`, `chatTextError` and
  `canDeleteChat` (right and order, plain values as the rank rules).
* `src/server/game/guild-chat.ts` (a security file, mutation target 90 %):
  the actions `sendGuildChat` and `deleteGuildChat`, both in `GUILD` of
  `dispatch.ts`, so `requireGuilds` refuses them while guilds are off;
  `chatState` (the chat of the state for a member) and `adminGuildChat`
  (the read of the admin). Every action finds the acting member with
  `actor` of #163 and checks the right of its rank on the server.
* `POST /api/admin/guild-chat` (`src/server/http/admin.ts`): an admin read,
  audited as `admin.read` / `guildChat`.
* A new round deletes all chats (`guilds.clearChats()` in `newRound`),
  guilds on or off; off deletes them with the guilds anyway.
* Account deletion: the foreign key sets the author of its messages to
  null; the chat of a guild the account led goes with the guild.

# Data and code

* Migration 20 (see [SQLite storage](/data/sqlite.md)): the CHECK of
  `guild_rank_rights.right_key` takes the three chat rights (a rebuild of
  the table); the default rank of every guild gets `chat-read` and
  `chat-write`; table `guild_chat` (`id` AUTOINCREMENT, `guild_id` with `ON
  DELETE CASCADE`, `author` with `ON DELETE SET NULL`, `time`, `text` with
  a CHECK of 1 to 1,000 characters) with indexes on guild and author.
* Repository (`src/server/db/repos/guilds.ts`): `chat`, `chatMessage`,
  `addChat` (keeps the newest 500 of the guild), `deleteChat`, `lastChat`,
  `clearChats`; a new guild's Mitglied gets `MEMBER_RIGHTS`.
* Push: the view kind `guilds` (`PushKind`, the title in `web-push.ts`,
  the list of the service worker).
* Client: `chatBox` and `adminChatDialog` in `src/client/views/guilds.ts`
  (HTML, as the guild view; the move to Svelte belongs to #118), the
  handlers `guildChatDelete`, `guildChatAdmin` and the form
  `guildchatform` in `src/client/main.ts`, `keepChatScroll` for the place
  of the log, the types in `src/client/logic/types.ts`, the styles
  `.chat-log` and `.chat-text` (wrapping long words on a phone).

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
* `e2e/guild-chat.spec.ts`, desktop and phone: two members chat and the
  message arrives with the refresh, markup shown as text and never run,
  the rate limit and the length limit, deleting by the Leitung and refused
  for a Mitglied, an outsider without chat, leaving („ehemaliges
  Mitglied“); taking „Chat lesen“ and „Chat schreiben“ from Mitglied; the
  admin reads a chat and the audit log has the entry. `e2e/a11y.spec.ts`:
  axe on the empty chat, a member with a message, the Leitung with
  „Löschen“, a former member and the admin's dialog.
