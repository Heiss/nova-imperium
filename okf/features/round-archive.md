---
type: feature
title: Round archive, reports and history
description: The archive of an ended round, written when the round is closed in the same transaction as the reset; the report of one archived round, the history across rounds and the thin Runden-Rewind (issue #235).
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
* **Slice 4, the thin Runden-Rewind (2026-11-20):** built with the cards 1, 6
  and 8 only, see „The thin Runden-Rewind“ below.
* **Slice 4b, the rest of the Rewind (2026-11-21):** the cards 2 to 5 and 7 from
  the version 2 events, see „The rest of the Runden-Rewind“ below. The points
  curve and `play_session_id` are not built.

* **Slice 5, view H of the admin (2026-11-20):** „Vorschau aktualisieren“ and
  the drilldown per participant, see „View H“ below.

# View H: the provisional report and the drilldown (#235)

* **[E]** The issue (view H): „Admin → Rundenberichte“ with the active round
  labelled „VORLÄUFIG · nur Spielleitung“, the participant drilldown and the
  update timestamp, the button „Vorschau aktualisieren“; the preview never
  publishes the report or triggers Endzeit or reset; „refresh feedback only“, no
  moving rankings. Access stays admin only; opening is audited as before
  (`admin.read`). The owner approved these proposals on 2026-11-20.
* **[V]** „Vorschau aktualisieren“ stands beside „Zurück zum Archiv“ in a
  provisional report (never in a finished one; a player gets no provisional
  report). It reads `roundReport` of the running round again (every read is an
  `admin.read` entry as before), keeps the chosen category and says „Vorschau
  aktualisiert.“ in a toast; the timestamp is the „Stand“ of the banner, which
  the new answer carries. Nothing moves unasked.
* **[V]** The drilldown: the server action `roundParticipant` (`{ round, seat }`,
  `src/server/game/round-report.ts`) answers `ParticipantReport`
  (`src/core/round-report.ts`) for an admin only; a player, an unknown round and
  an unknown seat answer „Dieser Rundenbericht ist nicht verfügbar.“. It shows in
  full what the ranking reduces to a row, from the same facts: the points by all
  categories, the economy per hour, the research levels, every place with its
  buildings, ships and defense, the ships on their way, the vacation mode, the
  guild and, for a finished round, the play time. A deleted account keeps
  „Gelöschter Spieler“; no account id is sent. Reading writes only the audit
  entry `roundParticipant` (`round`, `seat`).
* **[V]** The button „Einblick“ in each row of the report (a column only for
  the admin) opens it; „Zurück zum Bericht“ returns. The words of the page
  („Planeten und Monde“, „Forschungsstufen“, „Flotten unterwegs“,
  „Urlaubsmodus“) are drafts. The play time of the running round stays private
  here too (D2): „wird erst nach Rundenende im Archiv geteilt“.
* **[U]** Not built from view H: the close flow is the existing „Runde
  abschließen“ with its own confirmation (slice 1); no column „cutoff“ in the
  list of rounds.

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
  all participants (this reading of D2 confirmed by the owner, 2026-11-21).
  The earlier [V] of the issue (detailed playtime self/admin
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
* **[V]** What this does not hold (before version 2, see „The rest of the
  Runden-Rewind“ for what version 2 added): gross production (only what the game
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

# The thin Runden-Rewind (issue #235, view G)

* **[E]** The owner decided on 2026-11-20 (replacing „no Rewind in this
  update“ of 2026-11-19): a thin Rewind comes into the update of 2026-11-22
  with the cards **1** (round identity and participation), **6** (estimated
  private active time, with the method) and **8** (actual final rank and the
  link to the full report), by the rule of the issue „sparse history gets a
  shorter honest rewind“. From this update the events of the round are written
  as round events so that the next round gets the full Rewind and the curves.
* **[E]** The issue (view G): only verifiable conditional facts, no invented
  „top 1 %“, personality type or causal strategy label; full-width cards in the
  existing frame (`style.css`, `.box`, gold buttons, Cinzel and EB Garamond), no
  new product identity; manual previous and next, arrow keys, swipe, progress
  segments, optional autoplay with a pause and a replay, a reduced-motion
  fallback, no sound; the assistive output reads the stable value. The access
  is that of the report: a player only a finished round they took part in,
  checked on the server on every request.
* **[E]** The example headlines and numbers of the issue are used as given:
  „Dein Runden-Rewind“ / „30 Tage“ (card 1), „Du warst nicht ständig hier.“ /
  „12 h 40“ (card 6), „Dein Platz in der Chronik.“ / „2 von 3“ (card 8).
* **[V]** The facts are derived on read, nothing is stored: `rewindOf(report,
  seat)` (`src/core/round-rewind.ts`) turns the report of the archive and the
  reader's seat into the cards that have facts. Card 1: number, start, cutoff,
  days, participants, coverage. Card 6: the play time of that seat, only if the
  round archived play time for it (a round from before the play time archive,
  or a seat without an event, gets cards 1 and 8; a measured zero is shown as
  „0 Min.“). Card 8: the rank by the total points as in the report (equal
  points keep the order of the seats; `tied` says so), the points, the winner
  (a deleted account is „Gelöschter Spieler“). No card for the running round,
  not even for the admin, and none for a reader without a seat (an admin who
  took no part): the Rewind is a personal story.
* **[V]** The cards 2 to 5 and 7 are one entry each in `CARDS` of
  `src/core/round-rewind.ts` (slot number of the issue's table, a card
  variant, a builder that returns null while its events are missing) and a
  function in `src/client/logic/round-rewind.ts` for the words; the server and
  the component need no change.
* **[V]** The server action `roundRewind` (`src/server/game/round-report.ts`,
  `{ round }`, answers `{ rewind }`) uses the report and its access check; an
  unavailable round, a running round and a reader without a seat answer
  „Dieser Rundenbericht ist nicht verfügbar.“. An admin's read is an
  `admin.read` entry.
* **[V]** The client: the button „Rewind ansehen“ beside „Bericht öffnen“ in
  the row of a finished round the reader took part in (the issue's wording of
  view A); the component `RoundRewind.svelte` is a panel in the place of the list
  of `RoundArchive.svelte` (Options and the admin box „Rundenberichte“), no view
  of its own. „Zurück“ and „Weiter“, the arrow keys (also with focus on a
  button), a swipe of at least 48 px (touch and pen, not the mouse), progress
  segments, the card heading takes the focus when the player turns a card or
  opens the Rewind, a hidden `aria-live` line tells „Karte 2 von 3“ and, while
  the play runs, the card with its stable value. The automatic play is off
  until „Automatisch abspielen“; a card stays 7 seconds; a turn by the player
  pauses it; it stops on the last card and offers „Noch einmal abspielen“. The
  place of the card and the play are kept in `round-rewind.svelte.ts` because
  the page is mounted anew on every render.
* **[V]** Motion: a card fades in (0.45 s), but not under
  `prefers-reduced-motion: reduce` and not when the player switched the
  animations off in „Optionen“ (the existing setting, `no-anim`): then the
  component carries `data-still="true"`. No separate animation switch: the
  existing one applies, the autoplay is the only timed part and has the pause.
* **[V]** The texts (all drafts of Claude): card 1 „Runde 3: 1.10.2026 bis
  31.10.2026.“, „Du warst einer von 3 Teilnehmern.“ (one: „Du warst der
  einzige Teilnehmer.“), a round with a partial history adds the coverage line of
  the report; card 6 „Deine geschätzte aktive Zeit in dieser Runde.“ and
  „Methode: <the explanation of „Meine Aktivität“> Gleichzeitig geöffnete Fenster
  zählen einmal.“, partial: „Die Zeit vor Beginn der Erfassung fehlt.“; card 8
  „Endplatz nach Punkten: 8.400 Punkte.“, „Sieger: Lea mit 9.100 Punkten.“ (the
  winner: „Du hast die Runde gewonnen.“), a tie: „Ein anderer Spieler hat genauso
  viele Punkte; bei Gleichstand ordnet der Bericht nach der Nummer des Platzes.“,
  the button „Vollständigen Bericht öffnen“; controls „Zurück zum Archiv“,
  „Zurück“, „Weiter“, „Automatisch abspielen“, „Pause“, „Noch einmal abspielen“.
* **[U]** The headline of card 6 states „Du warst nicht ständig hier.“ for every
  player as the issue gives it; a player who was active nearly all the time
  would read it as odd. The issue names no threshold, none is invented.

# What the Runden-Rewind and the curves still need

The report of this build holds the state at the cutoff only. The Rewind (view
G) and the point curves, the chronicle (view E) and the comparison over time
(view D) need the in-round events of the issue's audit table, none of which
exist yet (the table `round_events` and its writer
`ctx.rounds.addEvent` are ready for them, no second migration is needed):
`participant.joined` and the baseline, completed build/research/order events
with the paid cost and the logical time, fleet arrivals and returns, the
enriched battle event (losses, loot, debris), colony and moon creation and
removal, accrued production and external deliveries, the Endzeit
deliveries and admin gifts, and the activity intervals of #232. Each is
written in the same transaction as the domain change, with a stable causal id
(`round_events.version` is the schema version of the payload). The daily
points are then derived on read (D3). Without them a Rewind could only show
the final standing and the play time (cards 1, 6 and 8): that is the thin
Rewind below, the full one comes with these events.

# The rest of the Runden-Rewind (issue #235, owner 2026-11-21)

* **[E]** Card 4 („Dann kam …“, „−N Flottenpunkte“): the single battle with the
  largest own loss of ship construction value divided by 1000, in any role
  (attacker or defender), no threshold. Defence losses do not count. No card
  when there was no loss (owner, 2026-11-21).
* **[E]** Card 5 („Du bist zurückgekommen.“, „N Tage“): derived from version 2
  events only. The fleet value is the construction value of the own ships; the
  card shows only when it came back to its level before the card-4 loss, and
  the number is the days from that loss to the first event at or above that
  level. No card when it never came back, and none for a round that holds
  events of version 1 (owner, 2026-11-21).
* **[E]** Cards 2 (Wirtschaft: actual production credits), 3 (investment mix)
  and 7 (Endzeit: admin gifts clearly separated) are built from the version 2
  events; their headlines are the issue's examples (owner, 2026-11-21).
* **[E]** The points curve and `play_session_id` are not in this release; they
  stay open (owner, 2026-11-21).
* **[E]** A round with events of version 1 says honestly what it lacks: the
  cards that need version 2 facts are left out and the Rewind keeps the shorter
  form (owner, 2026-11-21).
* **[V]** Version 2 of the journal (`EVENT_VERSION` 2, `src/core/round-events.ts`):
  the events `research.done` (key, level, logical end, cost paid, cause),
  `place.created` and `place.removed` (a colony or moon, not the first home
  planet, which is `participant.joined`), `journal.close` (the closing
  settlement of all places and research up to the cutoff, written by
  `closeActiveRound` before the facts of the close); `unitsCost` (ships and
  defense apart) in `Produced`, `back` (the refund of a demolition) in
  `Produced.built`, `gift` on the arrival of the gift fleet of the Endzeit.
  `participant.joined`, `journal.*` and the events above carry the version; the
  facts of the close (`player.final`, `player.playtime`, `round.closed`) and
  the annotation `admin.endzeit` keep version 1 and are not looked at. An
  arrival now starts its cause at its due time, so a fact noticed by an arrival
  has the logical time of the arrival.
* **[V]** The reader is `src/core/round-rewind-facts.ts` (pure functions over the
  ordered events; the server hands over `ctx.rounds.events(number)`, nothing is
  stored). It answers null, and the card is left out, when the facts are
  missing. **Complete** (`completeFor`): the round holds journal events, none of
  them of version 1, and the seat has a `participant.joined` with `entry`
  `home`. A seat that joined as `present` (it was playing when the history
  began) or has no joining lacks its early history. Cards 2, 3, 5 and 7 need a
  complete seat. Card 4 needs only battle numbers, which version 1 holds too, so
  a round with version 1 events keeps card 4 (it tells the largest loss
  recorded; a round that began before the history may hold a larger one).
* **[V]** The facts each card reads: card 2 the `prod` entries whose `owner` is
  the seat, in every `journal.action`, `.arrival`, `.hold`, `.return` and
  `journal.close`: m, c, d credited (after the storage limit), the refund
  `built.back` of a demolition taken out; the sum m + c + d (an unweighted sum,
  not a value); no card for a sum of 0 or less. The cargo of a gift fleet and of
  a trade is no `prod`, so it is not counted. Card 3 the cost of the finished
  buildings (`prod[].built.cost`, no demolition), of `research.done` of the
  seat, and `prod[].unitsCost.ships` and `.def`, each as m + c + d; the category
  with the strictly largest amount is the focus, its share of all four in whole
  percent (rounded). Card 4 the `battle` of a fleet event: for the owner of the
  fleet `attBefore` minus `attAfter`, for the owner of the target (`target`)
  `defBefore` minus `defAfter`, ships only (the keys of the ship catalog),
  valued by the raw cost m + c + d, divided by 1000 and rounded down
  (`pointsOf`). The day is the day of the round (1 is the first, at most the
  length of the round). Card 5 the fleet value of the seat as a ledger over the
  events in the order of their logical time: plus `prod[].unitsCost.ships`, plus
  the ships of the baseline of `participant.joined` and of the arrival of the
  Endzeit gift of the seat, minus the ships lost in battles (as card 4, every
  battle, not only the largest). Card 7 the event `admin.endzeit` (written only
  by a ring-in that went through; its time gives the day) and the arrival of the
  seat with `gift` (ships and cargo that landed).
* **[V]** What the fleet value of card 5 does not know, and what the card does
  about it (Q26, below): ships consumed outside a battle, the fleets that
  joined or held in a battle (only the leading fleet and the planet are in the
  numbers of the journal), and ships that finished earlier than the save that
  noticed them (the time of a finished unit is the logical time of the event
  that noticed it: „first observed“, as the issue says; the closing settlement
  notices everything at the latest at the cutoff).
* **[V]** Rules where nothing was decided, taken from the conditional rule of
  the issue („no fact, no card“): card 3 has no card when nothing was paid or
  when two categories share the largest amount; a tie of two equal losses
  (card 4) takes the earlier battle; card 5 has no card when the value before
  the loss is smaller than the loss (the events then miss ships), and none when
  the gift of the Endzeit arrived between the loss and the recovery (a recovery
  the admin's gift could have caused is not told as one; a gift before the loss
  counts as own ships); the days of card 5 are whole days, rounded up, at least
  1, as the length of a round; card 7 has no card without a ring-in event and
  tells nothing about a gift that did not arrive for the seat.
* **[V]** Decisions the coordinator took under `AGENTS.md` (2026-11-21; the
  owner can overturn each of them):
  * **Q17:** card 5 has no card when the gift of the Endzeit arrives between
    the loss and the recovery (as built).
  * **Q18:** card 3 has no card when two categories tie (as built).
  * **Q19:** card 4 in a round that holds events of version 1 stays, with one
    more line, only for such a round: „Aus dem aufgezeichneten Teil der
    Runde.“ (a draft [V]; `LossCard.recordedOnly`, `hasOldVersion`). A round of
    version 2 has no such line. The loss is then the largest of the recorded
    part; a round that began before the history may hold a larger one.
  * **Q20:** card 2 is the unweighted sum m + c + d (as built).
  * **Q21:** card 7 shows the day of the ring-in (as built).
  * **Q26, card 5 and what the ledger does not subtract.** The fleet value is a
    ledger: plus the finished ships and the baseline, minus the ships lost in the
    recorded battles. Let C(t) be the construction value of the ships that were
    consumed up to time t without a number in the journal. The ledger equals the
    real value plus C(t), because the real value lost them and the ledger did
    not; C only grows. The level before the loss, ledger(t0), holds C(t0). If
    nothing unrecorded was consumed in the window from the loss to the
    recovery, C(t) = C(t0), so ledger(t) >= ledger(t0) means real(t) >=
    real(t0): the real value is back. Consumption before the loss cancels out,
    since it is in C(t0) as well. Ships found or landed that the ledger does not
    count (an expedition's find) only make the real value larger, so they do not
    break the argument. The card can therefore only miss a recovery, never claim
    a false one. So `recoveryOf` returns no card when the window, from the event
    of the loss (included) to the event of the recovery (included), holds an
    event of the seat that consumed ships without a number. Each is recognised
    from the version 2 journal alone (`consumes` in `round-rewind-facts.ts`,
    tested on hand-made payloads and on the events of real arrivals in
    `src/server/game/round-rewind-consumption.test.ts`):
    * **Colonisation:** a `journal.arrival` of the seat with `mission`
      `colonize` and a `place.created` of the seat with `kind` `planet` and
      `cause` `arrival` at the same logical time. (The `send` action only
      launches the ark; the ship is consumed at the arrival, so the window is
      read at the arrival. An arrival that founded nothing, because the limit of
      planets was reached, has no such `place.created`, and the fleet flies
      home whole.)
    * **Expedition:** a `journal.arrival` of the seat with `mission`
      `expedition`, `fate` `gone` and no `battle`: the event „lost“ of the
      expedition. An expedition that lost ships in a battle with pirates or
      aliens has the `battle` numbers, with the raiders as `attBefore` and the
      fleet of the owner as `defBefore`; the reader now takes the own side of
      that battle from `defBefore` and `defAfter` (before, the raiders' losses
      were read as the seat's own loss, a fault of cards 4 and 5).
    * **Joined or held fleet:** a battle event (arrival with `battle`) whose
      `reports` list holds a `battle` report `to` the seat while the seat is
      neither the owner of the leading fleet (`seat` of the event) nor the owner
      of the target (`target`): the seat joined the union or held at the planet.
      A fleet of the seat that joined a union led by the seat's own fleet (or
      by another) is also recognised by the `send` action of the seat with
      `ok` true and `input.union` set: the arrival event of the fleet with that
      id is a battle with a fleet of the seat whose ships the numbers do not
      hold. A seat cannot hold at its own planet (only an ally of the owner may).
    * Three more consumptions are found the same way and treated the same
      (the argument above needs no other): a `place.removed` of the seat (an
      abandoned planet or a moon destroyed, with the ships on it), a lost survey
      (`mission` `survey`, `fate` `gone`), and a Mondbruch arrival of the seat
      with Weltenbrecher among its ships (they may tear themselves apart, which
      the battle numbers do not hold). The last one suppresses also when none
      was torn; it can only miss a recovery.
    * The same events before the loss do not suppress the card, and neither do
      the events of another seat.
* **[V]** The cards in the issue's order of slots: 1, 2, 3, 4, 5, 6, 7, 8 in
  `CARDS`; the cards have the kinds `economy`, `focus`, `loss`, `return` and
  `endzeit`.
* **[V]** The texts (`src/client/logic/round-rewind.ts`). The headlines and
  figures of the issue: „Du hast eine Wirtschaft aufgebaut.“ / „8,2 Mio.“;
  „Dein Schwerpunkt: Aufbau.“ / „58 %“; „Dann kam Karthax.“ / „−420
  Flottenpunkte“; „Du bist zurückgekommen.“ / „5 Tage“; „Und dann: die
  Endzeit.“ / „Tag 28“. Drafts of Claude: the focus word of the categories
  Forschung, Flotte and Verteidigung („Dein Schwerpunkt: Forschung.“ and so
  on); the headline of card 4 for an attacker („Dann traf deine Flotte auf
  Karthax.“) and for an unnamed opponent („Dann kam ein Angriff.“, „Dann traf
  deine Flotte auf einen Gegner.“); the kickers (Wirtschaft, Schwerpunkt,
  Verlust, Zurückgekommen, Endzeit); and the lines of the cards, listed in the
  hand-over report. The figure of card 2 is in millions with one decimal and a
  decimal comma from a million, else with the thousands point.
* **[V]** The component needs no change: it draws any `RewindCardPage` with the
  same structure, the `aria-live` line with the stable value and the motion
  rules of „The thin Runden-Rewind“. The opponent of card 4 is the name of the
  report row of the other seat (a deleted account: „Gelöschter Spieler“); an
  opponent without a row stays unnamed.
* **[V]** Cost of the read: `roundRewind` loads all events of the round (about
  50 MB of payload for a round of 20 players, see above) and filters in memory;
  it is a rare read. A filter by seat in the repository is the next step if it
  is felt. [U]
