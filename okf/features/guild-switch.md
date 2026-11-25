---
type: feature
title: Guilds on or off per round
description: One switch „Gilden (mit Chat)“ in the dialog „Neue Runde“ turns guilds and the guild chat (#169) on or off for a whole round; off deletes every guild and the server refuses every guild action (issue #191).
---

# Guilds on or off per round

Issue #191, label `ready`. Before it, guilds were always on and a new round
kept them. The owner's decisions are those of the issue and of its comment
„Geklärt“ (owner, 2026-11-14), from the conversation of 2026-11-14: „die
chat funktion (plus gildenfunktion) lässt sich via admin panel zum beginn
einer runde (de-)aktivieren“.

# Decisions

* **[E]** The admin switches the guild function, together with the guild
  chat (#169), on or off at the start of a round (owner, 2026-11-14).
* **[E]** One switch for both: a single checkbox „Gilden (mit Chat)“ in the
  dialog „Neue Runde“. Guilds without chat are no option of their own
  (owner, 2026-11-14).
* **[E]** Only at a new round: the switch is part of the dialog „Neue
  Runde“ and can be changed only there. The dialog is preselected with the
  current setting, and the choice applies to the whole round, as the
  checkboxes of the achievements and daily rewards (owner, 2026-11-14; see
  [Admin](/features/admin.md)).
* **[E]** Guilds off: a new round with guilds off deletes every guild with
  its memberships, applications, ranks (#163) and chat (#169). Players see
  no „Gilde“ (owner, 2026-11-14).
* **[E]** Existing universes start with guilds on, as before (owner,
  2026-11-14).
* **[E]** The choice is part of the audit entry of the round reset, like
  the reward checkboxes (owner, 2026-11-14).
* **[E]** While guilds are off, the server refuses every guild action with
  „Gilden sind in dieser Runde abgeschaltet.“ (owner, 2026-11-14).
* **[E]** Order: built before #169; #169 only makes the chat follow this
  switch (owner, 2026-11-14).
* **[E]** A round started with guilds on behaves as before: the guilds
  stay (issue #191, acceptance criteria).
* **[E]** Warning in the dialog: a fixed sentence below the checkbox,
  always shown, whatever the box shows (owner, 2026-11-14, O14 a).
* **[E]** „Account löschen“: the sentence about a led guild is hidden
  while guilds are off, in the box of „Hilfe & Optionen“ and in its dialog
  (owner, 2026-11-14, O14 c).
* **[E]** The push kinds „Gildenereignisse“ and „Nachrichten im
  Gilden-Chat“ are decided with #169; until then they stay shown in „Hilfe
  & Optionen“ (owner, 2026-11-14, O14 b, as recommended).
* **[E]** Decided with #169 (owner, 2026-11-15, O15 b): both kinds are
  hidden in „Hilfe & Optionen“ while guilds are off; the stored choice of
  a player stays and counts again in the next round with guilds.
* **[E]** The guild chat of #169 follows the switch: its actions
  `sendGuildChat`, `deleteGuildChat` and `seeGuildChat` are in `GUILD_ACTIONS`, the state
  has no chat while guilds are off, and the admin reads no chat then
  (owner, 2026-11-14; see [Guild chat](/features/guild-chat.md)).

# Proposals

* **[V]** The red mark for pending guild applications is not shown while
  guilds are off (issue #191); it follows from the server sending no guild
  data then.
* **[V]** The menu entry is „Gilden“ (the issue says „Gilde“, the game has
  always named the entry „Gilden“); it is hidden on a desktop and under
  „Mehr“ on a phone. An address `?view=guilds` opens the overview instead,
  as the achievements do when both rewards are off.
* **[V]** The checkbox stands in its own paragraph below the box
  „Belohnungen für die neue Runde“, so the legend of the rewards stays
  true (O14 d: stays as built, as recommended, without an owner answer).
* **[V]** The warning reads „Eine neue Runde leert alle Gilden-Chats. Ohne
  Gilden werden alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat
  gelöscht.“, in the same paragraph below the box; the box names it with
  `aria-describedby`, so a screen reader reads it with the box. #169 added
  „und Chat“ and the first sentence: every new round deletes the chats
  (#169 D6), with guilds on as well.
* **[V]** A new round without a guild choice (an older client) keeps the
  current one, as a reset without reward choices does; a choice that is
  not yes or no is refused with „Bitte auswählen, ob Gilden in der neuen
  Runde an sind.“ and changes nothing.
* **[V]** The universe settings cannot change the switch: they take only
  their own keys.
* **[V]** Turning guilds on again starts the round without the old
  guilds (they were deleted with the round that turned them off); players
  found new ones.

# Rules as built

* The switch is the integer key `roundGuilds` of the table `settings`,
  next to `round`, `roundAchievements` and `roundDaily`; a missing key
  means on, so no migration is needed (see [SQLite storage](/data/sqlite.md)).
* The single source of truth is `roundRules(ctx).guilds` in
  `src/server/game/round.ts`, with `guildsOn(ctx)` and `requireGuilds(ctx)`
  (refuses with `GUILDS_OFF`). The guild chat of #169 reads the same.
* `src/server/game/dispatch.ts` lists the guild actions in `GUILD`
  (`GUILD_ACTIONS`); `runAction` calls `requireGuilds` for them after the
  sign-in check and before the action, inside its transaction. A new guild
  action, the chat's included, goes into that list; a test fails when an
  action with „guild“ in its name is missing from it.
* `reset` takes `guilds` (`true` or `false`) besides `rewards`; the check
  is `roundError` of `src/core/round.ts` (#214), and
  `startRoundRules` stores it with the round, and `newRound` calls
  `guilds.deleteAll()` when it is off. The cascades of the schema delete
  the members, applications, ranks and rights with each guild.
* `stateFor` sends `guilds: null` while off, and `round.guilds` always.
* Client: `menu()` adds „Gilden“ only when `round.guilds`; `gameView`
  turns the guild view into the overview (the rule `guildsOn` of the view,
  #373); the Lexicanum page „Gilden“ (`rule-guilds`) is hidden by the same
  rule while guilds are off, a link to it is plain text (#404); `roundDialog` has the checkbox
  `round-guilds` with the warning `round-guilds-note`; `doReset` sends it.
  `deleteAccountBox(round)` and `deleteAccountDialog(round)` in
  `src/client/views/misc.ts` add the sentence about a led guild only when
  `round.guilds`.

# Tests

* `src/server/game/guild-switch.test.ts`: the list of guild actions is
  complete; on in an existing universe; off only at a stored 0; the
  message; a round with guilds off deletes every guild, keeps the
  accounts and puts the choice into the audit entry; a round with guilds
  on keeps them; no choice keeps the current one; a wrong choice and a
  non-admin are refused and change nothing; the universe settings cannot
  switch it; every guild action refused for every player while off, also
  with guild data present, and nothing changes; actions work again when
  on; other actions still work; no guild data in the state while off.
* `src/server/db/repos/guilds.test.ts`: `deleteAll` with its cascades.
* `src/client/views/index.test.ts`, `src/client/views/misc.test.ts`,
  `src/client/logic/menu-hints.test.ts`: no „Gilden“ in the menu and under
  „Mehr“, the checkbox preselected, the warning below it in both states
  and named as its description, the sentence about a led guild in the box
  and the dialog „Account löschen“ only with guilds, no mark for
  applications.
* `e2e/guild-switch.spec.ts`, desktop and phone, on the mail server (its
  own universe): the admin founds a guild with a member, starts a round
  with the box unchecked; for both players the guild view opens the
  overview, „Gilden“ is not in the menu, the state has no guild data and
  the server refuses founding, leaving and dissolving; the next dialog
  shows the box unchecked; a round with guilds on brings „Gilden“ back
  without the old guild. Both dialogs show the warning, which is the box's
  accessible description; the member's „Account löschen“ (box and dialog)
  names a led guild before, not while guilds are off, and again after.
  axe on the dialog (on and off), on the overview, the options and the
  deletion dialog without guilds; `e2e/a11y.spec.ts` checks the dialog on the
  main server without starting the round.
