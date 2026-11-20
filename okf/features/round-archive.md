---
type: feature
title: Round archive, reports and history
description: The archive of an ended round, written when the round is closed in the same transaction as the reset; the report of one archived round, the history across rounds and the plan for the Runden-Rewind (issue #235).
---

# Round archive

Issue #235 of the Classic epic (#222), built in slices in the fast-build mode
of 2026-11-19 (branch `claude/round-archive`). The issue is long; its binding
part is the owner's „Event-data audit and binding architecture revision“
(2026-11-16) and the „Geklärt“ comment of 2026-11-17. The views A to H of the
issue are the design; a slice is listed under „Built“ only when it is
complete, tested and pushed.

# Decisions

* **[E]** The statistics come from stored events: no separately stored
  statistics, daily chart snapshots, metric counters, round-total or
  playtime-total tables or saved report-number JSON (owner, 2026-11-16, issue
  „binding architecture revision“; D3 of 2026-11-17: daily points derived on
  read, no stored snapshots).
* **[E]** D1: an explicit „Runde abschließen“ for the admin, and „Neue Runde“
  closes the old round automatically, so no data is lost (2026-11-17). The
  „Endzeit“ alone does not close or publish a round (issue, access
  contract).
* **[E]** Access: a player opens only a finished round they took part in, the
  admin every round, the running one as a provisional report that is never
  published; the check is made on the server on every request (issue,
  section 1).
* **[E]** D2: the report shares everything, playtime and activity curves
  included, but only in the archive after the round ended; during the round
  they stay private (#231 unchanged) (2026-11-17).
* **[E]** D4: a deleted account is pseudonymised in archives („Gelöschter
  Spieler“ as an example); the numbers stay (2026-11-17).
* **[E]** Lifetime: an archive stays until the admin deletes that round;
  #231 and #232 tie their retention to this (2026-11-17).
* **[E]** An incomplete event archive prevents the destructive reset; the
  close records `round.closed` only when the history is complete (issue,
  section 2: **[V]** in the text, but the acceptance criterion „incomplete
  source history blocks destructive reset“ is binding).
* **[E]** A round that runs when the archive ships is marked as partly
  covered, nothing is invented backwards (issue, section 2, mid-round
  rollout).

# Proposals

* **[V]** A failed archive refuses the reset with an error and the
  transaction rolls back, so the round, the planets and the rules stay as they
  were; the admin can retry (the brief of the fast-build mode and the issue
  agree).
* **[V]** „Runde abschließen“ freezes the facts at the cutoff, but the game
  goes on until „Neue Runde“: nothing is locked, the cutoff is the server time
  of the request after the due fleets were settled (`tick`). Whether a closed
  round should also stop the game is not decided.
* **[V]** A participant is an account with at least one planet or moon at the
  cutoff. A seat (1, 2, …) is the only reference an event makes to a
  participant; no name or account id is in an event.
* **[V]** What the close writes as events: `player.final` per participant
  (the raw state at the cutoff: levels of buildings, ships and defense per
  place, research, flying ships, and the valuation „points by the categories
  of #78 and production per hour under the rules in force“), `guild.final` per
  guild (tag, name, member seats), `round.closed` (cutoff and number of
  participants, no totals). `round.started` is written when a new round opens.
  The valuation is a fact recorded with the raw state so that a later change of
  the catalog does not change a past ranking („persist … valuations“, issue);
  it is not a second store of statistics: every table and curve of the report
  is read from the events.
* **[V]** The valuation is read once at the cutoff: no curve exists before
  the in-round events below are written.
* **[V]** The pseudonym is „Gelöschter Spieler“, set by a trigger on the
  deletion of an account, so every way of deleting an account cuts the link.
  A guild tag and name stay in the archive (a guild is no person).
* **[V]** Player access to the running round is the lock line „Nach
  Rundenende verfügbar“ with no data; a round a reader may not open answers
  like a round that does not exist.
* **[V]** Bounds: the list shows the newest 100 rounds, the history the newest
  50.

# Tables (migration `20261120T0900-round-archive`)

* `rounds(number PK, status 'active'|'closed', started, closed, coverage
  'complete'|'partial', rules JSON, events)`: identity and lifecycle. `rules`
  is the rules of the round (`roundRules`); `events` the number of events the
  close expects. The running round at the migration gets its row with the
  coverage `partial`.
* `round_participants(round, seat, player NULL, name)`: the account that
  played; `player` is cut and `name` becomes the pseudonym when the account is
  deleted (trigger `round_participants_deleted_account`).
* `round_events(id, round, at, recorded, kind, seat, version, payload JSON)`:
  the durable event history of the round (`at` when it took effect,
  `recorded` when it was written, `version` of the payload schema). The purge
  of the audit log does not touch it; deleting the round cascades.

# Built

* **Slice 1, the archive (2026-11-19):** `src/server/game/round-archive.ts`
  closes the running round (`closeActiveRound`), used by the admin action
  `closeRound` and by `reset` in the same transaction before the rules change
  and the world is deleted; the admin action `deleteRound` removes a closed
  round. Tests: `src/server/game/round-archive.test.ts`, upgrade test
  `src/server/db/upgrades/20261120T0900-round-archive.test.ts`. Size of the
  archive of a round with 20 players of three fully built places each:
  about 22 KB (measured in the test).
* **Slice 2, the report of one round (2026-11-19):** the server action
  `roundReport` (`src/server/game/round-report.ts`) answers a participant for
  a finished round with the ranking by the categories of #78, the economy per
  hour (the unweighted sum of the three resources), planets and moons, the
  guilds and the settings of the round; the admin also gets the running round
  as a provisional report (reading writes nothing; every admin read is an
  `admin.read` entry). The action `roundArchive` lists the rounds a reader may
  see (a player: their finished rounds and the lock line of the running one).
  The browser shows it in the box „Rundenarchiv“ of „Hilfe & Optionen“ and, for
  the admin, in the box „Rundenberichte“ of the tab „Universum“ with „Runde
  abschließen“ and „Löschen“ (`src/client/features/round-archive.ts`,
  `src/client/logic/round-archive.ts`).
* **Slice 3, the history across rounds (2026-11-19):** the action
  `roundHistory` and the table „Rundenvergleich“ below the list: per finished
  round the length in days, the participants, the winner, the reader's own
  place, points, economy and planets, the settings that differed from the
  defaults and a mark for a round with a partial history.
* **Slice 4, the Runden-Rewind:** not built, see below.

# The play time in the archive (#235 × #231, #232)

* **[E]** D2: the report shares the play time, but only in the archive after the
  round ended; during the round it stays private (#231 unchanged). The sources
  are events, no stored total (binding architecture revision). #231 and #232 tie
  their retention to the archive: kept until the admin deletes the round.
* **[V]** What the close writes: one event `player.playtime` per participant
  (`seat` set, `version` 1), written with the other events of the close in the
  same transaction and counted by the completeness check. Payload
  `{ methods: number[], intervals: [start, end][] }`: the accepted intervals of
  that participant in that round (`playtime_events.round`), cut at the cutoff
  and merged with `union` (two pages or devices count a real second once), in
  UTC milliseconds, and the versions of the method that measured them. No page,
  sequence number, usage session, account id or name. A participant without
  play time gets empty lists: a measured zero. A player who held no place at the
  cutoff is no participant and gets no event.
* **[V]** The report derives the sum on read (`playtimeMs`, `activeMs`):
  `RoundReport.playtime` is a map seat to milliseconds, shown as a column
  „Spielzeit“. Only the sum is sent to the reader, never the intervals.
* **[E]** Who sees it (D2: „shares everything“): every reader who may open the
  finished round, that is every participant and the admin, sees the play time of
  all participants. The earlier [V] of the issue (detailed playtime self/admin
  only) is superseded by D2. A provisional report of the running round has none
  (`playtime` null, the line „wird erst nach Rundenende im Archiv geteilt“), also
  for the admin.
* **[V]** An archive closed before this change has no such events: `playtime` is
  null and the line „Spielzeit: in diesem Archiv noch nicht erfasst.“ stays; an
  unknown value is not shown as zero. A round that was running when the play
  time measurement began is marked partial already, and the report adds „Die
  Zeit vor Beginn der Erfassung fehlt.“
* **[V]** The rows of `playtime_events` are kept at the close (the own view of
  #231 sums over all rounds and the game goes on after „Runde abschließen“). They
  are deleted with the round when the admin deletes it (`deleteRound`), as #232
  says. A deleted account takes its own rows with it (cascade); the archive keeps
  its copy under the seat, so the value stays under „Gelöschter Spieler“ and
  nothing links back.
* **[V]** Size: an event holds about 30 bytes per merged interval. 20 players
  who play 6 hours a day in 72 stretches of 5 minutes for 14 days: about 1,000
  intervals each, roughly 600 KB for the round (measured in
  `src/server/game/round-playtime.test.ts`), against about 22 KB for the rest of
  the archive. A smaller form (differences instead of absolute times) is
  possible later under the same `version`.
* **[V]** The words: the column „Spielzeit“ and „geschätzte aktive Zeit in dieser
  Runde, gleichzeitig geöffnete Fenster zählen einmal.“; the two lines named
  above.
* **[U]** The activity curves (daily bars) of view F need only these intervals
  and are not built.

# The events of a running round (#235, owner 2026-11-20)

* **[E]** Owner, 2026-11-20 (comment on #235): from the update of 2026-11-22 the
  events of a running round are written as round events, so that the next round
  gets the full Rewind and the curves; a thin Rewind (cards 1, 6, 8) ships now.
* **[E]** Owner, 2026-11-20 (change of the build): the capture is **central at
  the two entry points**, not one hook per feature. `runAction` (`dispatch.ts`)
  writes one event per game action, `tick` (`arrival.ts`) one per fleet
  arrival, end of holding and return. No feature file is edited; a new action
  or mission is recorded as it is.
* **[V]** Where: `src/server/game/journal.ts` (writing, causes),
  `journal-input.ts` (the allow-list of the input), `round-events.ts`
  (the seat and the writer of an event of the running round),
  `src/core/round-events.ts` (kinds and payload types for the Rewind). The
  events are rows of `round_events` (no new table: the table has the fields
  the journal needs, `kind`, `at` logical, `recorded`, `seat`, `version`; the
  volume is a few hundred bytes a row, see below, which SQLite takes easily; the
  round reset keeps the table on purpose, so it needs no `roundReset` entry).
* **[V]** Events written while the round runs, all in the transaction of the
  change they record (an event cannot be lost or doubled), none in a closed
  round or without an active `rounds` row, none for a read of the archive that
  changes nothing beyond what the action itself is:
  * `participant.joined` (seat): the first place of a player, `entry` `home`
    (a new home planet: registration, „Neue Runde“) with the placed planet as
    the baseline, or `present` (a player who was playing when the history
    began) with the state the server knew at its first event; earlier history
    is missing, nothing is invented backwards. The seat is given at joining and
    kept by the close (the close gives a seat only to a player who has none).
  * `journal.action` (seat of the actor): `{ cause: action name, input, ok,
    msg?, prod?, reports? }`. A refused action rolls its transaction back and is
    written in a transaction of its own with `ok: false` and the refusal the
    player saw; an unknown action and a request of an unknown account are not
    recorded.
  * `journal.arrival`, `journal.hold`, `journal.return` (seat of the owner of
    the fleet, `at` the logical time `arr`, end of holding or `ret`, `recorded`
    when the tick processed it): `{ cause, mission, fleet, from, to, target
    (seat of the owner of the target), ships, cargo, fate, battle?, prod?,
    reports? }`. `reports` lists the ids, kinds and receiving seats of the
    reports written by that arrival; `battle` copies the numbers of the battle
    report once (rounds, winner, ships before and after of both sides, rebuilt
    defense, loot, debris), so the attacker's and the defender's report count
    one battle. No name or text is copied.
  * `prod` (in an action, an arrival or a return): what the places saved by that
    cause produced. It is derived where the game commits it, at the save of a
    place that advances it in time: the stored state is settled once more to the
    saved time with the same pure function (`settle`), so every span is recorded
    once, at the save that advanced the place, whatever settled it before; a
    read that settles and saves nothing records nothing. Entry `{ place, owner
    (seat), from, to, m, c, d (credited, two decimals, after storage limits and
    the use of consumers, a demolition's refund included), f (energy factor at
    `from`), built? (key, level, logical end, cost paid), units? (finished by
    key) }`.
* **[V]** The settle path: the issue asked to route the roughly ten `settle`
  calls through one function. They are not changed: most of them settle a copy
  and save it later or never (a read), so recording at the call would count a
  span twice. Recording at the save of the place is the one central point and
  keeps every result identical (characterization test
  `journal-cost.test.ts`: the same 150 actions and arrivals end in the same
  places, fleets, reports and accounts with and without the journal). The
  repositories of the places and the reports are wrapped in `createCtx`
  (`context.ts`); only their `save` and `add` note what they commit.
* **[V]** Input fields: an allow-list per action and field
  (`journal-input.ts`): `keep` (ids, keys, numbers, places; strings up to 64
  characters, objects up to 400 characters of JSON, else their size), `length`
  (free texts: planet names, guild tag, name and description, rank names, chat
  text, union name: only the number of characters), `seat` (an account id: the
  seat), `seatByName` (a friend request or a union invitation by name: the seat).
  Not stored: the password of the abandon action (#224), the guild tag typed to
  dissolve a guild, and every field nobody classified. The guard test
  `journal.test.ts` fails when an action has no entry and when a module of the
  actions reads a field of its input that no entry lists. A refusal never quotes
  what the player typed in an unstored field.
* **[V]** Size: about 180 bytes of payload per action and 250 bytes per arrival
  (measured in `src/server/game/journal-cost.test.ts`, 20 players: 1000
  actions 181 KB, 1000 arrivals 245 KB, 20 `participant.joined` 3.5 KB), so a
  estimated day of 20 players at 300 actions and 100 fleet movements each is
  6,000 actions and 2,000 arrivals, about 1.6 MB of payload (the numbers of
  actions and movements are an estimate, the bytes per row are measured), a round
  of 30 days about 50 MB, in rows of a table
  with an index on `(round, kind, at)`. Cost: about 0.5 ms more per action and
  0.7 ms more per arrival (1000 actions 1.0 s without, 1.5 s with; 1000
  arrivals 2.6 s without, 3.3 s with).
* **[V]** What this does not hold: gross production (only what the game
  credited), a ledger of the market and the gifts of the Endzeit as their own
  events (they are the `trade` and `endzeit` actions and the arrival of the gift
  fleet with their `prod` and `reports`, not typed deliveries), the colony and
  moon created or removed as their own event (the arrival of the colonize
  mission and its `fate`, the `moonbreak` arrival, the `abandon` action and the
  admin actions are recorded as causes, the new place is not named), the
  research that finished (a research finishes in the player row, not in a
  place: it is not in `prod`), and a play session id. A report is deleted with
  the reset or when the player deletes it, so its id then points nowhere; the
  numbers of a battle are copied into the event for that reason.
* **[V]** An account that holds no place (an admin without a planet) has no seat:
  its actions are recorded with `seat` null.

# What the Runden-Rewind and the curves still need

The cards 1, 6 and 8 need the close only (built). The others read the events
above: card 2 (production) and the point curves read `prod` and the `build` /
`order` actions with the `built` and `units` of their completion; card 4
(a loss) the `battle` of `journal.arrival`; card 5 (recovery) the points curve;
card 7 (Endzeit) the `endzeit` action and the arrival of the gift fleet. Not
there yet: the research that finished as its own fact (it is read from the
`research` action and the player's row), the colony and moon as their own
events, the activity intervals of #232 as events of the round (they are in the
close as `player.playtime`), and the curves themselves (a reader that derives
the daily points from the events, D3).
