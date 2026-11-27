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
* **[E]** Activity is the estimated active play time of
  [Own activity and play time](/features/own-activity.md) (#232, owner,
  2026-11-15; before: the gaps between click samples up to five minutes, which
  overcounted idle time). Automatic refreshes and idle tabs add no time. The
  summary covers today and the six preceding UTC days, with a separate
  most-recent interaction timestamp; the sums are those of the player's own
  view.
* **[E]** Five rejected password checks on an account within an hour or 30 game
  action requests within a minute surface a review signal for the admin.
* **[E]** Audit events and activity data start after the update and are kept for
  30 days. Audit entries omit passwords, session and invitation tokens,
  email login codes and raw request bodies. See [SQLite storage](/data/sqlite.md).

* **[E]** The player record lists the player's planets; at a planet without
  a moon the admin can „Mond anlegen“ with a chance of 1 to 20 % (since
  #433: 1 % up to the cap of the round, 210a), which only decides the
  diameter. It is an admin write in the audit log (`createMoon`
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
| Thresholds of foreign fleets, levels of the Auspex-Lehre („Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre“, „… Schiffstypen …“, „… Anzahl je Schiffstyp …“, #228) | 2 / 4 / 8 (not in version 1), [E] owner 2026-11-16 | 0 to 100, [E] owner 2026-11-18; also in the dialog „Neue Runde“ in a framed group „Fremde Flotten erkennen“, [E] owner 2026-11-17 (X1) and 2026-11-18 |
| Who may hold („Verbündete für Halten und Verband“, #55) | „Gilde und Freunde“ (3; not in version 1) [V] | a selection: „Gilde“ (1), „Freunde“ (2), „Gilde und Freunde“ (3) [V]; also in the dialog „Neue Runde“, [E] owner 2026-11-17 (X1) |
| Held fleets apart in the spy report from the spy's Auspex-Lehre („Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre“, #55) | 2 (not in version 1), [E] owner 2026-11-17 | 0 to 30 [V]; also in the dialog „Neue Runde“, [E] owner 2026-11-17 (X1) |
| Marketplace („Marktplatz“, #171): twelve live settings in one fieldset „Marktplatz“, orders 320 to 430: on (1/0), six ratios per pair, price step, drift hours, limit per day (0 = none), fee at level 1 in percent, points the fee falls per level | 1 / 500, 250, 2000, 500, 4000, 2000 [E] owner 2026-11-19 / 5 / 24 / 100,000 [V] / 10 / 1 [E] | 0 to 1, 1 to 100,000, 1 to 1,000, 0 to 720 (0: no recovery, [E] owner 2026-11-21, #346), 0 to 10,000,000, 0 to 100, 0 to 100 [V]; also in „Neue Runde“ (X1); see [Marketplace](/features/marketplace.md) |
| Refund factor of a demolition („Rückbau-Erstattung (%)“, #202) | +50 (not in version 1) | −100 to +100, [E] owner 2026-11-16; also in the dialog „Neue Runde“, [E] owner 2026-11-17 (X1) |
| Time of a demolition („Rückbau-Dauer (% der Bauzeit)“, #202) | 50 (not in version 1) | 1 to 200, [E] owner 2026-11-17; also in the dialog „Neue Runde“, [E] owner 2026-11-17 (X1) |

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
| Minimum duration of the [vacation mode](/features/vacation-mode.md), in whole hours from 1 to 720 [V] | #223 D1 | default 48 h (owner, 2026-11-18; first 24 h, 2026-11-16); built as the entry of `src/core/vacation.ts` (`roundSettings`, `order` 150) in the dialog „Neue Runde“ and, `live`, in the universe settings (X1, owner, 2026-11-17) |
| Lock of a [given-up colony's](/features/abandon-colony.md) position, in whole hours from 1 to 720 [V] | #224 D2, X1 | default 24 h (owner, 2026-11-16); built in the dialog „Neue Runde“ and, changeable during the round, in the universe settings (owner, 2026-11-17, X1) |
| Lock after a switch of the [main planet](/features/main-planet.md), in whole days from 1 to 30 [V] | #221 D3 | default 7 days (owner, 2026-11-16); built in the dialog „Neue Runde“ |
| Who may hold, join an attack union and fight with friends: guild, friends or both ([Holding and ACS](/features/holding-acs.md), [Buddy list](/features/buddy-list.md)) | #55 Q2, #225 D2, #227 D3 | [V] guild and friends, the classic rule for holding; built with #55 as „Verbündete für Halten und Verband“ (`roundAllies`) in the dialog „Neue Runde“ and the universe settings (X1) |
| Held fleets in the spy report from the spy's Auspex-Lehre („Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre“, [Holding and ACS](/features/holding-acs.md)) | #55 (owner, 2026-11-17) | 2; built as `roundHeldSpy` in „Neue Runde“ and the universe settings (X1), 0 to 30 [V] |
| Limits of an attack union ([Holding and ACS](/features/holding-acs.md)) | #225 D3 | **[E]** classic value: 16 fleets of 5 players, a delay of at most 30 % of the remaining flight time, and a cut-off „no joining in the last N minutes“ (default off, 2026-11-17); built as four entries of `roundSettings` in `src/core/union.ts` (order 200 to 230), in the dialog „Neue Runde“ and the universe settings (X1), ranges [V] 1 to 50, 1 to 20, 0 to 100, 0 to 1440 |
| Thresholds of the recognition of incoming fleets ([Espionage defense](/features/espionage-defense.md)), in whole levels from 0 to 100 [E] (owner, 2026-11-18) | #228 D1, X1 | classic value: espionage technology 2 / 4 / 8 (source [U]); built in the dialog „Neue Runde“ and, changeable during the round, in the universe settings (owner, 2026-11-17, X1) |
| Thresholds of the [activity indicators](/features/activity-indicators.md) | #229 Q1, X1 | classic value: star 15 min, „x min“ up to 59 min, „i“ after 7 days, „I“ after 28 days; built in the dialog „Neue Runde“ and, changeable during the round, in the universe settings (owner, 2026-11-17, X1) |
| Extra places, stay per level and the universe speed for the stay of [expeditions](/features/expeditions.md) („Zusätzliche Expeditionsplätze“, „Haltezeit in Stunden je Stufe“, „Haltezeit durch das Universums-Tempo teilen“) | #93 Q3 | **[E]** (owner, 2026-11-19): classic values are the default, 0 extra places and 1 hour per level, the stay in real hours; **[V]** ranges 0 to 10 and 1 to 24, the speed as a choice Nein / Ja (default Nein); built as `roundSettings` in `src/core/expedition.ts` (orders 300, 310, 315, one fieldset „Expeditionen“), in the dialog „Neue Runde“ and the universe settings (X1) |
| Planet limit per player and the colony research („Maximale Planeten ohne Forschung“, „Kolonieforschung aktivieren“, „Zusätzliche Planeten je Forschungsstufe“, „Maximale Forschungsstufe“, [Colonization](/features/colonization.md#planet-limit-per-player-237)) | #237 D1 to D6 | **[E]** (owner, 2026-11-17): per round, editable during the round; base 0 = unlimited, at most 20 planets in total. **[V]** default: no limit, research off, +2 per level, highest level 4; ranges 0 to 20, 1 to 20 and 0 to 20; one fieldset „Planetengrenze“, orders 440 to 470 in `src/core/colony-limit.ts`, in the dialog „Neue Runde“ and the universe settings (X1); the research switch is refused with a base of 0 through the entry rule `agrees` |
| Refund factor of a [demolition](/features/demolition.md), −100 % to +100 % („Rückbau-Erstattung (%)“) | #202 D4, D7 | +50 % [E]; built as the first entry of `roundSettings` in `src/core/demolition.ts` (order 180), in the dialog „Neue Runde“ and the universe settings (X1) |
| Demolition time as a share of the build time, 1 to 200 % („Rückbau-Dauer (% der Bauzeit)“, [Demolition](/features/demolition.md)) | #202 D3 | 50 % [E]; built as the second entry of `roundSettings` in `src/core/demolition.ts` (order 190), in the dialog „Neue Runde“ and the universe settings (X1) |
| Cap of the [moon](/features/moons.md) chance and resources per percent („Mondchance höchstens (%)“, „Rohstoffe je 1 % Mondchance“ [V]) | #433 207b, 208a, 212a | **[E]** (owner, 2026-11-27): cap 20 % from 1 to 100, 100,000 from 10,000 to 1,000,000 in steps of 10,000, as before; built as `roundSettings` in `src/core/moon.ts` (orders 510, 520, section „Monde“ [V]), live, in the dialog „Neue Runde“ and the universe settings |

* **[E]** Each of these is set by the admin per round (owner, 2026-11-16).
  The classic defaults are decided where the table says „classic value“,
  with the sources in the linked files.
* **[E]** The values per round are set in the dialog „Neue Runde“ and stay
  editable in the admin panel during the round (owner, 2026-11-17, X1).
  **[V]** Built with #55 on the registry of #283 (below): each of its two
  values is an entry with `live: true`, so it is a row of `UNIVERSE_SPECS`
  under the key the round stores it, and the tab „Universum“ changes it
  live; a setting with named choices (`choices`) shows a selection there
  instead of a number.

## The settings under headings, in groups that fold (#357)

* **[E]** Owner, 2026-11-22: the settings stand under headings by feature,
  as the code groups them, plus one group for the base values; the groups
  fold and unfold and are open at the start; release 26.11.25.
* **[V]** The same structure in „Neue Runde“ and in the tab „Universum“ (told
  to the owner, no objection): the same headings in the same order. „Neue
  Runde“ shows every feature; „Universum“ shows the base values first and
  then each feature with a live setting.
* **[V]** The heading comes from the registry: each file with `roundSettings`
  exports `roundHeading`, and `scripts/gen-features.ts` lists them as
  `ROUND_SECTIONS` in `round-settings.gen.ts`, so a new feature gets its group
  without a change of the views (`ROUND_SECTIONS` of `src/core/round.ts`,
  `universeSections` of `src/core/universe.ts`). The headings are the names
  the game already uses (the menu, the Lexicanum, the changelog, a legend of
  „Neue Runde“); **[E]** the owner approved all fourteen (2026-11-22):

  | Feature file | Heading | Source |
  | --- | --- | --- |
  | (base values) | Universum | the name of the tab |
  | achievements | Tagesbelohnung und Erfolge | the Lexicanum page |
  | guild-chat | Gilden | the menu, the Lexicanum, the changelog |
  | main-planet | Hauptplanet | the changelog, the box of „Optionen“; a row of „Universum“ too since #366 (2026-11-22) |
  | abandon | Kolonie aufgeben | the changelog |
  | activity | Aktivität | the labels of its settings; the Lexicanum page „Sichtbarkeit und Aktivität“ |
  | holding | Wache stellen | the changelog |
  | fleet-recognition | Fremde Flotten erkennen | the legend of its group in „Neue Runde“ (owner, 2026-11-18) |
  | vacation | Urlaubsmodus | the Lexicanum, the changelog |
  | demolition | Zurückbauen | the changelog |
  | union | Verbandsangriff | the changelog |
  | expedition | Expeditionen | the Lexicanum, the changelog |
  | market | Marktplatz | the menu, the Lexicanum, the changelog |
  | colony-limit | Planetengrenze | the changelog |

* **[V]** A group is a `<details class="settings-group">` with the heading
  in its `<summary>` (keyboard and screen reader by the browser); the admin's
  choice of folded groups lives in `logic/admin-groups.svelte.ts`, as a
  fresh render mounts the page „Admin“ anew (#361). A folded group keeps its
  fields in the page, so saving sends every value as before. A value that
  the server will refuse (the same checks, `roundRefused` and
  `universeErrors`) unfolds its group, is marked `aria-invalid` and takes the
  focus; the server still words the refusal. In „Neue Runde“ the dialog then
  stays open. That a size of the universe lies below a planet only the server
  can tell; that refusal unfolds nothing.
* **[E]** Owner, 2026-11-22: a legend of „Neue Runde“ that repeats the
  heading of its group is not shown. **[V]** The fieldset stays (it frames
  the members and their preview) and is named by the heading
  (`aria-labelledby` on the `<h4>` of its group, `rowSections` of
  `client/logic/admin.ts`); the registry keeps the legend, which groups the
  fields. That are the legends „Aktivität“, „Fremde Flotten erkennen“,
  „Expeditionen“, „Marktplatz“ and „Planetengrenze“ („Aktivität“ was not in
  the owner's list of four but repeats its heading, so the rule covers it
  [V]); „Belohnungen für die neue Runde“ (heading „Tagesbelohnung und
  Erfolge“) and „Rückbau“ (heading „Zurückbauen“) stay.

## The registry of the round settings (#283)

* **[V]** Built with #283, a refactor without a visible change: every
  setting of a round is one entry of the registry `ROUND_SETTINGS` in
  `src/core/round.ts`. The dialog „Neue Runde“ (`roundDialog`), the
  universe settings (`UNIVERSE_SPECS`), the request „reset“
  (`src/client/round-actions.ts`), the reset action and `roundRules()`
  (`src/server/game/round.ts`) all read it. On main it holds the reward
  options „Achievements aktivieren“ and „Tagesbelohnungen aktivieren“ (one
  group `rewards`, one fieldset), the switch „Gilden (mit Chat)“, the lock
  of the main planet and the lock of a given-up position (#224); their
  texts, ranges, defaults, refusals and order are those of before.
* **[V]** #229 added the four thresholds of the
  [activity indicators](/features/activity-indicators.md#settings) as
  entries of `src/core/activity.ts`: one group `activity` with the legend
  „Aktivität“ (owner, 2026-11-18), so they stand in one fieldset of the
  dialog, are sent as one object and every wrong one is refused at once
  with the range wording; all four are `live`.
* **[V]** Added with #55, in the pattern of #310, in
  `src/core/holding.ts` (`roundSettings`): „Verbündete für Halten und Verband“ (key
  `roundAllies`, name `allies`, order 100, the choices „Gilde“ 1, „Freunde“
  2 and „Gilde und Freunde“ 3, default 3, refusal „Bitte auswählen, wer in
  der neuen Runde halten darf.“) and „Gehaltene Flotten im Auspex-Bericht
  ab Auspex-Lehre“ (key `roundHeldSpy`, name `heldSpy`, order 110, 0 to 30,
  default 2, refusal „Bitte für „Gehaltene Flotten im Auspex-Bericht ab
  Auspex-Lehre“ eine ganze Zahl von 0 bis 30 angeben.“). Both are `live`
  (X1): the admin sets them in „Neue Runde“ and changes them during the
  round in the universe settings, where a wrong value gets the wording of
  the universe settings. They are no group: two fields without a fieldset.
* **[E]** The registry keeps a fixed order, so #283 changes nothing
  visible (owner, 2026-11-17): every entry has an explicit number `order`,
  like the catalog entries, and the dialog „Neue Runde“ and the order of
  the refusals follow it. The order is that of main before #283: the
  reward options (10, 20), the guild switch (30), the lock of the main
  planet (40), the lock of a given-up position (50, last). A new feature
  appends at the end with its own number: the thresholds of the activity
  markers (#229) took 60, 70, 80 and 90, and #55 took 100 (who may hold) and 110 (the level
  of the spy report).
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
  universe settings, followed by the two settings of #55; the other four
  entries are not live.
* **[V]** Added with #228 in the pattern of #310: the three thresholds of
  the recognition of foreign fleets
  ([Espionage defense](/features/espionage-defense.md)) are the entries of
  `src/core/fleet-recognition.ts`, with the orders 120, 130 and 140 (60 to
  90 are the activity markers of #229, 100 and 110 are left to #55), so they
  stand after them in the dialog „Neue Runde“ and, being live, after the
  activity rows in the universe settings. They are one group `recognition`
  with the legend „Fremde Flotten erkennen“ ([E] owner, 2026-11-18): three
  number fields from 0 to 100 ([E], 2026-11-18) in one fieldset with the
  defaults 2, 4 and 8, sent as one object and refused together with the
  range wording.
* **[V]** Added with #223 in the pattern of #310: the minimum duration of
  the vacation mode ([Vacation mode](/features/vacation-mode.md)) is the
  entry of `src/core/vacation.ts` with the order 150 (`roundVacationHours`,
  1 to 720, default 48, its own refusal text). It is live too and comes after
  the recognition rows in the dialog „Neue Runde“ and in the universe
  settings.
* **[V]** Added with #202 in the pattern of #310: the refund factor and the
  time of a [demolition](/features/demolition.md) are the two entries of
  `src/core/demolition.ts` (`roundSettings`), with the orders 180
  („Rückbau-Erstattung (%)“, −100 to 100, default 50) and 190
  („Rückbau-Dauer (% der Bauzeit)“, 1 to 200, default 50), both `live`. They are one group `demolition` with the
  legend „Rückbau“ (owner, 2026-11-18): one fieldset in the dialog „Neue
  Runde“, sent as one object and refused together with the range wording;
  as `live` entries they are also rows of the universe settings, after the
  rows of the recognition.
* **[V]** With the groups of #229 and #228 the dialog „Neue Runde“ is
  taller than a window of 720 px, so every dialog (`#modal .in` in
  `src/client/static/style.css`) is at most as high as the window and
  scrolls inside itself; before, its buttons lay outside the window.
* **[V]** A feature registers its settings itself (#310; the owner asked
  for a design pattern against the conflicts of parallel feature branches,
  2026-11-18). It defines its entries in its own file of `src/core` and
  exports them under one fixed name:
  `export const roundSettings = [ { … } ] as const satisfies readonly RoundSetting[];`.
  Nothing else is edited: `scripts/gen-features.ts` lists every file of
  `src/core` with this export in `src/core/round-settings.gen.ts`
  (`ROUND_ENTRIES`, not checked in, like the feature index; every `pnpm`
  script that builds, checks or tests runs the generator first), and
  `src/core/round.ts` builds `ROUND_SETTINGS` from that list and names no
  feature. `RoundRules` gets the typed value from the entry by itself. The
  feature picks its `order` number as the next free ten above the highest
  number of the registry, so it stands last in the dialog and among the
  refusals; the members of a group take neighbouring numbers and share one
  group object. The field id is `round-` and the name in kebab case
  (`mainLock` is `round-main-lock`). Where an entry lives is the feature's
  choice: the reward options in `src/core/achievements.ts`, the guild switch
  in `src/core/guild-chat.ts`, the lock of the main planet in
  `src/core/main-planet.ts`, the lock of a given-up position in
  `src/core/abandon.ts`, the activity thresholds in `src/core/activity.ts`,
  who may hold and the level of the spy report in `src/core/holding.ts`, the
  thresholds of the recognition of foreign fleets in
  `src/core/fleet-recognition.ts`.
* **[V]** The marketplace (#171) is the first group of live numbers with a
  legend of its own „Marktplatz“: twelve entries in `src/core/market.ts`, orders
  320 to 430. Its switch is a number 1 or 0 with `choices` „Ja“ and „Nein“,
  because a switch of the registry cannot be `live`. The universe settings
  warn below the table when the six ratios allow a round trip that gains
  (`gainWarning`, `client/logic/market.ts`).
* **[V]** The tests follow the same split (#310). One test,
  `src/core/round-registry.test.ts`, checks the rules for all entries and
  names no feature and no count: unique keys, names and field ids, unique
  `order` numbers in ascending order (a number used twice by two parallel
  features is seen after the merge, and the later one takes the next ten),
  the members of a group together with one legend or none, a default and
  every choice in the range, and every `live` entry a row of the universe
  settings. Every feature tests its own entries in its own test, selected
  from `ROUND_SETTINGS` by key or group (label, range, default, order,
  legend, refusal, `live`, field id), and no test lists another feature's
  settings, counts all fieldsets or rows, or picks one by position. A test
  that needs a full set of round values takes it from `roundDefaults()`
  (`src/test/fixtures.ts`) and names the values of its own feature on top.

## Presets of the round settings and the marks (#441)

* **[E]** The mechanism first, the values later (owner, 2026-11-27, 234):
  one preset „Standard“, today's defaults. „Klassisch“, „Schnelles Spiel“,
  „Alle Funktionen an“ and others follow with the owner's values; no preset
  value is invented. The preset „Klassisch“ will set every switch of a
  feature that is not classic to „Aus“
  ([A switch for every feature](/ops/feature-switches.md)).
* **[E]** The place (237a): the row of the presets stands in the dialog
  „Neue Runde“ and in the tab „Universum“. Under „Universum“ a preset
  changes only the `live` settings; the base values of the universe and the
  other settings stay.
* **[E]** The flow: a click on a preset asks first, „Sollen die
  Einstellungen auf das Regelset „{Preset}“ umgestellt werden? Achtung:
  Erst „Speichern“ unten übernimmt die Änderung.“, with „Umstellen“ and
  „Abbrechen“. „Umstellen“ fills the fields and saves nothing, „Abbrechen“
  changes nothing; only the save below applies the values („Ja, neue
  Runde“, „Einstellungen speichern“). A save is audited as before, with the
  values before and after; a click on a preset writes nothing.
* **[E]** A mark per setting, „klassisch“ or „neu“ (235b); the topic groups
  stay. The marks of the entries follow once the owner confirms the list
  (proposed on 2026-11-27); until then no entry has one and nothing is shown.
* **[V]** Built:
  * The registry entry has an optional `mark` (`classic` or `new`, shown as
    „klassisch“ or „neu“, `MARK_LABELS`) and optional `presets` values by
    the id of a preset, both in the feature's own `roundSettings`; there is
    no shared list of settings. „Standard“ is the `def` of every entry
    (`presetValue`, `presetValues` in `src/core/round.ts`). Only the ids and
    names of the presets are one list, `PRESETS`. A test refuses a preset
    without a value for an entry.
  * The row „Regelset“ (`views/PresetRow.svelte`, the heading [V]) has a
    button per preset; the question stands in place, below the buttons, as
    the dialog „Neue Runde“ is itself in the modal, and stays open over a
    redraw (`logic/presets.svelte.ts`). `features/presets.ts` fills the
    fields: in „Neue Runde“ every field by its id, in „Universum“ the rows
    of the live settings; each field reports its change like a typed one,
    so the dialog writes its lines again and the universe settings keep the
    draft (`logic/settings-draft.ts`).
  * The mark is a small grey tag after the label (`.mark`, the look is a
    placeholder [V] until the owner decides).
  * Open for the owner after the release: the heading „Regelset“, the look
    of the mark, and the list of the marks. The base values of the universe
    get no mark for now (registry only, [V]).

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
* **[V]** What the admin typed into the settings of the tab „Universum“ and
  has not saved survives a redraw of the page (the list of the round archive
  of #235 draws the admin page again once it has been read, and so does every
  new state), until the settings are saved; a refused save keeps it. Before,
  the fields showed the server's values after every redraw, so a draft was
  lost without a message and a save then sent the old values (found by the
  full E2E run of 2026-11-19: „Zusatzfelder pro Planet“ and „Marktplatz“, on
  a slower machine than the one the specs were written on). The client
  remembers the edits (`logic/settings-draft.ts`, `features/admin.ts`) and
  puts them back after the redraw; a field set back to the server's value is
  no draft, so a later change of the server shows.
