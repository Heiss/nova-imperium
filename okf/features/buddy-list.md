---
type: feature
title: Buddy list
description: Mutual friendships with a request and an acceptance, what friends see of each other, and that friendships and open requests stay across a new round (issue #227).
---

# Buddy list

Issue #227, part of the Classic features (#222): a friendship needs a
request and its acceptance. The owner's answers of 2026-11-16 to D1 to D3.

# Decisions

* **[E]** What friends see (owner, 2026-11-16, D1): the name and the
  contact; no activity of their own beyond online or offline (below).
* **[E]** Contact means the name and the guild tag with a link to the
  star map; private messages were a non-goal then (owner, 2026-11-16) and
  are built since 2026-11-21 (#226,
  [Private messages](/features/private-messages.md)), where friends are the
  ones who may write to a player who switched on „only friends“.
* **[E]** Friends see each other online or offline, beyond the public
  [activity indicators](/features/activity-indicators.md) (owner,
  2026-11-16).
* **[E]** New round (owner, 2026-11-16, D2): everything stays, the
  friendships and the open requests.
* **[E]** Fighting together (owner, 2026-11-16, D3): part of the admin's
  setting per round, guild, friends or both, for holding and the attack
  union (see [Holding and ACS](/features/holding-acs.md)).

# Built

* **[V]** The rules (issue #227): a request, accept or refuse, cancel the
  own request, end a friendship; a friendship exists only after the
  acceptance. They are pure in `src/core/friends.ts` (patterns,
  section 7): `relationOf` (none, outgoing, incoming, friends) and
  `friendError` with the codes `unknown`, `self`, then by the relation
  `friends`, `outgoing`, `incoming` (a crossed request), `noRequest`,
  `noFriend`. A repeated action is refused and changes nothing, so every
  action is idempotent; a crossed request is refused, not taken as an
  acceptance. A refused request is deleted, so it can be sent again.
* **[V]** The actions of `src/server/game/friends.ts`: `requestFriend`
  (`name`, the player's name without case), `answerFriend` (`uid`,
  `accept`: only `true` accepts), `cancelFriend` and `removeFriend`
  (`uid`). They are no guild actions, so they work while guilds are off.
  No limit on requests beyond the request limit of every game action.
* **[V]** Stored in the table `friendships` of migration
  `20261118T2230-friendships`, one row per pair (see
  [SQLite storage](/data/sqlite.md)); deleting an account deletes its rows
  by the foreign keys; a new round keeps them (D2).
* **[V]** The state carries `friends` only for the player: the friends
  with `online`, and the ids of the open requests to the player and of the
  own ones, each sorted by name. Name, guild tag and planet come from the
  public state (`players`, `guilds`, `galaxy`), so nothing new is public.
  No time of the last interaction is sent, only online or offline.
* **[E]** Online follows the threshold of the activity mark of #229
  instead of a fixed 15 minutes (owner, 2026-11-17).
* **[V]** Online: the account's last activity (a login or a manual action,
  `users.active_at`, from its creation without one; see
  [Activity indicators](/features/activity-indicators.md)) lies less than
  `activityRecent` minutes back, the first threshold of that feature
  („Aktivität ohne Minutenangabe (Minuten)“, in which a planet shows only
  „Aktiv“): 15 by default, set by the admin in „Neue Runde“ and live in
  the universe settings. `isOnline` in `src/core/friends.ts` takes the
  minutes; `friendState` gets them from the thresholds of the round. Taken
  as recommended: the owner named „the threshold of the activity mark
  („Aktivität vor x Minuten“)“, and that mark has two thresholds; the
  first one is the star of the classic game, which the build used before
  with its fixed 15 minutes. The activity time of the admin's play time
  estimate (`player_activity`) is no longer read, so friendship touches no
  private play time. Open requests show no status.
* **[V]** The contact's planet is the one the Highscore names (a planet of
  the player, never a moon); its coordinates open its system on the
  Sternenkarte, as on the Highscore.
* **[V]** The view „Freunde“ in the menu after „Gilden“ (on a phone under
  „Mehr“): a table of the friends („Spieler“, „Gilde“, „Heimatplanet“,
  „Status“ with „online“ or „offline“, „Freundschaft beenden“ after the
  question „Freundschaft beenden?“; on a phone each friend a block of its
  own), „Du hast noch keine Freunde.“ without one; the box „Anfragen“ with
  „Annehmen“ and „Ablehnen“, „Keine offenen Anfragen.“ without one; the
  box „Deine Anfragen“ with „Anfrage zurückziehen“, only with an own
  request; the box „Freundschaft anfragen“ with the field „Name“. The mark
  „!“ on „Freunde“ names „Offene Freundschaftsanfragen“, as the guild
  applications have theirs.
* **[V]** Messages, worded after the guild applications: „Anfrage
  gesendet.“, „Anfrage angenommen.“, „Anfrage abgelehnt.“, „Anfrage
  zurückgezogen.“, „Freundschaft beendet.“; refusals „Spieler nicht
  gefunden.“, „Das bist du selbst.“, „Ihr seid bereits Freunde.“, „Deine
  Anfrage ist bereits offen.“, „‹Name› hat dir bereits eine Anfrage
  geschickt.“, „Diese Anfrage gibt es nicht.“, „Diese Freundschaft gibt es
  nicht.“.

# Open

* **[E]** D3 is built with #55 and #225, not with this issue; its default
  is „Gilde und Freunde“, the classic rule (owner, 2026-11-17). Until then
  the round setting has no effect and no label here. Holding and the
  attack union ask whether two players are friends with `relationOf`
  (`friends`), so ending a friendship ends what it allowed at once.
* **[E]** The German texts of the build are confirmed as they are (owner,
  2026-11-17): the view „Freunde“, its columns and boxes, the messages and
  refusals, the menu mark and the changelog text.

# Tests

* Unit: `src/core/friends.test.ts`, `src/server/db/repos/friends.test.ts`,
  `src/server/game/friends.test.ts` (the actions, D1 with the round's
  threshold, D2, account deletion), `src/client/logic/friends.test.ts`,
  `src/client/views/friends.test.ts`, the mark in
  `src/client/logic/menu-hints.test.ts`.
* Upgrade: `src/server/db/upgrades/20261118T2230-friendships.test.ts`.
* E2E: `e2e/friends.spec.ts`, desktop and phone, with axe on „Freunde“;
  „Freunde“ in `e2e/a11y.spec.ts` and `e2e/phone-overflow.spec.ts`.
