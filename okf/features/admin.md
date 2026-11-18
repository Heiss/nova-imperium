---
type: Specification
title: Admin
description: Admin roles, moderation, diagnostic reads, audit events and universe settings.
tags: [admin, audit, activity, moderation, settings, universe]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Decisions

* **[E]** Admins are made with the operator command on the server
  (`docker compose exec app nova admin <name>`), never through the web. The
  rule of version 1 (the first registered player becomes admin) is gone.
* **[E]** The universe values are set in the admin panel, not in `.env`.
* **[E]** Changes apply live. The size of the universe (galaxies, systems,
  positions) only grows: it never shrinks below a coordinate where a planet
  lies.
* **[E]** The admin starts a new round as in version 1: every player keeps the
  account and gets a fresh planet; research, fleets and reports are cleared.

# Diagnostics and moderation

* **[E]** The admin panel provides a chronological event log of account actions,
  game actions, battles and admin operations. Filters cover the actor or
  affected player, time range, action, outcome, request ID and planet or fleet
  reference. The request ID links an unexpected API failure to the server log.
* **[E]** The player record combines the timeline, daily activity and actions
  with the player's stored building, research, shipyard and fleet orders.
  Orders expose scheduled times and due status. A due record can reflect lazy
  settlement of game state.
* **[E]** The details of an event offer „Ereignisse zu <id>“ for each planet
  and fleet reference of the event (`planet` and `fleet` of its detail). The
  button fills the filter „Planet / Flotte“ and shows the event log filtered
  by that reference, which matches `planet`, `fleet` and `origin` of an
  event's detail. So it works after the event too, when the order is long
  gone. The event log offers no „Aufträge zu …“ buttons; the tab „Aufträge“
  keeps its own reference buttons (owner, 2026-11-13, #151).
* **[E]** `origin` (the start planet of a fleet order) gets no button of
  its own; only planet and fleet do (owner, 2026-11-13, #151).
* **[E]** The button keeps the other filters of the event log, as the
  reference buttons of the tab „Aufträge“ do (owner, 2026-11-13, #151).
* **[E]** A change of the admin panel only gets no changelog fragment
  (label `kein-changelog`) (owner, 2026-11-13, #151).
* **[E]** The audit log records administrative reads of invitations, player
  records, activity statistics, orders and the audit log itself. Entries
  identify the admin, the dataset, any target or filter scope, the time and
  the outcome. Operator commands are attributed to the server operator.
* **[E]** Admins can read every guild chat; each time an admin opens one,
  the audit log records it (owner, 2026-11-14, #169 D8). Built as the
  admin read `guildChat` (`POST /api/admin/guild-chat`) with the guild in
  its detail, from a button „Chat lesen“ on every guild page [V] (see
  [Guild chat](/features/guild-chat.md)).
* **[E]** Admin writes include invitation changes, universe settings, round
  resets and moderation. Settings and operator role changes record before and
  after values. Moderation records the affected player, reason, previous and
  resulting suspension state and number of sessions revoked.
* **[E]** The „Endzeit“ of #161 is an admin write too, once per round; its
  entry holds the round, the flight time in minutes, the number of
  recipients and the arrival (see [Endzeit](/features/endzeit.md)).
* **[E]** An admin can end a player's sessions, suspend an account for 1 to 720
  hours or indefinitely, and lift a suspension. Session revocation also
  invalidates pending email login codes. Accounts with admin rights are managed
  by the server operator. Suspensions block sign-in and API access.
* **[E]** Activity is estimated from interactions in the visible client. Only
  intervals between samples at most five minutes apart count. Automatic
  refreshes and idle tabs add no samples. The summary covers today and the
  six preceding UTC days, with a separate most-recent interaction timestamp.
* **[E]** Five rejected password checks on an account within an hour or 30 game
  action requests within a minute surface a review signal for the admin.
* **[E]** Audit events and activity data start after the update and are kept for
  30 days. Audit entries omit passwords, session and invitation tokens,
  email login codes and raw request bodies. See [SQLite storage](/data/sqlite.md).

* **[E]** The player record lists the player's planets; at a planet without
  a moon the admin can „Mond anlegen“ with a chance of 1 to 20 %, which only
  decides the diameter. It is an admin write in the audit log (`createMoon`
  with the planet, the moon, the chance and the diameter) (owner,
  2026-11-14, #53, see [Moons](/features/moons.md)).

# Settings and ranges (proposals)

| Setting | Default (version 1) | Range |
|---|---|---|
| Speed | 5 | 1 to 100 |
| Galaxies | 2 | 1 to 9, grow only |
| Systems per galaxy | 50 | 1 to 499, grow only |
| Positions per system | 15 | 12 to 20, grow only (a new planet is placed on 4 to 12) |
| Base storage per resource | 100,000 | 10,000 to 10,000,000 |
| Reports per player | 60 | 10 to 500 |
| Start metal / crystal / deuterium | 500 / 500 / 0 | 0 to 10,000,000 |
| Extra fields per planet („Zusatzfelder pro Planet“, #51) | 0 (not in version 1) | 0 to 100, [E] owner 2026-11-13 |
| Flight time of the „Endzeit“ gift in minutes („Flugzeit der Endzeit-Gabe (Minuten)“, #161) | 240 (not in version 1) | 1 to 4,320 (72 h), [E] owner 2026-11-14 |
| Lock of a given-up colony's position in hours („Sperre einer aufgegebenen Position (Stunden)“, #224) | 24 (not in version 1), [E] owner 2026-11-16 | 1 to 720 [V]; also in the dialog „Neue Runde“, [E] owner 2026-11-17 (X1) |
| Activity without the minutes („Aktivität ohne Minutenangabe (Minuten)“, #229) | 15 (not in version 1), [E] owner 2026-11-16 | 1 to 60 [V]; also in the dialog „Neue Runde“, [E] owner 2026-11-17 (X1) |
| Activity with the minutes up to („Aktivität mit Minutenangabe bis (Minuten)“, #229) | 59 (not in version 1), [E] owner 2026-11-16 | 1 to 1,440 [V]; also in „Neue Runde“ (X1) |
| Inactive from („Inaktiv ab (Tage)“, #229) | 7 (not in version 1), [E] owner 2026-11-16 | 1 to 365 [V]; also in „Neue Runde“ (X1) |
| Long inactive from („Lange inaktiv ab (Tage)“, #229) | 28 (not in version 1), [E] owner 2026-11-16 | 1 to 365 [V]; also in „Neue Runde“ (X1) |

* **[V]** The ranges above are proposals; the source is
  `src/core/universe.ts`.
* **[V]** Before new values are saved, every planet is settled to now with
  the old values, so the time before the change keeps the old speed. Running
  buildings, research, shipyard units and flights keep their end time.
* **[V]** All values are checked together and every error is shown at once;
  nothing is saved if one value is wrong.
* **[V]** Operator commands besides `admin`: `unadmin`, `admins`, `invite`.

# Settings per round from the Classic features (#222)

The owner's answers of 2026-11-16 put these rules into the admin panel, one
value per round. Where in the panel (the dialog „Neue Runde“ or the
universe settings) and their ranges are not decided yet.

| Setting | Issue | Default |
|---|---|---|
| Minimum duration of the [vacation mode](/features/vacation-mode.md), in whole hours from 1 to 720 [V] | #223 D1 | default 24 h (owner, 2026-11-16); built as the registry entry `VACATION_SETTING` (`order` 150) in the dialog „Neue Runde“ and, `live`, in the universe settings (X1, owner, 2026-11-17) |
| Lock of a [given-up colony's](/features/abandon-colony.md) position, in whole hours from 1 to 720 [V] | #224 D2, X1 | default 24 h (owner, 2026-11-16); built in the dialog „Neue Runde“ and, changeable during the round, in the universe settings (owner, 2026-11-17, X1) |
| Lock after a switch of the [main planet](/features/main-planet.md), in whole days from 1 to 30 [V] | #221 D3 | default 7 days (owner, 2026-11-16); built in the dialog „Neue Runde“ |
| Who may hold, join an attack union and fight with friends: guild, friends or both ([Holding and ACS](/features/holding-acs.md), [Buddy list](/features/buddy-list.md)) | #55 Q2, #225 D2, #227 D3 | [V] guild and friends, the classic rule for holding |
| Limits of an attack union ([Holding and ACS](/features/holding-acs.md)) | #225 D3 | classic value: 16 fleets of 5 players, a delay of at most 30 % of the remaining flight time; join window [U] |
| Thresholds of the recognition of incoming fleets ([Espionage defense](/features/espionage-defense.md)) | #228 D1 | classic value: espionage technology 2 / 4 / 8 (source [U]) |
| Thresholds of the [activity indicators](/features/activity-indicators.md) | #229 Q1, X1 | classic value: star 15 min, „x min“ up to 59 min, „i“ after 7 days, „I“ after 28 days; built in the dialog „Neue Runde“ and, changeable during the round, in the universe settings (owner, 2026-11-17, X1) |
| Slots and holding time of [expeditions](/features/expeditions.md) | #93 Q3 | classic value: ⌊√level⌋ slots, at most level hours |
| Refund factor of a [demolition](/features/demolition.md), −100 % to +100 % | #202 D4, D7 | +50 % [E] |
| Demolition time as a share of the build time ([Demolition](/features/demolition.md)) | #202 D3 | 50 % [E] |

* **[E]** Each of these is set by the admin per round (owner, 2026-11-16).
  The classic defaults are decided where the table says „classic value“,
  with the sources in the linked files.

## The registry of the round settings (#283)

* **[V]** Built with #283, a refactor without a visible change: every
  setting of a round is one entry of the registry `ROUND_SETTINGS` in
  `src/core/round.ts`. The dialog „Neue Runde“ (`roundDialog`), the
  universe settings (`UNIVERSE_SPECS`), the request „reset“
  (`src/client/round-actions.ts`), the reset action and `roundRules()`
  (`src/server/game/round.ts`) all read it. On main it holds the reward
  options „Achievements aktivieren“ and „Tagesbelohnungen aktivieren“ (one
  group `rewards`, one fieldset), the switch „Gilden (mit Chat)“, the lock
  of the main planet and the lock of a given-up position (#224,
  `ABANDON_LOCK_SETTING` in `src/core/abandon.ts`); their texts, ranges,
  defaults, refusals and order are those of before.
* **[V]** #229 added the four thresholds of the
  [activity indicators](/features/activity-indicators.md#settings) as
  entries of `src/core/activity.ts` (`ACTIVITY_RECENT_SETTING`,
  `ACTIVITY_MINUTES_SETTING`, `INACTIVE_DAYS_SETTING`,
  `LONG_INACTIVE_DAYS_SETTING`): one group `activity` with the legend
  „Aktivität“ (owner, 2026-11-18), so they stand in one fieldset of the
  dialog, are sent as one object and every wrong one is refused at once
  with the range wording; all four are `live`.
* **[E]** The registry keeps a fixed order, so #283 changes nothing
  visible (owner, 2026-11-17): every entry has an explicit number `order`,
  like the catalog entries, and the dialog „Neue Runde“ and the order of
  the refusals follow it. The order is that of main before #283: the
  reward options (10, 20), the guild switch (30), the lock of the main
  planet (40), the lock of a given-up position (50, last). A new feature
  appends at the end with its own number: the thresholds of the activity
  markers (#229) took 60, 70, 80 and 90.
* **[V]** An entry has its stored `key` (`round…`), its `name` in
  `RoundRules` and in the request, its German `label`, and is either a
  switch (`kind: 'switch'`, default yes or no, a `refusal`, an optional
  `note` below the checkbox) or a whole number (`kind: 'number'`, `min`,
  `max`, `def`, optional `choices` shown as a selection, optional
  `refusal`; without one the server refuses with the wording of the
  universe settings, `rangeError`: „<label>: ganze Zahl von <min> bis
  <max>.“). Entries with one `group` are sent as one object and refused
  together. A value the admin does not send keeps the current one; a
  missing setting is the default; nothing is stored when one value is
  refused, and the first refused entry (or group) in the order of the
  registry is named.
* **[V]** `live: true` makes a number entry also a row of the universe
  settings under the same key, changed during the round and checked there
  like the other settings (X1, owner, 2026-11-17). The lock of a given-up
  position (#224) and, after it, the four thresholds of the activity
  markers (#229) are the live settings of main, the last rows of the
  universe settings; the other four entries are not live. The minimum
  duration of the vacation mode (#223, `VACATION_SETTING` in
  `src/core/vacation.ts`, `order` 150) is live too and comes after them.
* **[V]** A feature with a value per round adds one entry in its own file
  (`export const X_SETTING = { … } as const satisfies RoundSetting`) and
  one line to the list `ENTRIES` in `src/core/round.ts`, where the place
  of the line means nothing; `RoundRules` gets the typed value from the
  entry by itself. The feature picks its `order` number as the next free
  ten above the highest number of the registry (100 after the 90 of main),
  so it stands last in the dialog and among the refusals; the members of
  a group take neighbouring numbers. A test refuses a number used twice,
  so two parallel features that picked the same one see it after the
  merge, and the later one takes the next ten. The field id is `round-`
  and the name in kebab case (`mainLock` is `round-main-lock`).

# Round rewards and menu hints

* **[E]** Starting a new round offers independent checkboxes for achievements
  and daily rewards. The dialog preselects the current round's settings.
  Existing universes start with both enabled. The selections apply to the
  new round and are included in the round-reset audit entry.
* **[E]** The dialog „Neue Runde“ also has one checkbox „Gilden (mit
  Chat)“ for guilds and the guild chat (#169), preselected with the current
  round and changed only there. A round with guilds off deletes every guild
  with its memberships, applications, ranks and chat; the menu shows no
  guilds and the server refuses every guild action with „Gilden sind in
  dieser Runde abgeschaltet.“. Existing universes start with guilds on; the
  choice is part of the round-reset audit entry (owner, 2026-11-14, #191,
  see [Guilds on or off per round](/features/guild-switch.md)).
* **[E]** Starting a round clears achievement progress, claimed achievements
  and daily streaks. Disabled reward types neither collect progress nor accept
  claims. The player menu shows only the enabled reward types.
* **[E]** The daily reward scales with the day of the round (owner,
  2026-11-16, #220, „Geklärt“): the median hourly production of all players
  times a number of minutes. Per player the hourly production of all their
  planets is added up for each resource, as they produce now (the rate of the
  resource bar); then the median of those sums over the players is taken, for
  each resource. The minutes are round(30 + 60 · ln(d) / ln(30)) on day d = 1
  to 30 of the round and 90 from then on: 30, 42, 49, 54, 58, 62, 64 … 89, 90.
  It is computed at the time of the claim and credited on the home planet,
  above the storage too (no cap, as before). Achievements keep their fixed
  rewards.
* **[E]** The streak stays, but only as a display: a missed UTC day starts
  the shown „Anmeldeserie“ at 1 again and does not change the reward (#220
  D3).
* **[V]** Taken as recommended when building #220: rounding to the nearest
  whole minute (the owner's list named 61 for day 6, which is the value cut
  off, not rounded; 61.608 rounds to 62); the reward in whole resources
  rounded down and never below 0 (a median Promethium production can be
  negative); „all players“ are the accounts that own a planet or moon (an
  account without one produces nothing in the round; there is no activity
  rule yet, #229); the median of an
  even count is the mean of the two middle values; the day of the round
  changes at 00:00 UTC like the streak and the claim, and a time before the
  start counts as day 1; the view shows the day of the round with its
  minutes, today's reward and tomorrow's at the same production.
* **[V]** The start of the round is the setting `roundStart` (#220): every
  new round sets it to its start. The migration `20261116T2137-round-start`
  gives a running round the creation time of its first planet (a new round
  places every home planet at its start, so this is the start of the round),
  and a universe without a planet the time of the migration.
* **[E]** A red exclamation mark in the player menu identifies new messages,
  available rewards, incoming fleets or pending guild applications. In the
  current browser session it also marks detected building upgrades, research,
  completed ship or defense orders and returned fleets. Opening the relevant
  view clears its completion mark. Live indicators reflect the current state.

# Admin tabs and announcements

* **[E]** The admin opens separate tabs for the event log, players, orders,
  invitations, universe settings and server announcements. Diagnostic queries
  run for the active tab.
* **[E]** The event log opens on the latest 10 matching entries. It offers
  10, 25, 50 or 100 entries per page, with first, previous, next and last
  controls. Paging excludes new events recorded after the current search began.
* **[E]** The tab „Fehler“ lists server errors, browser errors and problem
  reports with the paging of the event log, and downloads them with the
  audit log as a ZIP; both are admin reads in the audit log (issue #126, see
  [Error log and problem reports](/features/error-log.md)).
* **[E]** An administrator can send a plain-text announcement of up to 500
  characters. It is stored in each current player's inbox. Subscribed devices
  receive the text via Web Push when enabled for the instance. The audit log
  records the sender and the recipient count.
