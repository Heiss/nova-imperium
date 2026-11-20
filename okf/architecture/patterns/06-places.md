---
type: Architecture
title: '6. Places'
description: 'A place is coordinates plus a kind (planet, moon, debris); the model of places and its ids.'
---

# 6. Places

* **[E]** A place is coordinates plus a kind:
  `Place = Coords & { kind: 'planet' | 'moon' | 'debris' }` (O11, owner,
  2026-11-12).
* **[V]** The id stays derived from the place, with the kind as prefix:
  `placeId()` replaces `pid()` and gives `p1_2_3`, `m1_2_3`, `d1_2_3`.
  Existing planet ids already start with `p` and stay unchanged.
* **[V]** A moon is a row of `planets` with `kind = 'moon'`; buildings,
  ships, defense and queues hang on it through `planet_id` as for a planet.
  `UNIQUE (g, s, p)` becomes `UNIQUE (g, s, p, kind)`, which in SQLite needs
  a rebuild of the table (append-only migration with the upgrade tests).
* **[E]** Debris fields get their own table: no owner, no buildings, no
  production (owner, 2026-11-12).
* **[E]** Decisions after the first build attempt of #119 (owner,
  2026-11-13):
  * Debris table `debris (id TEXT PRIMARY KEY, g, s, p INTEGER NOT NULL,
    res_m REAL NOT NULL, res_c REAL NOT NULL, UNIQUE (g, s, p)) STRICT`,
    created empty. The id is `d<g>_<s>_<p>`, so a fleet can target it like
    a planet; one row per position, because a field adds up (#45); only
    Adamant and Psikristall (#45); REAL like the planet stocks, so the 30 %
    share is not rounded.
  * `planets.kind TEXT NOT NULL DEFAULT 'planet' CHECK (kind IN ('planet',
    'moon'))`; debris has its own table. `UNIQUE (g, s, p)` becomes
    `UNIQUE (g, s, p, kind)`.
  * `Planet` gets `kind: 'planet' | 'moon'`. The planet repository reads it
    and writes it on insert, never in the update part of the upsert. The
    galaxy list and the client stay unchanged.
  * `parsePlaceId(id): Place | null` is the inverse of `placeId()`: null for
    anything that is not a canonical `[pmd]<g>_<s>_<p>` (positive integers,
    no leading zeros), so that `placeId(parsePlaceId(x)) === x`; it never
    throws on untrusted ids.
  * The kind of a fleet's origin and target comes from the prefix of
    `from_planet` and `to_planet`; the fleets tables do not change.
* **[E]** Built with #119: `Place` in `src/core/types.ts`, `placeId()` and
  `parsePlaceId()` in `src/core/place.ts` (`pid()` is gone from
  `flight.ts`; its five uses build a place of kind `planet`). Migration 15
  rebuilds `planets` with `kind` and its four child tables
  (`planet_buildings`, `planet_units`, `planet_production`,
  `shipyard_queue`) and `planets_owner`, because migrations run with
  `foreign_keys = ON` and dropping the old `planets` would delete their
  rows; every planet keeps its id and becomes kind `planet`. It adds the
  empty table `debris`; no code reads or writes it before #45 (see
  [SQLite storage](/data/sqlite.md)).
* **[E]** Position 16 (expeditions, #93) is decided with #93 (owner,
  2026-11-12). Decided there (owner, 2026-11-16, #93 Q4, Q5): the
  expedition position is the position right after the last planet position
  of the universe (16 with 15 planet positions, 21 with 20), one per system,
  never a planet position, so it takes no colonizable position away; it
  cannot be colonized, is only the target of expeditions and of a Bergung of its Trümmerfeld and is visible in
  the Sternenkarte; battles of an expedition leave a Trümmerfeld there
  ([Expeditions](/features/expeditions.md)).
* **[E]** Built with #53: a moon is a row of `planets` with the kind
  `moon` and the id `m<g>_<s>_<p>`, without a new migration; the send
  request names the kind of the target (`to.kind`), and the fleet keeps it in
  the prefix of `to_planet`. `planets.home()` takes only a planet.
* **[V]** `distance()` already returns 5 for the same coordinates, which is
  the distance planet ↔ moon (#53). A moon is removed with its planet by
  its coordinates; no parent column is needed. Missions check the kind of
  the target in `canSend`; `placement` and `fields` read it for moons.
