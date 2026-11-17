---
type: feature
title: Surveying free positions, the mission „Vermessung“ and „Auspex-Kartographie“
description: Spähschädel survey a free position before a colony ship is sent; the report shows more with more probes and research, the probes can be lost, and the values of the position are fixed for the colony (issue #190).
---

# Surveying free positions

Issue #190, milestone `next release` (owner, 2026-11-17, before „planned
release“). The rules are the owner's comment „Geklärt“ of 2026-11-14
(D1 to D7), which replaces the proposals of the issue body; the loss formula
is the owner's „Revision 2“ of the same day. Not a classic rule: an own
extension of this game.

## Decisions

* **[E]** A player can survey a free position with Spähschädel before
  sending a Kolonistenarche (owner, 2026-11-14). It works like the
  espionage of players, harder: what the report shows is fixed by a score,
  the loss is random.
* **[E]** D1 – Values: a free position gets its values (temperature,
  diameter and with it the fields; later the field properties of #158) at
  its first survey and keeps them; a colony founded there uses them. If
  nobody colonizes the position, its values and the reports are deleted
  after **30 days**; a later survey rolls new values.
* **[E]** D2 – Report and loss:
  * score = probes + 2 · L, L the level of „Auspex-Kartographie“; without
    level 1 the mission is not available;
  * below 4: the rough report; 4: fields ± 20 %, temperature ± 10 °C; 7:
    exact fields and temperature; 10: the full report;
  * loss: a chance drawn at random between 0 and
    `min(60 %, probes · 5 % / L + 6 % · (distance / 1000)^0.8 / (1 + 0.4 · L))`,
    rolled once for the fleet; distance = `distance()` of
    `src/core/flight.ts`.
* **[E]** D3 – Numbers: as in D2 (replaces the q-per-probe formula of the
  issue body).
* **[E]** D4 – Research „Auspex-Kartographie“: several levels; requires
  Scholarium 3, Auspex-Lehre (Spionagetechnik) 2 and Plasma-Impulsantrieb
  (Impulstriebwerk) 3; level 1 costs 1,000 Adamant, 2,000 Psikristall and
  1,000 Promethium, factor 2.
* **[E]** D5 – Rough report: like an espionage report with one probe: a
  text with what the position lets one guess (the field range of the
  position, the temperature around a value, the planet type), marked
  „Messung ungenau“.
* **[E]** D6 – Full report: everything known about the planet: the
  temperature range, diameter and fields compared with the range and
  average of the position, the planet type, the Promethium factor, the
  energy per Sonnenreliquiar, benefits and drawbacks as keywords; later the
  field properties and their distribution (#158).
* **[E]** D7 – Lost probes: no report.
* **[E]** The position production bonuses of modern OGame are not rules of
  this game; the report shows the values this game has.

## Built

* **[V]** The mission „Vermessung“ (name of the issue body) is the folder
  `src/features/missions/survey/` (order 70, target `free`, no cargo,
  returns, not visible, silent like the Auspex-Erkundung). `canSend`
  returns `surveyLocked` without level 1 of the research, then
  `surveyProbesOnly` for any ship other than a Spähschädel; `SendFleet`
  carries the research of the owner for it. The server words them
  „Vermessung erst mit Auspex-Kartographie.“ and „Vermessung nur mit
  Spähschädeln.“ **[V]** (`SEND_ERROR`, see
  [Checks of the server actions](/architecture/action-checks.md)).
* The research is the entry `src/features/carto/` (key `carto`, order 160,
  after the IFN) with the values of D4. **[V]** The key `carto` instead of
  `survey`: a research named like the mission would make the report type
  „survey“ a comparison with a catalog key (`src/test/catalog-keys.test.ts`).
  **[V]** Abbreviation „AK“, the short and the long text, and the picture
  (the one of the Auspex-Lehre with its own name until one is drawn).
* `src/core/survey.ts` holds the rules: `surveyScore`, `surveyTier`
  (`rough`, `near`, `exact`, `full`), `maxLoss`, `surveyLost` (two draws:
  the chance, then the roll), `rollTemp` (the temperature rule of a new
  colony, `130 − (p − 1) · 10 ± 10`, moved out of `createPlanet` unchanged)
  and `surveyFindings`, what a report of a tier holds. The tests check the
  owner's table of revision 2 to the percent. `tempFactor` (the factor of
  the Promethium-Raffinerie) moved into `src/core/rates.ts` and the entry
  `deut` uses it, same arithmetic.
* The arrival (`arrive.server.ts`): the loss is rolled first; lost probes
  are deleted without a report and without values (D7). Otherwise the
  position gets its values at the first survey (temperature and diameter
  with the rules of a new colony, `created` = the arrival), the owner gets
  the report „Vermessungsbericht [g:s:p]“ (push topic `fleet`) and the
  probes fly back. The level is the one at the arrival (`settleR`).
* `createPlanet` uses the stored values of the position and deletes them.
  **[V]** This also applies to a new home planet placed on a surveyed
  position: its temperature is the stored one, its diameter stays the one
  of a home planet. A position without a survey draws as before.
* D1 cleanup: `purgeSurveys` (`src/server/game/surveys.ts`) runs in the
  hourly sweep beside the audit retention and deletes the surveys older than
  30 days with every survey report that names them (`reports.deleteSurveys`).
  Reports of a position that was colonized stay. **[V]** A new round deletes
  the surveys too.
* Database: migration `20261117T1211-planet-survey`
  (`src/server/db/migrations/190/`) rebuilds `fleets` and `fleet_ships` for
  the mission and `reports` for the type `survey`, every row unchanged, and
  adds `surveys (id, g, s, p, temp, diameter, created, UNIQUE (g, s, p))`.
* Report: the server stores the findings, the browser words them
  (`src/client/logic/survey.ts`), like the espionage report:
  * rough: „Vermessung [1:42:9] – Messung ungenau. Position 9: 150–246
    Felder, Temperatur um 50 °C. Planetentyp: Dschungelplanet.“ **[V]** The
    wording follows the owner's example of D5 without the adjectives („ein
    gemäßigter Planet in der mittleren Bahn, vermutlich groß“), which no
    rule defines; the value of „Temperatur um“ is the middle of the maximum
    temperature of the position, `130 − (p − 1) · 10`.
  * from score 4 and 7 **[V]**: the rough line and a table „Felder“,
    „Temperatur“, „Planetentyp“; at 4 „ca. 170–256“ (fields ± 20 %,
    rounded) and „ca. 22 °C bis 82 °C“ (the maximum temperature ± 10 °C,
    the planet spans 40 °C below it as in the overview), at 7 the exact
    values. The ranges are centred on the true value, as D2 says.
  * full: the table of the issue **[V]** „Temperatur“ („32 °C bis 72 °C“),
    „Durchmesser“, „Felder“ with the range and average of the position and
    „überdurchschnittlich“, **[V]** „durchschnittlich“ or
    „unterdurchschnittlich“, „Planetentyp“, „Promethium-Faktor“ („×1,14“),
    „Energie je Sonnenreliquiar“, **[V]** „Vorteile“ and „Nachteile“.
  * **[V]** Benefits and drawbacks against the position: more fields than
    its average „viele Felder“, fewer „wenige Felder“; cooler than the
    middle temperature „guter Promethium-Faktor“ and „wenig
    Sonnenreliquiar-Energie“, warmer „viel Sonnenreliquiar-Energie“ and
    „schwacher Promethium-Faktor“. The owner's example „wenig
    Solarsatelliten-Energie“ uses the classic name, which the naming test
    refuses (#94).
* **[V]** Sternenkarte: a button „Vermessen“ at a free position when the
  shown planet has Spähschädel and the player has level 1 of the research,
  between „Landnahme“ and „Bergung“; it sends the number of Spähschädel of
  the option „Spähschädel pro Auspex-Erkundung“ (at most those on the
  planet), like the link „Auspex-Erkundung“. The fleet form offers the
  mission as the last one.
* Tests: `src/core/survey.test.ts` (score, tiers, the loss table, the
  temperature rule, the findings, ranges hold every possible planet),
  `src/features/missions/survey/survey.test.ts` (send checks and messages,
  every tier, research finished at the arrival, loss without report, more
  loss farther away, values kept, property test: survey then colonize gives
  the same values, the 30-day cleanup), the repository, the upgrade test,
  the Sternenkarte and the words of the report, and the E2E test
  `e2e/survey.spec.ts`.

## Open

* The star map does not mark surveyed positions yet (#160), and the field
  properties come with #158.
