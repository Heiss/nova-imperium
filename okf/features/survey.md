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
* **[E]** Follow-up on the build (owner, 2026-11-17, „Geklärt“ on #190):
  * the window at score 4 keeps its width (fields ± 20 %, temperature
    ± 10 °C) but is shifted at random: the true value is always inside it,
    not necessarily in its middle;
  * the German texts are confirmed as built: the mission „Vermessung“, the
    button „Vermessen“, the abbreviation „AK“, the report „Vermessungsbericht
    [g:s:p]“, the refusals „Vermessung erst mit Auspex-Kartographie.“ and
    „Vermessung nur mit Spähschädeln.“, the keywords „viele/wenige Felder“,
    „guter/schwacher Promethium-Faktor“ and „viel/wenig
    Sonnenreliquiar-Energie“, and the short and the long text of the
    research;
  * the rough report also gets the adjectives of D5 (temperature, orbit and
    size, e.g. „gemäßigter Planet in der mittleren Bahn, vermutlich groß“),
    by the bands below;
  * the 30 days count from the first survey; a later survey does not
    restart them;
  * lost probes fix no values; only a survey that brings back a report
    fixes them.
* **[E]** The adjectives of the rough report (owner, 2026-11-17, second
  „Geklärt“ of the day, the classic position bands):
  * positions 1–3: „innere Bahn“, „heiß“; 4–12: „mittlere Bahn“,
    „gemäßigt“; 13–15: „äußere Bahn“, „kalt“;
  * the size „klein“, „mittelgroß“ or „groß“ by thirds of the field range
    96–252 (#51), marked „vermutlich“ as in the owner's example.

## Built

* The mission „Vermessung“ (**[E]** the name, confirmed 2026-11-17) is the folder
  `src/features/missions/survey/` (order 70, target `free`, no cargo,
  returns, not visible, silent like the Auspex-Erkundung). `canSend`
  returns `surveyLocked` without level 1 of the research, then
  `surveyProbesOnly` for any ship other than a Spähschädel; `SendFleet`
  carries the research of the owner for it. The server words them
  „Vermessung erst mit Auspex-Kartographie.“ and „Vermessung nur mit
  Spähschädeln.“ **[E]** (confirmed 2026-11-17; `SEND_ERROR`, see
  [Checks of the server actions](/architecture/action-checks.md)).
* The research is the entry `src/features/carto/` (key `carto`, order 160,
  after the IFN) with the values of D4. **[V]** The key `carto` instead of
  `survey`: a research named like the mission would make the report type
  „survey“ a comparison with a catalog key (`src/test/catalog-keys.test.ts`).
  **[E]** Abbreviation „AK“ and the short and the long text (confirmed
  2026-11-17); **[V]** the picture (the one of the Auspex-Lehre with its
  own name until one is drawn).
* `src/core/survey.ts` holds the rules: `surveyScore`, `surveyTier`
  (`rough`, `near`, `exact`, `full`), `maxLoss`, `surveyLost` (two draws:
  the chance, then the roll), `rollTemp` (the temperature rule of a new
  colony, `130 − (p − 1) · 10 ± 10`, moved out of `createPlanet` unchanged),
  `nearShift` (where the true value lies in each window of score 4) and
  `surveyFindings`, what a report of a tier holds. The tests check the
  owner's table of revision 2 to the percent. `tempFactor` (the factor of
  the Promethium-Raffinerie) moved into `src/core/rates.ts` and the entry
  `deut` uses it, same arithmetic.
* The arrival (`arrive.server.ts`): the loss is rolled first; lost probes
  are deleted without a report and without values (D7). Otherwise the
  position gets its values at the first survey (temperature and diameter
  with the rules of a new colony, `created` = the arrival, kept by a later
  survey), the owner gets the report „Vermessungsbericht [g:s:p]“ **[E]**
  (push topic `fleet`) and the probes fly back. The level is the one at the arrival (`settleR`).
* `createPlanet` uses the stored values of the position and deletes them.
  **[E]** This also applies to a new home planet placed on a surveyed
  position (owner, 2026-11-18): its temperature is the stored one, its
  diameter stays the one of a home planet. A position without a survey draws as before.
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
  * rough: „Vermessung [1:42:9] – Messung ungenau. Gemäßigter Planet in
    der mittleren Bahn, vermutlich mittelgroß. Position 9: 150–246 Felder,
    Temperatur um 50 °C. Planetentyp: Dschungelplanet.“ **[V]** The value
    of „Temperatur um“ is the middle of the maximum temperature of the
    position, `130 − (p − 1) · 10`.
  * The adjectives **[E]** by the owner's bands: `orbitOf` and `sizeOf` in
    `src/core/survey.ts`, stored in the findings as `orbit` (`inner`,
    `middle`, `outer`, which also names the temperature) and `size`
    (`small`, `medium`, `large`); the browser words them (`ORBIT`, `SIZE`).
    **[V]** Taken as recommended:
    * **[E]** (owner, 2026-11-18) the size is guessed from the average
      fields of the position (D5: what the position lets one guess), not
      from the planet's own fields, so position 9 is „mittelgroß“;
    * each third holds its lower end: „klein“ below 148, „mittelgroß“ from
      148 below 200, „groß“ from 200 (positions 1–3 and 13–15 klein, 4–6
      and 9–12 mittelgroß, 7 and 8 groß);
    * a universe with more than 15 positions (the setting allows 12 to 20)
      scales the bands proportionally: a fifth of the positions inner,
      three fifths middle, a fifth outer (20 positions: 1–4, 5–16, 17–20);
      with 15 or fewer the classic bands hold. A position above 15 has the
      field range of position 15 (#51), so it is „klein“;
    * the sentence stands after „Messung ungenau.“, and only the rough
      report has it.
  * from score 4 and 7 **[V]**: the rough line and a table „Felder“,
    „Temperatur“, „Planetentyp“; at 4 „ca. 170–256“ (a window of 40 % of
    the fields, rounded) and „ca. 22 °C bis 82 °C“ (a window of 20 °C of the
    maximum temperature, the planet spans 40 °C below it as in the
    overview), at 7 the exact values.
  * **[E]** The windows of score 4 (owner, 2026-11-17) keep their width and
    are shifted at random: the server draws, when it makes the report, the
    share of each window below the true value between 0 and 1 and stores
    the report with the ends of the windows, so a reload shows the same
    window. Both ends are rounded; the values are whole numbers, so the
    true value stays inside. **[V]** One draw per window (fields and
    temperature apart); the shift itself is not stored, since with the
    window it would tell the true value.
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
    refuses (#94). **[E]** The keywords themselves are confirmed
    (2026-11-17).
* **[V]** Sternenkarte: a button „Vermessen“ (**[E]** the text, confirmed
  2026-11-17) at a free position when the
  shown planet has Spähschädel and the player has level 1 of the research,
  between „Landnahme“ and „Bergung“; it sends the number of Spähschädel of
  the option „Spähschädel pro Auspex-Erkundung“ (at most those on the
  planet), like the link „Auspex-Erkundung“. The fleet form offers the
  mission as the last one.
* **[V]** Lexicanum (#291): the research and the mission have an article
  each, `src/features/carto/lexicon.de.ts` (keywords, „Siehe auch“ the
  mission) and `src/features/missions/survey/lexicon.de.ts` (the text of
  the arrival with the 30 days from `SURVEY_DAYS`, keywords); the words are
  drafts in [Lexicanum texts](/features/lexicanum-texts.md).
* Tests: `src/core/survey.test.ts` (score, tiers, the loss table, the
  temperature rule, the findings, the orbits and their scaling with a
  property test, the size thirds, the shifted windows with fixed draws,
  property test: the true value is inside a window of its width for every
  shift, ranges hold every possible planet),
  `src/features/missions/survey/survey.test.ts` (send checks and messages,
  every tier, the orbit with the positions of the universe, the windows
  drawn once at the arrival and stored, research
  finished at the arrival, loss without report, more
  loss farther away, values kept, property test: survey then colonize gives
  the same values, the 30-day cleanup), the repository, the upgrade test,
  the Sternenkarte and the words of the report, and the E2E test
  `e2e/survey.spec.ts`.

## Open

* The star map does not mark surveyed positions yet (#160), and the field
  properties come with #158.
* **[E]** A position locked after an abandonment (#224) cannot be
  surveyed (owner, 2026-11-18, „Geklärt“ on #190): the Vermessung is refused
  like the Landnahme, because the mission's target kind is `free`: at the
  send with „Diese Position ist gesperrt. Wieder besiedelbar ab …“
  (`positionLockedText`), at the arrival the fleet turns back with the
  notice „Flotte kehrt um“, no values stored and no report (a test pins it
  in `src/features/missions/survey/survey.test.ts`). The Sternenkarte hides
  „Vermessen“ there under the same condition as „Landnahme“
  (`galaxyRow` in `src/client/logic/galaxy.ts`); the Bergung button of a
  Trümmerfeld at that position stays.
