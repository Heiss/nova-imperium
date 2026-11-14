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
  and of the moon are proposed in the pull requests.

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
  nothing.
* Fields: `maxFields` gives a moon 1 field plus the `fields` of its
  buildings, without the diameter and the „Zusatzfelder pro Planet“.
* Production: `baseIncome(kind)` in `src/core/components/produces.ts`, none
  on a moon; `prod()` reads the kind, so the resources page shows 0 as
  base income there. The Sonnenreliquiare give energy by the moon's
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
  `src/client/views/galaxy.test.ts`; `missions-reference.test.ts` has the
  moon rule in its frozen reference, written there on its own (chance of
  the whole field, the draw, the diameter, the moon row and the report
  fields), compares everything bit for bit and checks that its generated
  battles roll chances and form moons; E2E `e2e/moons.spec.ts` (the admin's
  „Mond anlegen“ and the moon's actions on the Sternenkarte, the moon as an
  own place with its buildings, fields and no base income, a Verlegung to
  the own moon, the moon chance in a battle report, the moon on a phone)
  and axe on the Sternenkarte with an open moon, the fleet form, the moon's
  overview, buildings and resources and the player record.
* A moon from a battle forms by chance only; the E2E tests check the line
  „Mondchance“ of a real battle and make moons with the admin or
  `e2e/seed.ts` (option `moon`); the sentence about the Trabant is checked
  by the unit tests of the report and the attack.

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

* Abfangraketen (#54), giving up or tearing down a moon.
