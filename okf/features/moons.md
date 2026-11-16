---
type: feature
title: Moons with Mondzitadelle, Auspex-Phalanx and Warp-Tor
description: Moons from large debris fields after a battle, their own buildings Mondzitadelle (classic Mondbasis), Auspex-Phalanx (Sensorphalanx) and Warp-Tor (Sprungtor), built in three pull requests (issue #53).
---

# Moons

Issue #53, milestone `next release` (owner, 2026-11-13). Sources: owiki.de
„Mond“, „Mondbasis“, „Sensorphalanx“, „Sprungtor“ (read 2026-11-13) and the
issue. Needs debris fields (#45, [Trümmerfelder](/features/debris.md)), the
model of places (#119, O11) and fields (#51, [Planet fields](/features/fields.md)).

* **[E]** Moons are no longer a non-goal (owner, 2026-11-13).
* **[E]** Built in this release in three pull requests: moons with the
  Mondzitadelle, then the Auspex-Phalanx, then the Warp-Tor (owner,
  2026-11-13).
* **[E]** Moon chance after a battle at a planet: min(⌊debris / 100,000⌋,
  20) %, counted from the **whole** Trümmerfeld at the position after the
  battle (owner, 2026-11-13; owiki.de counts only the new debris of the
  battle). At most one moon per planet; it belongs to the planet's owner.
* **[E]** Diameter = ⌊√(x + 3 · chance) · 1000⌋ km, x a whole number from 10
  to 20, all equally likely (owiki.de „Mond“, Mondgröße): 3,605 to 8,944 km
  (owner, 2026-11-13). It decides the destruction chance of #95.
* **[E]** Fields: a moon starts with 1 field, every Mondzitadelle level adds
  3 and takes one itself, without an upper limit (owner, 2026-11-13; the
  diameter limit was removed in v0.77c).
* **[E]** A moon behaves like a planet: resources, fleets and defense, no
  production. Attack, transport, espionage and Verlegung fly to and from
  moons; colonization and Bergung never target a moon; noob protection is
  the one of the owner (owner, 2026-11-13). The distance planet ↔ moon is 5
  (`distance()` for the same coordinates).
* **[E]** Buildings on a moon: Servitorenschmiede, Orbitale Schiffsschmiede,
  the three stores, Mondzitadelle, Auspex-Phalanx, Warp-Tor; not the mines,
  Sonnenkathedrale, Fusionssanktum, Scholarium, Machina-Schwarmhalle,
  Weltenschmiede. Defense takes no field. Sonnenreliquiare give energy there
  as everywhere (owner, 2026-11-13).
* **[E]** Mondzitadelle (classic Mondbasis): 20,000 Adamant, 40,000
  Psikristall, 20,000 Promethium, factor 2; no requirement; +3 fields per
  level, takes one; cannot be torn down (owner, 2026-11-13).
* **[E]** Auspex-Phalanx (classic Sensorphalanx): 20,000 / 40,000 / 20,000,
  factor 2; needs Mondzitadelle 1; range level² − 1 systems; a scan costs
  5,000 Promethium on the moon and shows every flight to and from the
  scanned foreign planet (ships, origin, target, arrival, no cargo); moons
  cannot be scanned; the scanned player is not told (owner, 2026-11-13,
  the classic simple rule).
* **[E]** Warp-Tor (Sprungtor, modern levels): level 1 costs 2,000,000 /
  4,000,000 / 2,000,000, factor 2; needs Mondzitadelle 1 and Warp-Theorie 7;
  moves ships only (no resources) at once and without fuel to another own
  moon with a Warp-Tor; both gates then cool down by the level of the
  starting gate (owner, 2026-11-13): owiki.de values 1: 60, 2: 53, 3: 47,
  4: 41, 5: 36, 10: 17, 15 and more: 10 minutes; in between linear, rounded
  to whole minutes: 6: 32, 7: 28, 8: 25, 9: 21, 11: 16, 12: 14, 13: 13,
  14: 11.
* **[E]** Moons come from battles and from the admin: in the admin area, at
  a planet of a player without a moon, „Mond anlegen“ with a chance of 1 to
  20 %; the diameter follows the formula; audited (owner, 2026-11-13).
* **[E]** Display (owner, 2026-11-13, proposal A): a moon symbol at the
  planet in the Sternenkarte, visible to everyone, with a link; the moon is
  its own entry „<Planetenname> (Mond)“ in the planet list; the battle
  report shows „Mondchance: x %“ and, when a moon forms, „Die enormen Mengen
  an freiem Adamant und Psikristall ziehen sich an und formen einen
  Trabanten um den Planeten.“
* **[E]** Names in the grimdark style of #127: Mondzitadelle, Auspex-Phalanx,
  Warp-Tor (owner, 2026-11-13).
* **[V]** Short and long texts, abbreviations and art of the three buildings
  and of the moon are proposed in the pull requests (the Mondzitadelle and
  the moon in the first, the Auspex-Phalanx in the second, below).

## Decided for the first pull request (moons and Mondzitadelle)

The owner's answers to the open questions of the first build (owner,
2026-11-14):

* **[E]** Temperature: a new moon gets the temperature of its planet at
  creation, without an extra random draw.
* **[E]** „Zusatzfelder pro Planet“ (#51) does not apply to moons: a moon
  has 1 field plus 3 per Mondzitadelle level, and the Mondzitadelle takes a
  field itself (owiki.de).
* **[E]** A new moon starts with 0 Adamant, 0 Psikristall and 0 Promethium
  and has no base income (owiki.de: „auf dem Mond [können] keine Rohstoffe
  produziert werden“).
* **[E]** The reference test of #116 (`missions-reference.test.ts`) gets
  the moon rule in its frozen reference, written there on its own as for
  #45, and keeps comparing everything bit for bit.
* **[E]** Battle report: the line „Mondchance: x %“ appears only when x > 0
  and the planet has no moon yet, that is only when the chance is rolled;
  when a moon forms, the sentence about the Trabant follows (the decided
  wording above with Adamant and Psikristall, [V] as the adaptation of the
  classic „Metall und Kristall“).
* **[E]** Admin „Mond anlegen“ with 1 to 20 %: always creates the moon; the
  chance only goes into the diameter formula. It sits at each planet in the
  player record of the admin tab „Spieler“.
* **[E]** Name: a moon starts with the name „Mond“, can be renamed like a
  planet and is always shown as „<Name> (Mond)“.
* **[E]** The Mondzitadelle can be built only on moons and is not offered
  on planets. The fleet form gets a select „Planet / Mond“ beside the
  coordinates, with the moon only where one exists. The moon symbol on the
  Sternenkarte opens the moon's actions like a planet row: at an own moon
  „Wechseln“, „Versorgungsflug“ and „Verlegung“, at a foreign moon
  „Auspex-Erkundung“, „Sturmangriff“ and „Versorgungsflug“.

## Built (first pull request: moons and Mondzitadelle)

Stacked on the debris build (#45, [Trümmerfelder](/features/debris.md)), the
places (#119) and the fields (#51).

* Storage: a moon is a row of `planets` with `kind = 'moon'` and the id
  `m<g>_<s>_<p>`, as migration 15 allows; no new migration. A fleet's target
  kind comes from the prefix of `to_planet`. `planets.home()` takes only a
  planet, so a moon is never the home planet.
* Moon step: `src/core/moon.ts` (`moonChance` ⌊(Adamant + Psikristall) /
  100,000⌋ at most 20, `formsMoon` one draw `rng() < chance / 100`,
  `moonDiameter` ⌊√(10 + ⌊draw · 11⌋ + 3 · chance) · 1000⌋, `placeName`
  „<Name> (Mond)“); `src/server/game/moons.ts` (`addMoon`, `rollMoon`,
  `createMoon`, `moonAt`, the start name „Mond“). The attack runs it after
  the debris step and before the rebuilt defense, at a planet without a
  moon, with the whole field at the position; a rolled chance goes into both
  battle reports as `moonChance` and `moon`. A battle at a moon rolls
  nothing. The moon lines are part of the battle reports, so they go with
  their push kinds of #192 (`fleet` for the attacker, `attacked` for the
  defender); „Mond anlegen“ sends no report and no push.
* Fields: `maxFields` gives a moon 1 field plus the `fields` of its
  buildings, without the diameter and the „Zusatzfelder pro Planet“.
* Production: `baseIncome(kind)` in `src/core/components/produces.ts`, none
  on a moon; `prod()` and `producerRows()` read the kind, so the resources
  page (`ProducerTable`) shows 0 as base income there. The Sonnenreliquiare give energy by the moon's
  temperature.
* Buildings: the component `placement` (`src/core/components/placement.ts`,
  the kinds of place; without it planets only) on the Servitorenschmiede,
  the Orbitale Schiffsschmiede and the three stores (planet and moon) and the
  Mondzitadelle (moon); `catalog.ts` derives `PLACEMENT` and `buildable(key,
  kind)`. The build action refuses „Nur auf einem Mond baubar.“ and „Auf
  einem Mond nicht baubar.“ first; the requirements list says „nur auf einem
  Mond baubar“ and „auf einem Mond nicht baubar“; the buildings page lists
  only what can stand on the shown place.
* Mondzitadelle: `src/features/moonbase/` (key `moonbase`, `order` 140,
  after the stores), `leveled` 20,000 / 40,000 / 20,000, factor 2, no
  requirement, `fields: 3`, `placement: ['moon']`. No building can be torn
  down, so neither can it.
* Missions: the fleet form sends `to.kind` (`planet` or `moon`); the server
  aims at the moon of the position for `moon`. `sendError` refuses a moon
  for the target kinds `free` and `debris` (`moonTarget`) and says `noMoon`
  when the position has none. Attack, transport, espionage and Verlegung
  arrive, report and come home at a moon like at a planet; their reports
  name the moon „<Name> (Mond)“.
* Admin: the player record lists the player's planets; at a planet without a
  moon „Mond anlegen“ with a chance of 1 to 20 % (`POST /api/admin/moon`,
  audit `admin.write` / `createMoon` with the planet, the moon, the chance
  and the diameter).
* Interface: the state lists moons in `galaxy` with their kind; the
  Sternenkarte shows a moon button at the planet for every player, which
  opens a row with the moon's actions; the planet list shows „<Name> (Mond)“
  after its planet; the overview shows „Mond“, the moon picture and its
  fields; the fleet form has the select „Zielart“ („Planet“, „Mond“, the
  moon disabled where there is none) and „kein Mond“ beside the target; the
  battle report shows „Mondchance: x %“ and the sentence about the
  Trabant. Renaming a moon says „Mond umbenennen“.
* **[V]** Proposals of the pull request, for the owner to confirm:
  * Mondzitadelle: abbreviation `MZ`; short text „+3 Felder pro Stufe. Steht
    nur auf einem Mond.“; long text „Die Mondzitadelle gräbt Hallen,
    Schleusen und Luftreiniger in das tote Gestein eines Mondes. / So
    funktioniert es: Ein Mond hat nur ein Feld. Jede Stufe der Mondzitadelle
    schafft drei neue Felder für Gebäude und belegt selbst eines. Sie steht
    nur auf einem Mond und kann nicht abgerissen werden.“; art: the lunar
    base of the interface v2 icon set
    (`docs/design/interface-v2/icons/moon/lunar_base.svg`), renamed in
    `<title>` and `aria-label`; the key `moonbase` and its place after the
    stores;
  * the moon picture `icons/moon.svg` (a grey cratered disc in the gold
    frame of the icons), on the Sternenkarte, in its row and in the
    overview;
  * the sentence about the Trabant with Adamant and Psikristall instead of
    the classic „Metall und Kristall“ (above);
  * the messages „An dieser Position gibt es keinen Mond.“, „Ein Mond kann
    nicht das Ziel dieses Auftrags sein.“, „Nur auf einem Mond baubar.“,
    „Auf einem Mond nicht baubar.“, „Planet nicht gefunden.“, „Dieser Planet
    hat schon einen Mond.“, „Die Mondchance muss zwischen 1 und 20 %
    liegen.“, „Mond angelegt.“; „kein Mond“ beside the target; „Aktiver
    Mond“ on the Sternenkarte; „Zielart“ as the label of the select; the
    table „Planeten“ of the player record with „vorhanden“ and the field
    „Mondchance in %“.
* Tests: `src/core/moon.test.ts`, `src/core/components/placement.test.ts`
  (contract), `fields.test.ts`, `economy.test.ts`, `produces.test.ts`,
  `missions.test.ts`, `requirements.test.ts`, `catalog.test.ts`,
  `text.test.ts`, `src/test/naming.ts` (classic name „Mondbasis“),
  `src/server/game/moons.test.ts`, `attack.test.ts`, `fleet.test.ts`,
  `actions.test.ts`, `planets.test.ts`, `app.test.ts` (the admin route),
  `src/client/logic/moon.test.ts`, `src/client/logic/fields.test.ts`,
  `src/client/views/galaxy.test.ts`, `settle.test.ts` (a moon settles
  without base income); the settle reference of #115
  (`settle-reference.test.ts`) also generates moons and compares them bit
  for bit, because both versions read `prod()`; `missions-reference.test.ts` has the
  moon rule in its frozen reference, written there on its own (chance of
  the whole field, the draw, the diameter, the moon row and the report
  fields), compares everything bit for bit and checks that its generated
  battles roll chances and form moons; E2E `e2e/moons.spec.ts` (the admin's
  „Mond anlegen“ and the moon's actions on the Sternenkarte, the moon as an
  own place with its buildings, fields and no base income, a Verlegung to
  the own moon, the moon chance in a battle report, the moon on a phone)
  and axe on the Sternenkarte with an open moon, the fleet form, the moon's
  overview, buildings and resources (`e2e/a11y.spec.ts`) and on the player
  record with „Mond anlegen“ (in `e2e/moons.spec.ts`, which runs after the
  admin test of `game.spec.ts` that counts the reads of a player record).
* A moon from a battle forms by chance only; the E2E tests check the line
  „Mondchance“ of a real battle and make moons with the admin or
  `e2e/seed.ts` (option `moon`); the sentence about the Trabant is checked
  by the unit tests of the report and the attack.

## Decided for the second pull request (Auspex-Phalanx)

* **[E]** Endzeit gift (#161) and the moon buildings (owner, 2026-11-14,
  „Geklärt, Nachtrag 2“): the gift raises only buildings that may stand at
  its target, checked with the component `placement`; `moonbase` and every
  other moon-only building are skipped on the home planet. Research is not
  a building and is raised as before. Without it the gift would raise the
  Mondzitadelle on the home planet once the Auspex-Phalanx requires
  Mondzitadelle 1.
* **[E]** Auspex-Phalanx (owner, 2026-11-15, „Geklärt, Nachtrag 3“):
  * the key is `phalanx`, ordered after `moonbase`;
  * the range is level² − 1 systems, counted only in the scanner's own
    galaxy as |s − s₀|, without a wrap around the end of the galaxy,
    measured the same way as `distance()`;
  * a free position is refused without charge; a planet without flights
    costs 5,000 Promethium and shows an empty result;
  * the scan is an action at a foreign planet row on the Sternenkarte,
    offered when the active place is a moon with a phalanx and the planet is
    in range; the result shows in a panel there;
  * a scan shows for each fleet only its ships, origin, target and arrival:
    no owner, mission, cargo or fuel.
* **[E]** Fleets on their way (owner, 2026-11-15, „Geklärt, Nachtrag 4“):
  a scan shows only each fleet's current leg. A fleet flying back shows the
  leg from its target to its start, arriving at its return; a recalled
  fleet shows from where it turned back; an outbound fleet shows only its
  arrival at its target. The Endzeit gift (#161) shows like any other
  fleet.
* **[V]** Flights are sorted by arrival, the first first: not asked, taken
  as recommended (owner, 2026-11-15, the rule of [Release
  loop](/ops/loop.md) for a recommendation consistent with earlier
  decisions; „Geklärt, Nachtrag 4“).

## Built (second pull request: Auspex-Phalanx)

* Endzeit gift: `standing(levels, kind)` in `src/core/endzeit.ts` keeps the
  levels that `buildable` allows on the kind of place; `giftArrive` raises
  `standing(need.b, t.kind)` on the home planet, the research unchanged.
  Since the phalanx requires Mondzitadelle 1, `giftLevels()` names
  `moonbase`, and the gift skips it on the home planet. Tests:
  `src/core/endzeit.test.ts` (moon-only skipped on a planet, planet-only
  skipped on a moon, a key without `placement` as a planet building, a
  property over the catalog), `src/server/game/endzeit-placement.test.ts`
  (failed before the change) and `src/server/game/endzeit.test.ts` (the
  arrival raises `standing(giftLevels().b, 'planet')`, without the
  Mondzitadelle).
* Building: `src/features/phalanx/` (key `phalanx`, `order` 150, after the
  Mondzitadelle at 140), `leveled` 20,000 / 40,000 / 20,000, factor 2,
  `req: { b: { moonbase: 1 } }`, `placement: ['moon']`, no `fields`. The
  build action, the requirements list and the buildings page treat it like
  the Mondzitadelle through `buildable`.
* Rules in `src/core/phalanx.ts` (patterns, section 7):
  `phalanxRange(level)` level² − 1 (below 0 at level 0); `phalanxLevel(p)`
  the building on a moon, 0 on a planet, the one place that reads the key;
  `inPhalanxRange(at, target, level)` the same galaxy and |s − s₀| ≤ the
  range; `SCAN_COST` 5,000 Promethium and `SCAN_PRICE` as a cost;
  `scanRefusal(kind, owner, scanner)`; `scanReach(scanner, target)` the
  error code without the price, in this order: `notMoon`, `noPhalanx`, a
  moon or a Trümmerfeld (`moon`, `notPlanet`), `outOfRange`, `free`, `own`;
  `scanError(scanner, target)` adds `cost` when the moon holds less than
  5,000 Promethium; `scanFlights(fleets, id)` every fleet of every player
  whose start or target is the planet, as the leg it flies now (ships,
  origin, target, arrival), by arrival. A fleet has no position between two
  places, so a recalled fleet flies from the target it turned away from
  back to its start, arriving at its return, like any fleet flying back;
  the gift flies from and to the home planet. Flights of the planet's moon
  are not the planet's.
* Server: the action `scan` in `ACTIONS` (`src/server/game/phalanx.ts`)
  with `planet` (the active place) and `target` (a place id such as
  `p1_2_3`); an id that is no place says „Unbekanntes Ziel.“. It runs
  inside the transaction of `runAction`, after the due fleets: it checks
  `scanError`, charges 5,000 Promethium on the moon and answers the flights
  as `data.scan` (`by`, `target`, `flights`). An action may now answer
  `{ msg, data }` (`Answer` and `answerOf` in `actions.ts`); `POST
  /api/action` puts `data` beside `msg` and `state`, only when there is
  data. The scanned player gets no report and no push; the audit event
  `game` / `scan` names the moon, the target and the number of flights.
* Interface: the Sternenkarte stays HTML. At a foreign planet row the button
  „Phalanx-Scan“ (`aria-label` „Phalanx-Scan von <Name>“) appears when
  `canScan` (`src/client/logic/phalanx.ts`, `scanReach` of the core) allows
  it, also without the Promethium (the server names the price). The client
  sends every action through `act()`, which now hands the answer's data to
  `answer` before the state; `scanOf` reads the scan, and the panel
  `scanPanel` (`src/client/views/galaxy.ts`) shows it above the table while
  the moon it came from is the active place: the heading „Phalanx-Scan:
  <Name> [g:s:p]“ (focused after the scan), a table „Schiffe“, „Herkunft“,
  „Ziel“, „Ankunft“ (a countdown, as in the fleet list), a moon as
  „[g:s:p] (Mond)“, „Keine Flüge erfasst.“ for an empty scan, and
  „Schließen“, which puts the focus back on the scan button.
* **[V]** Proposals of this pull request, taken as recommended (owner's
  rule of 2026-11-15 in [Release loop](/ops/loop.md)), for the owner to
  confirm:
  * abbreviation `PX`; short text „Erfasst die Flüge fremder Planeten in
    Reichweite. Steht nur auf einem Mond.“; long text „Die Auspex-Phalanx
    lauscht mit einem Wald aus Antennen in die Leere und hört jeden Antrieb
    zwischen den Welten. / So funktioniert es: Ein Scan vom Mond zeigt die
    Flüge zu und von einem fremden Planeten derselben Galaxie; die
    Reichweite wächst mit jeder Stufe. Jeder Scan kostet Promethium, der
    Erfasste merkt nichts. Monde sind nicht zu erfassen.“ (the long texts
    say no numbers, #94); art: the sensor phalanx of the interface v2 icon
    set (`docs/design/interface-v2/icons/moon/sensor_phalanx.svg`), renamed
    in `<title>` and `aria-label`; the classic name „Sensorphalanx“ joins
    the naming test data;
  * the short name „Phalanx-Scan“ of the action and the panel;
  * the messages „Ein Phalanx-Scan ist nur von einem Mond aus möglich.“,
    „Auf diesem Mond steht keine Auspex-Phalanx.“, „Das Ziel liegt
    außerhalb der Reichweite der Auspex-Phalanx.“, „An dieser Position gibt
    es keinen Planeten.“, „Monde lassen sich nicht erfassen.“, „Nur Planeten
    lassen sich erfassen.“, „Eigene Planeten lassen sich nicht erfassen.“,
    „Nicht genug Promethium für den Phalanx-Scan.“, „Unbekanntes Ziel.“;
    the panel texts „Keine Flüge erfasst.“ and „Schließen“;
  * the panel above the table of the systems, kept until „Schließen“, the
    next scan or a change of the active place; the arrival as a countdown.
* Tests: `src/core/phalanx.test.ts` (range over galaxies and systems
  without wrap, the reach and the price, the legs of a returning, recalled
  and gift fleet, with properties), `src/server/game/phalanx.test.ts` (the
  action: flights by arrival, the charge also for an empty scan, every
  refusal free, due fleets first, a recall, no report and no push, the
  audit detail, the range as a property), `src/server/http/app.test.ts`
  (`data` beside the state), `src/client/logic/phalanx.test.ts`,
  `src/client/logic/act.test.ts` (`answer`), `src/client/views/galaxy.test.ts`
  (button and panel), the catalog, naming, text, icon and key tests; E2E
  `e2e/phalanx.spec.ts` (the building on the moon after the Mondzitadelle,
  the scan of an empty planet for 5,000 Promethium, a flight from the moon
  in the panel, „Schließen“ with the focus, the refusal without
  Promethium, the panel on a phone with axe and the width check) with axe
  on the panel.

# Mission „Mondbruch“ (#95)

Issue #95, split off from #60 (owner, 2026-11-12); clarified 2026-11-13 with
owiki.de „Mond“ (section Zerstörung, formula images). Built after the moons.

* **[E]** Name „Mondbruch“ (classic „Zerstören“), grimdark style of #127
  (owner, 2026-11-13).
* **[E]** The fleet needs at least one Weltenbrecher; other ships fly along
  and fight (owner, 2026-11-13). Only against a moon.
* **[E]** The fleet first fights the fleet and defense of the moon; only
  after a won battle (or an undefended moon) the rolls follow. Two
  independent rolls (owiki.de, owner, 2026-11-13):
  * moon destroyed with min(100, (100 − √d) · √n) %, d the diameter in km,
    n the Weltenbrecher of the fleet;
  * the Weltenbrecher of the fleet are lost with √d / 2 %; the other ships
    stay.
  Example: 4,000 km and one Weltenbrecher: 36.75 % and 31.6 %.
* **[E]** No debris from a destroyed moon or from lost Weltenbrecher; fleets
  flying to a destroyed moon land at its planet (owiki.de, owner,
  2026-11-13).
* **[E]** Reports (owner, 2026-11-13, proposal A): „Der Mond ist zerbrochen
  (Chance x %).“, „Der Mond hält stand (Chance x %).“, „Die Weltenbrecher
  wurden vom eigenen Schuss zerrissen (Chance y %).“; for the owner „Dein
  Mond bei [g:s:p] wurde zerstört.“

# Out of scope

* Giving up a moon on its own, tearing down a moon. Abfangraketen are
  decided with #54 ([Missiles](/features/missiles.md)); a moon is lost
  with its given-up colony (owner, 2026-11-16, #224 Q1,
  [Abandon a colony](/features/abandon-colony.md)).
