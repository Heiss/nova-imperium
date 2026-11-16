---
type: feature
title: Guild ranks with configurable rights
description: Ranks with rights inside a guild, exactly one Leitung, an order of the ranks, a default rank chosen by the Leitung; checked on the server for every action (issue #163).
---

# Guild ranks with configurable rights

Issue #163, label `next release`. Before it, a guild had one leader
(`guilds.founder`) and members; only the leader changed the guild, decided
on applications, removed members and handed over the lead. The owner's
decisions are those of the issue and of its comments „Geklärt“ and
„Geklärt, Ergänzung“ (owner, 2026-11-13), which replace the earlier
proposals of the issue.

Guilds, ranks included, can be off for a whole round (#191, see
[Guilds on or off per round](/features/guild-switch.md)); then every action
of this page is refused before its own checks.

# Decisions

* **[E]** Ranks with different rights inside a guild; they are configurable
  (owner, 2026-11-13).
* **[E]** A new guild starts with two ranks, **Leitung** and **Mitglied**;
  everything further is set up by the Leitung or a rank it gives the right
  (owner, 2026-11-13).
* **[E]** There is exactly **one** Leitung. It holds every right (owner,
  2026-11-13).
* **[E]** The rights (D1, owner, 2026-11-13); a rank holds any set of them.
  More rights may come with later features.

  | Key | Right |
  | --- | --- |
  | `applications` | Bewerbungen annehmen und ablehnen |
  | `remove` | Mitglieder entfernen |
  | `assign` | Ränge an Mitglieder vergeben |
  | `profile` | Gildenname, Kürzel und Text ändern |
  | `ranks` | Ränge verwalten (anlegen, umbenennen, Rechte ändern, ordnen, löschen; D2) |
  | `chat-read` | Chat lesen (#169) |
  | `chat-write` | Chat schreiben (#169) |
  | `chat-delete` | Chatnachrichten löschen (#169) |

* **[E]** The guild chat adds three rights (owner, 2026-11-14, #169 D2):
  „Chat lesen“, „Chat schreiben“ and „Chatnachrichten löschen“. The Leitung
  holds them as every right; the default rank gets read and write, so a new
  guild's „Mitglied“ starts with both (see [Guild chat](/features/guild-chat.md)).
  In existing guilds every rank below the Leitung gets read and write, and
  only the Leitung deletes (owner, 2026-11-15, migration 20). The rule that
  a member gives only a rank whose rights it holds therefore still lets an
  existing Offizier with „Ränge an Mitglieder vergeben“ give the default
  rank; a rank made later starts without rights and cannot, until it gets
  the chat rights (see [Guild chat](/features/guild-chat.md)).
* **[V]** Every change of a member's rank writes an event into the guild
  chat (#169 D4): „Rang ändern“, the hand-over of the Leitung (both
  members) and a deleted rank (each member moved to the default rank).

* **[E]** The right „Marker auf der Lagekarte“ comes with #160. #160 is an
  idea in discussion and not built (checked 2026-11-14), so this pull
  request leaves the right out.
* **[E]** Only the Leitung, never a right: dissolving the guild and handing
  over the Leitung (D3) (owner, 2026-11-13); how, see the decisions of
  2026-11-14 below.
* **[E]** Order (D4): the ranks are ordered; a member acts only on members
  of a lower rank and gives only rights it holds itself (owner,
  2026-11-13).
* **[E]** Default rank (D5): the Leitung chooses the rank new members get;
  until it chooses, it is „Mitglied“ (owner, 2026-11-13). Read literally:
  choosing it is a step of the Leitung, not part of „Ränge verwalten“.
* **[E]** The Leitung can never be the default rank; the default rank can
  never be deleted; a guild always has at least two ranks; deleting a rank
  moves its members to the default rank. „Mitglied“ is only the first
  default rank: it can be renamed, and deleted once another rank is the
  default (owner, 2026-11-13, „Geklärt, Ergänzung“).
* **[E]** Limits (D6): at most **25 ranks** per guild, the Leitung included;
  a rank name has at most **67 characters** (owner, 2026-11-13).
* **[E]** Visibility (D7): ranks are shown only inside the guild; the public
  guild page shows none, also not who holds the Leitung (owner,
  2026-11-13). The directory sent to every player no longer has the field
  `founder`.
* **[E]** Migration: every existing member gets „Mitglied“, `guilds.founder`
  stays the Leitung (owner, 2026-11-13).
* **[E]** Every action checks the right of the acting member's rank on the
  server; the interface only hides what a rank may not do (issue #163).

# Consequences of the order

These follow from D4 and the single Leitung; no further decision:

* The Leitung is the highest rank. No member is above it, so nobody
  renames, moves, deletes or changes the Leitung rank, and it cannot be
  given to a member: only the hand-over moves it.
* A member does not act on its own rank or on a member of the same rank
  („lower“ is strictly lower): it cannot remove an equal, change its own
  rank or give itself rights.
* With exactly two ranks, the Leitung and the default rank are the only
  ones and neither can be deleted, so the minimum of two ranks holds
  without a check of its own.
* Applicants have no rank; deciding on them needs only the right.

# Decisions of 2026-11-14

The owner answered the five open points of the first build (owner,
2026-11-14):

* **[E]** Hand-over: the Leitung chooses its own new rank in the hand-over
  dialog; preselected is the highest rank below the Leitung. The server
  refuses a rank that is not one of the guild („Diesen Rang gibt es
  nicht.“) and the Leitung itself. This replaces the first build, which
  gave the old Leitung the default rank.
* **[E]** A member with „Ränge verwalten“ can neither give nor take away a
  right it lacks on a lower rank; saving a rank leaves such a right as it
  is, and a change of it is refused (as built).
* **[E]** A rank name exists once per guild, case-insensitive (as built).
* **[E]** A rank name has at least **2 characters** (as built). Names are
  trimmed and control characters removed, as for the guild name.
* **[E]** Dissolving: the Leitung has a button „Gilde auflösen“ that works
  while members remain, confirmed by typing the tag (Kürzel) of the guild.
  It removes every member and deletes the guild with its ranks, rights and
  applications, as the deletion of the Leitung's account does. Only the
  Leitung, never a right; every other member gets „Nur die Gildenleitung
  kann die Gilde auflösen.“. Leaving as the last member still dissolves
  the guild, as before.

From the review of the pull request (#197, owner, 2026-11-14): no rank
may pass on a right its holder lacks.

* **[E]** Giving a rank: refused when the rank holds a right the actor
  lacks („Dazu fehlt deinem Rang das Recht.“), besides the order (the
  member and the rank below the actor). The Leitung holds every right and
  is not affected.
* **[E]** Deleting a rank with members: its members move to the default
  rank, so the deletion is allowed only when the default rank is strictly
  below the actor and holds no right the actor lacks, the same rules as
  giving it. A rank without members goes freely. The Leitung may always
  delete.
* **[E]** The pure rules of the ranks are plain functions in
  `src/core/guild-ranks.ts`, used by the server and the guild view; the
  server keeps finding the acting member, the order of the steps and the
  storage.
* **[E]** A box of a right that the own rank cannot change shows the
  server's state after a refresh; only the boxes it can change keep an
  unsaved tick or clear.

# Proposals

* **[V]** The tag typed to dissolve is compared trimmed and
  case-insensitively, as tags are stored in capitals and unique without
  regard to case.
* **[V]** A new rank has no rights and stands lowest; „Nach oben“ and
  „Nach unten“ swap it with its neighbour, but never to or above the own
  rank.
* **[V]** German texts (the first two from the issue, „Nur die
  Gildenleitung kann die Gilde auflösen.“ from the issue too):
  „Dazu fehlt deinem Rang das Recht.“, „Das geht nur bei Rängen unter
  deinem.“, „Das darf nur die Gildenleitung.“ (as before, for the hand-over
  and the default rank), „Wähle für dich einen Rang unter der Leitung.“,
  „Das Kürzel stimmt nicht.“, „Der Rang hat Mitglieder, und der
  Standardrang steht nicht unter deinem oder hat ein Recht, das dir
  fehlt.“ (deleting a rank with members, review of #197), „Diesen Rang
  gibt es nicht.“, „Der Rangname
  braucht 2 bis 67 Zeichen.“, „Diesen Rangnamen gibt es in der Gilde
  schon.“, „Eine Gilde hat höchstens 25 Ränge.“, „Der Standardrang kann
  nicht gelöscht werden.“, „Die Leitung kann nicht der Standardrang
  sein.“, „Dieses Recht gibt es nicht.“, „Der Rang steht schon ganz
  unten.“; answers „Rang angelegt.“, „Rang umbenannt.“, „Rechte
  gespeichert.“, „Rang verschoben.“, „Rang gelöscht.“, „Standardrang
  gesetzt.“, „Rang vergeben.“, „Gildenleitung übergeben.“, „Gilde
  aufgelöst.“.
* **[V]** Interface (issue #163): the box „Ränge“ in the own guild lists the
  ranks in their order with their rights; a rank the member may manage has
  „Rangname“ with „Umbenennen“, the rights as checkboxes (those it lacks
  disabled) with „Rechte speichern“, „Nach oben“, „Nach unten“ and
  „Löschen“; the Leitung has „Als Standardrang“; „Rang anlegen“ below.
  The member list shows the rank of each member and „Rang ändern“ for
  those who may. The default rank is marked „Standardrang“.
* **[V]** Dialogs: „Leitung übergeben“ with „Dein neuer Rang“ (the ranks
  below the Leitung, highest first and preselected), „Übergeben“ and
  „Abbrechen“; „Gilde auflösen“ with the warning „Alle Mitglieder
  verlassen die Gilde; ihre Ränge und offenen Bewerbungen werden gelöscht.
  Das kann nicht rückgängig gemacht werden.“, the field „Gib zur
  Bestätigung das Kürzel <Kürzel> ein“, „Gilde endgültig auflösen“ and
  „Abbrechen“.

# Data and code

* Migration 19 (see [SQLite storage](/data/sqlite.md)): table `guild_ranks`
  (id, guild, name, `position`, `UNIQUE (guild_id, position)`; 0 is the
  Leitung, a larger number a lower rank), table `guild_rank_rights` (rank,
  `right_key` with a CHECK of the five keys), `guilds.default_rank` and
  `guild_members.rank_id`. The Leitung's rights are not stored: it holds
  all in code. A new guild gets the ranks `r0_<id>` (Leitung) and `r1_<id>`
  (Mitglied), as the migration gives the existing ones. Migration 20 (#169)
  adds the three chat rights to the CHECK and gives every rank below the
  Leitung `chat-read` and `chat-write` (owner, 2026-11-15); a new guild's
  Mitglied gets them too (`MEMBER_RIGHTS`).
* `src/core/guild-ranks.ts`: the keys of the rights, the limits and the
  pure rules with plain values (a place is 0 for the Leitung, a larger
  number for a lower rank, Infinity for no rank): `memberPlace`,
  `isBelow`, `belowLeitung` (default rank and the old Leitung's rank),
  `rankNameError`, `changedRights`, `missingRights`, `canChangeRights`,
  `assignError` and `deleteError`; they return an error code, the server
  turns it into the German message. Tests in `src/core/guild-ranks.test.ts`.
  The guild view offers, through the checks of `src/core/guild-checks.ts`,
  only the ranks the own rank may give and „Löschen“ only where the
  deletion is allowed.
* `src/server/db/repos/guilds.ts`: the ranks belong to the guild repository
  (#117).
* `src/core/guild-checks.ts` (#214, a security file, mutation floor 100):
  the check of each guild action as one pure function that returns the
  code of its first refusal in the order of the server, or null, with the
  rules above as its parts: `createGuildError`, `updateGuildError`
  (`profileError` and the limits of the profile), `applyError`,
  `reviewError`, `leaveError`, `manageMemberError`, `managedError` (a rank
  the actor may change), `createRankError`, `renameRankError`,
  `rightsError`, `moveRankError`, `deleteRankError`, `defaultRankError`
  (also the Leitung's own new rank at the hand-over), `assignRankError` and
  `dissolveError`. Tests in `src/core/guild-checks.test.ts`.
* `src/server/game/guild-ranks.ts` (a security file, mutation target 90 %):
  the acting member (`actor`), `refuse` and the shared messages
  `GUILD_ERROR` by the codes of the checks, the actions `createGuildRank`,
  `renameGuildRank`, `setGuildRankRights`, `moveGuildRank`,
  `deleteGuildRank`, `setGuildDefaultRank`, `assignGuildRank`, the state
  of the ranks for the members and the action `dissolveGuild`.
  `src/server/game/guilds.ts` words the codes of `updateGuild`,
  `reviewGuildApplication` and `manageGuildMember` (the hand-over takes
  `rank`, the Leitung's new rank) with them.
* Client: `src/client/views/guilds.ts` (with `transferDialog` and
  `dissolveDialog` in the `#modal` dialog), handlers in
  `src/client/main.ts`.

# Tests

* `src/server/game/guild-ranks.test.ts`: every right allowed and refused,
  the Leitung with every right, outsiders and applicants refused, unknown
  rights, the Leitung-only steps (the hand-over with the chosen rank,
  dissolving: allowed, refused, wrong tag, data removed), the order
  (members, ranks, rights, moves),
  deleting a rank and the default rank, the limits, and what the guild view
  shows inside and outside.
* `src/server/game/guild-ranks.test.ts`, review of #197: giving a rank
  with a right the actor lacks refused, with all its rights allowed, the
  Leitung unaffected; deleting a rank with members into a default rank
  with a right the actor lacks or not below it refused, below and without
  such a right allowed, a rank without members and the Leitung always.
* `src/core/guild-ranks.test.ts`: the pure rules.
* `src/server/db/repos/guilds.test.ts`: the rank methods.
* `src/server/db/upgrades/migration-19.test.ts`: hand-written data, the
  constraints and cascades, and generated data of version 18.
* `e2e/guild-ranks.spec.ts`, desktop and phone: the Leitung creates a rank,
  gives it the right for applications and a member, that member accepts an
  application, a member without the right sees none and the server refuses
  it; the hand-over dialog (preselected rank, cancel, hand over as
  „Offizier“), and dissolving with members: the old Leitung has no button
  and is refused by the server, a wrong tag is refused, the right one
  dissolves the guild. `e2e/a11y.spec.ts`: axe on the directory, the
  public page, the Leitung's view with ranks and an application, a
  member's view and both dialogs. A third rank test (desktop): after a
  refresh, a disabled box shows the right the Leitung just gave, and the
  own unsaved tick stays.
