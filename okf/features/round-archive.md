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
* **Slices 2 to 4:** see the sections below as they are built.
