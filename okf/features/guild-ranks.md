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
  „Das Kürzel stimmt nicht.“, „Diesen Rang gibt es nicht.“, „Der Rangname
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

* Migration 16 (see [SQLite storage](/data/sqlite.md)): table `guild_ranks`
  (id, guild, name, `position`, `UNIQUE (guild_id, position)`; 0 is the
  Leitung, a larger number a lower rank), table `guild_rank_rights` (rank,
  `right_key` with a CHECK of the five keys), `guilds.default_rank` and
  `guild_members.rank_id`. The Leitung's rights are not stored: it holds
  all in code. A new guild gets the ranks `r0_<id>` (Leitung) and `r1_<id>`
  (Mitglied), as the migration gives the existing ones.
* `src/core/guild-ranks.ts`: the keys of the rights and the limits, for the
  server and the client.
* `src/server/db/repos/guilds.ts`: the ranks belong to the guild repository
  (#117).
* `src/server/game/guild-ranks.ts` (a security file, mutation target 90 %):
  the acting member (`actor`), the checks `need` (right), `below` (order)
  and `leadOnly`, the actions `createGuildRank`, `renameGuildRank`,
  `setGuildRankRights`, `moveGuildRank`, `deleteGuildRank`,
  `setGuildDefaultRank`, `assignGuildRank`, the state of the ranks for
  the members, `handOverRank` (the Leitung's own new rank) and the action
  `dissolveGuild`. `src/server/game/guilds.ts` checks with them in
  `updateGuild`, `reviewGuildApplication` and `manageGuildMember` (the
  hand-over takes `rank`, the Leitung's new rank).
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
* `src/server/db/repos/guilds.test.ts`: the rank methods.
* `src/server/db/upgrades/migration-16.test.ts`: hand-written data, the
  constraints and cascades, and generated data of version 15.
* `e2e/guild-ranks.spec.ts`, desktop and phone: the Leitung creates a rank,
  gives it the right for applications and a member, that member accepts an
  application, a member without the right sees none and the server refuses
  it; the hand-over dialog (preselected rank, cancel, hand over as
  „Offizier“), and dissolving with members: the old Leitung has no button
  and is refused by the server, a wrong tag is refused, the right one
  dissolves the guild. `e2e/a11y.spec.ts`: axe on the directory, the
  public page, the Leitung's view with ranks and an application, a
  member's view and both dialogs.
