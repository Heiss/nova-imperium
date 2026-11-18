---
type: feature
title: Demolition of buildings
description: Tearing down one building level at a time for a refund factor from −100 % to +100 % and a share of the build time, both set by the admin per round (issue #202).
---

# Demolition of buildings

Issue #202, part of the Classic features (#222). The owner's answers of
2026-11-16 to D1 to D7. Moons are out of scope of the issue, and the
Mondzitadelle cannot be torn down ([Moons](/features/moons.md)).

# Decisions

* **[E]** A refund factor from −100 % to +100 % replaces the earlier rule
  „refund = cost × (1 − malus), malus 0 to 100 %, 0 = full refund“ (owner,
  2026-11-16, D7): at +100 % the player gets the full cost of the level
  back, at 0 % the demolition is free and gives nothing back, at −100 % it
  costs the level's cost once more. Default +50 %.
* **[E]** One factor per round, set in the admin panel (owner, 2026-11-16,
  D4; see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
* **[E]** One level per order (owner, 2026-11-16, D1).
* **[E]** The basis is the cost of the demolished level (owner,
  2026-11-16, D2).
* **[E]** Duration: a share of the level's build time, set in the admin
  panel, default 50 % (owner, 2026-11-16, D3).
* **[E]** Not while the building is in use: not while the shipyard builds,
  the lab researches, or the fields would overflow (the Weltenschmiede,
  see [Planet fields](/features/fields.md)) (owner, 2026-11-16, D5).
* **[E]** The highscore points drop by the cost of the demolished level,
  converted like every cost at 1 point per 1,000 resources (owner,
  2026-11-16, D6; see
  [Highscore categories](/features/highscore-categories.md)).

* **[E]** The time share takes 1 to 200 % of the level's build time, in
  whole percent; default 50 % (owner, 2026-11-17, D3).
* **[E]** Both values of the round are set in the dialog „Neue Runde“
  and stay editable in the universe settings during the round (owner,
  2026-11-17, X1).
* **[E]** With a negative factor the demolition costs resources; without
  enough of them the order is refused, as for building (owner,
  2026-11-16).
* **[E]** Texts (owner, 2026-11-17): the button „Zurückbauen“; with a
  positive factor „Du erhältst <Ressourcen> zurück (Erstattung N %).“,
  with a negative one „Der Rückbau kostet <Ressourcen> (Erstattung −N
  %).“, at 0 % „Du erhältst nichts zurück.“; in the admin panel
  „Rückbau-Erstattung (%)“ (−100 to +100) and „Rückbau-Dauer (% der
  Bauzeit)“; <Ressourcen> with the game's names (Adamant, Psikristall,
  Promethium). They replace the texts of the issue body (Metall, Kristall,
  Deuterium, „Malus“).

# Built

* **[V]** The demolition is one entry of the build queue, like an upgrade
  one level down (D1): the planet's queue is busy meanwhile, its end lowers
  the level, and the production changes at that time
  (`src/core/settle.ts`). A demolished level frees its field.
* **[V]** A negative factor pays its share when the demolition starts, a
  positive one gives its share back when it ends, above the storage like
  every refund. Shares are rounded down to whole resources, the time is
  rounded up to whole milliseconds; the time is the share of the build
  time of the demolished level on the planet now (robotics and Nanites
  counted).
* **[V]** „Abbrechen“ of a running demolition (the action `cancelBuild`)
  gives back what its start paid, as for an upgrade, and the level stays;
  nothing of the refund comes. So a cancel never moves more than the start
  did.
* **[V]** In use (D5) means what the upgrade of the same building waits
  for (`waitsForYard`, `waitsForLab`): the Schiffsschmiede and the
  Machina-Schwarmhalle while the shipyard has orders, the Scholarium while
  a research runs. While the demolition of one of them runs, the shipyard
  and the research wait as for its upgrade (the research list says
  „Scholarium wird ausgebaut“ then).
* **[E]** The fields would overflow when the planet without the level
  would hold more levels than fields; only a building with fields (the
  Weltenschmiede) can do that. Refused with the field message of building
  „Keine freien Felder.“ (owner, 2026-11-18).
* **[V]** Not on a moon (out of scope of #202) and not without a level: the
  interface never offers it, and the server refuses such a request with
  „Ungültig.“, as every request the interface never sends. The rule is the
  kind of the place, not a list of keys, so it holds for every building of a
  moon: the Mondbasis, the Auspex-Phalanx and the Warp-Tor
  ([Moons](/features/moons.md), #230) are refused alike, and the tests go
  over every building that stands on a moon.
* **[V]** The check is `demolitionErrors` in `src/core/demolition.ts`
  (codes `place`, `none`, `fields`, `busy`, `yardBusy`, `labBusy`, `cost`,
  in this order; patterns, section 7); the server
  (`src/server/game/demolition.ts`, action `demolish` with `key`) words
  them with the messages of building („Es wird bereits gebaut.“, „Die
  Schiffsschmiede arbeitet gerade.“, „Das Scholarium forscht gerade.“,
  „Der Zehnte reicht nicht aus.“); the browser has the same texts
  (`src/client/logic/demolition.ts`, kept equal by
  `src/test/demolition-texts.test.ts`). The audit entry is that of
  building (planet, key, the new level, the due time).
* **[E]** (owner, 2026-11-18) The row of a building with a level on a planet shows a small
  button „Zurückbauen“ below its action while the build queue is free. It
  opens a confirmation: „<Name>: Rückbau auf Stufe N“, the owner's
  sentence, „Rückbau-Dauer: <Dauer>“ and the buttons „Zurückbauen“ and
  „Abbrechen“; a refusal of the check (in use, fields, the price) stands
  there instead of the first button. <Ressourcen> lists all three as
  „X Adamant, Y Psikristall, Z Promethium“, as the issue's first text
  listed its three resources.
* **[E]** (owner, 2026-11-18) A running demolition shows „Rückbau auf Stufe N“ with its
  countdown, the progress „Fortschritt Rückbau“ and „Abbrechen“, as an
  upgrade shows „Ausbau auf Stufe N“; once done, the menu mark and the
  notice say „Rückbau fertig: <Name> (Stufe N).“ like „Ausbau fertig“.
* **[V]** Stored: `planets.bq_back_m`, `bq_back_c`, `bq_back_d`, what the
  end gives back, null on an upgrade (migration
  `20261117T0921-demolition`, see [SQLite storage](/data/sqlite.md)); the
  level of the entry is one below the level that stands.
* **[V]** The settings are two entries of the registry of the round
  settings ([Admin](/features/admin.md#the-registry-of-the-round-settings-283),
  #283), in `src/core/demolition.ts`: `DEMOLITION_REFUND_SETTING` (key
  `roundDemolitionRefund`, name `demolitionRefund`, „Rückbau-Erstattung
  (%)“, −100 to +100, default 50, order 180) and `DEMOLITION_TIME_SETTING`
  (key `roundDemolitionTime`, name `demolitionTime`, „Rückbau-Dauer (% der
  Bauzeit)“, 1 to 200, default 50, order 190), both `live`: a number field
  of the dialog „Neue Runde“ preselected with the current round and a row of
  the universe settings (X1). The game reads them from the universe
  settings (`refundOf`, `timeOf`). A value outside its range is refused with
  the range wording of the universe settings („Rückbau-Erstattung (%):
  ganze Zahl von -100 bis 100.“). The values are part of the audit entry
  of the round reset.
* **[E]** The two entries are one group `demolition` with the legend
  „Rückbau“ (owner, 2026-11-18): the dialog „Neue Runde“ shows them in one
  fieldset, the request „reset“ sends them as one object and both values
  are sent together; a wrong one refuses both together.
* **[V]** The Endzeit gift (#161) ends a running demolition only when it
  raised that building, refunding what its start paid; otherwise the
  demolition goes on.
* **[V]** The highscore points follow the levels, so they drop at the end
  of the demolition (D6).
* **[U]** Not decided and not checked: a building that other buildings or
  research require can be torn down; what was built on it stays.

# Tests

* Unit: `src/core/demolition.test.ts` (settings, moves, time, order,
  every refusal, no demolition on any moon, the Warp-Tor included, the end
  in `settle`), `src/core/round.test.ts` (the registry),
  `src/core/universe.test.ts`,
  `src/core/endzeit.test.ts` (the gift and a demolition),
  `src/client/logic/demolition.test.ts` (the button, the sentences, the
  confirmation, the mark), the dialog „Neue Runde“ in
  `src/client/views/misc.test.ts`,
  `src/client/logic/catalog-list.test.ts`,
  `src/test/demolition-texts.test.ts`; the frozen
  `src/test/catalog-reference/Buildings.svelte` has the button and the
  „Rückbau“ as its second marked change, and the generated states of
  `src/test/catalog-list-reference.test.ts` hold demolitions.
* Server: `src/server/game/demolition.test.ts` (the action, D1 to D7, the
  refusals, a building of a moon, the Warp-Tor too, the cancel, the points,
  the settings in „Neue Runde“ and the universe settings),
  `src/server/game/round.test.ts` (the live rows).
* Upgrade: `src/server/db/upgrades/20261117T0921-demolition.test.ts`.
* E2E: `e2e/demolition.spec.ts`, desktop and phone, with axe on the
  confirmation (`e2e/seed.ts` ends a running order with `finishBuild`).
