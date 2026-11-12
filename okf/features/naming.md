---
type: feature
title: Grimdark naming
description: The rename of all display names to a dark sci-fi style, its timing at the end of the release, the owner's decisions and the proposed names.
---

# Grimdark naming

Source: the owner's package `nova-imperium-40k` (`texte-40k.json`,
`apply-40k-texts.mjs`, README, 2026-11-10), given to Claude on 2026-11-12.
The branch `claude/grimdark-naming` applies it after #123, #121 and #125
were merged (owner, 2026-11-12); see „Applied“ below. The script
`apply-40k-texts.mjs` was not run or reviewed.

* **[E]** Timing: the features of the milestone `next release` (#46, #47,
  #49, #50) are built with their classic names. At the end of the release one
  pull request renames every entry at once, so the game never shows mixed
  names (owner, 2026-11-12). Issue: see the milestone `next release`.
* **[E]** The rename pull request also brings the long explanation texts of
  #63 in the grimdark style, drafted by Claude as [V] for the owner to confirm
  ([Explanation texts](/features/explanation-texts.md), owner, 2026-11-12).
* **[E]** Only display texts change (`n`, `ab`, `ds`, icon `<title>` and
  `aria-label`, interface texts). Keys, game values, database columns and API
  fields stay (package README).
* **[E]** No protected Games Workshop names („Imperator“, „Space Marines“,
  „Adeptus …“ and the like) (package README).
* **[E]** Solarsatellit (#46) → „Sonnenreliquiar“, as in the package, although
  „Reliquiar“ is also the crystal storage (owner, 2026-11-12).
* **[E]** Fusionskraftwerk (#47) → „Fusionssanktum“, not the package's
  „Plasmareaktor-Sanktum“, because „Plasma“ is the Plasmatechnik line (owner,
  2026-11-12).
* **[U]** Whether words like „Auspex“, „Promethium“ or „Servitor“ are free to
  use was not checked legally.
* **[E]** All proposed names of the package below are taken over, including
  those of the new entries of this release and the Nanitenfabrik
  („Machina-Schwarmhalle“) (owner, 2026-11-12).
* **[E]** Abbreviations of the 15 new entries as in the table below; every
  abbreviation stays unique, checked by a unit test (owner, 2026-11-12).
* **[E]** Missions and interface texts as proposed. „Sternenkarte“ is only
  the name of the menu entry and the page; „Galaxie“ stays as the coordinate
  (for example „Galaxie 1“). „Allianz → Gilde“ is void: the game already says
  „Gilde“ (owner, 2026-11-12). The `MISSION` values are display texts only;
  the stored ids are the keys.
* **[E]** The rename is done by hand in a reviewed diff, with the values of
  this concept as data. The package script `apply-40k-texts.mjs` is not used
  (owner, 2026-11-12).

## Names [E]

Resources: Metall → Adamant, Kristall → Psikristall, Deuterium → Promethium,
Energie stays.

| Key | Classic | Proposed | `ab` |
|---|---|---|---|
| metal | Metallmine | Adamant-Tiefbohrung | AT |
| crystal | Kristallmine | Psikristall-Steinbruch | PS |
| deut | Deuteriumsynthetisierer | Promethium-Raffinerie | PR |
| solar | Solarkraftwerk | Sonnenkathedrale | SK |
| robot | Roboterfabrik | Servitorenschmiede | SF |
| nanite | Nanitenfabrik | Machina-Schwarmhalle | MS |
| yard | Raumschiffwerft | Orbitale Schiffsschmiede | OS |
| lab | Forschungslabor | Scholarium | SC |
| smetal | Metallspeicher | Adamant-Gewölbe | AG |
| scrystal | Kristallspeicher | Psikristall-Reliquiar | RQ |
| sdeut | Deuteriumtank | Promethium-Zisterne | PZ |
| energy | Energietechnik | Machina-Energetik | ME |
| laser | Lasertechnik | Lichtlanzen-Lehre | LZ |
| comb | Verbrennungstriebwerk | Promethium-Brennkammer | PB |
| impulse | Impulstriebwerk | Plasma-Impulsantrieb | PI |
| hyper | Hyperraumtechnik | Warp-Theorie | WT |
| hdrive | Hyperraumantrieb | Warp-Antrieb | WA |
| spy | Spionagetechnik | Auspex-Lehre | AU |
| computer | Computertechnik | Kogitator-Doktrin | KD |
| weapons | Waffentechnik | Waffensegnung | WS |
| shield | Schildtechnik | Refraktionsfelder | RE |
| armor | Raumschiffpanzerung | Adamant-Panzerung | AP |
| sc | Kleiner Transporter | Frachtläufer | FL |
| lc | Großer Transporter | Lastbarke | LB |
| colony | Kolonialschiff | Kolonistenarche | KA |
| lf | Leichter Jäger | Abfangjäger | AJ |
| hf | Schwerer Jäger | Sturmjäger | SJ |
| cr | Kreuzer | Fregatte | FR |
| bs | Schlachtschiff | Kathedralschiff | KS |
| probe | Spionagesonde | Spähschädel | SP |
| rl | Raketenwerfer | Raketenbatterie | RB |
| ll | Leichtes Lasergeschütz | Lichtlanze | LI |
| hl | Schweres Lasergeschütz | Schwere Lichtlanze | SL |
| gauss | Gaußkanone | Massebeschleuniger | MB |

New entries of this release **[E]**:

| Issue | Classic | Name | `ab` |
|---|---|---|---|
| #46 | Solarsatellit | Sonnenreliquiar | SR |
| #47 | Fusionskraftwerk | Fusionssanktum | FS |
| #48 | Nanitenfabrik | Machina-Schwarmhalle | MS |
| #49 | Ionentechnik | Ionen-Lehre | IL |
| #49 | Plasmatechnik | Plasma-Lehre | PL |
| #49 | Gravitonforschung | Gravitonen-Mysterium | GM |
| #49 | Intergalaktisches Forschungsnetzwerk | Sternennetz der Gelehrten | SN |
| #50 | Ionengeschütz | Ionenlanze | IN |
| #50 | Plasmawerfer | Plasmabatterie | PA |
| #50 | Kleine Schildkuppel | Kleiner Schutzdom | SD |
| #50 | Große Schildkuppel | Großer Schutzdom | GD |
| #58 | Schlachtkreuzer | Jagdkreuzer | JK |
| #59 | Zerstörer | Vernichter | VN |
| #57 | Bomber | Belagerungsbomber | BB |
| #60 | Todesstern | Weltenbrecher | WB |

Missions (only if `MISSION` values are display texts, not stored ids):
attack → Sturmangriff, transport → Versorgungsflug, spy → Auspex-Erkundung,
colonize → Landnahme.

Interface texts: „Nicht genug Rohstoffe“ → „Der Zehnte reicht nicht aus.“,
„Voraussetzungen fehlen“ → „Das Wissen ist noch verschlossen.“, „Bau
abgeschlossen“ → „Das Werk ist vollbracht.“, „Flotte zurückgekehrt“ → „Die
Flotte kehrt heim.“, „Spionagebericht“ → „Auspex-Bericht“, „Trümmerfeld“ →
„Wrackfeld“, „Galaxie“ → „Sternenkarte“, „Allianz“ → „Gilde“, „Angriff“ →
„Feindkontakt! Zu den Waffen!“.

Later issues (#45, #51–#55), [V]: Bergungsbarke, Bergung, Weltenformer,
Gartenwelt, Ozeanwelt, Dschungelwelt, Ödwelt, Wüstenwelt, Eiswelt, Gasriese,
Mondfeste, Auspex-Phalanx, Warp-Tor, Raketenkrypta, Abfangrakete,
Orbitalrakete, Gildenarsenal, Wacht halten;
Expeditionstechnik → Kreuzzugs-Kartografie (package order).

## Applied (#94)

Done by hand on the branch `claude/grimdark-naming` (2026-11-12), with the
tables above as data; keys, game values, database columns, API fields and
stored mission ids stay.

* Catalog (`src/shared/catalog.ts`): `n` and `ab` of all 48 entries,
  `MISSION` display texts (the stored ids are the keys; `fleet-actions.ts`
  checks the key, `overview.ts` and the fleet form show the value).
* Resources everywhere in the interface: resource bar, costs, cargo,
  production table, reports, rewards, the fuel line, the admin labels
  „Start-Adamant“, „Start-Psikristall“, „Start-Promethium“.
* Interface texts of the table: „Der Zehnte reicht nicht aus.“ (server),
  „Das Wissen ist noch verschlossen.“ (server; without the period in the
  lists, as before), „Die Flotte kehrt heim“ (menu mark of the fleet),
  „Auspex-Bericht von …“ (report title), „Sternenkarte“ (menu entry and
  page heading only; „Galaxie“ stays as the coordinate, also in the fleet
  form, the admin settings and the help text „Galaxien × Systeme“).
* Icons: `<title>` and `aria-label` of every catalog and resource icon.
* **[V]** Short forms the concept does not list, renamed the same way:
  Werft → Schiffsschmiede (menu entry „Schiffsschmiede“, lock and busy
  messages, „Bauauftrag der Schiffsschmiede“, overview row, admin
  diagnostics, achievement category), Labor/Labore → Scholarium/Scholarien
  (lab messages, research view), Sonden → Spähschädel (help option, galaxy
  hint, spy report, server messages), Solarsatelliten → Sonnenreliquiare
  (production row, server message), „je Satellit“ → „je Reliquiar“,
  Intergalaktisches Forschungsnetzwerk → Sternennetz der Gelehrten
  (research view), Computertechnik → Kogitator-Doktrin (fleet slots hint,
  help), Kolonialschiff → Kolonistenarche (colony report, server message),
  „Spionage nur mit Spionagesonden.“ → „Auspex-Erkundung nur mit
  Spähschädeln.“, „Deuteriumverbrauch“ → „Promethiumverbrauch“,
  „Werftauftrag fertig/abgeschlossen“ → „Auftrag der Schiffsschmiede
  fertig/abgeschlossen“ (menu mark, push title), „Werftaufträge erteilen“ →
  „Aufträge an die Schiffsschmiede erteilen“ (achievements), „Diese
  Schildkuppel …“ → „Diesen Schutzdom gibt es nur einmal pro Planet.“, the
  galaxy links Kolonisieren/Spionieren/Angreifen/Transport → the mission
  names, the help text „Angriffen und Auspex-Erkundungen … auf der
  Sternenkarte“, and the unreleased changelog fragments in `changes/`.
* **[E]** Decided by the owner for the open cases (2026-11-12):
  * „Bau abgeschlossen“: the push title of a finished building is „Das Werk
    ist vollbracht“ (was „Ausbau abgeschlossen“; the push has no body with
    planet or building). „Forschung abgeschlossen“ stays.
  * „Angriff“: the defender's battle report title is „Feindkontakt!
    ‹Planet› ‹Koordinaten› wird von ‹Spieler› angegriffen“ (was „Angriff
    auf ‹Planet› ‹Koordinaten› durch ‹Spieler›“). No code matches it: account
    deletion finds battle reports by the names in their body (`attName`,
    `defName`), so old and new titles go alike; a test proves both.
  * Short forms confirmed: Werft → Schiffsschmiede, Labor → Scholarium,
    „Auftrag der Schiffsschmiede“, no period in list and menu marks.
  * „Spionageaktivität“ → „Auspex-Aktivität“ (report title of the spied
    player), „Spionageabwehr“ → „Auspex-Abwehr“ (report texts). Account
    deletion (`delete-account.ts`) matches both titles, so reports stored
    before the rename still go with the account; a test with an old-title
    report proves it. This is the only classic word the naming test allows
    (`ALLOWED` in `src/test/naming.test.ts`).
* „Trümmerfeld“ does not exist yet (#45). `CHANGELOG.md` keeps its
  released sections and the design mockups in `docs/design/` keep the
  classic names.
* Tests: `src/test/naming.ts` holds the tables; `src/test/naming.test.ts`
  checks that no catalog text, mission, interface or server string literal
  (read with the TypeScript parser), Svelte text, attribute or literal (read
  with the Svelte parser, comments and styles left out) or icon shows a
  classic word (names, resources, the short
  forms above, the interface texts of the table); `catalog.test.ts`
  compares every game value with version 1 exactly and the names, `ab` and
  short texts through the table; `equivalence.test.ts` maps the requirement
  names of version 1 through the table; `icons.test.ts` checks `<title>`
  and `aria-label` against the catalog.

### Short texts [V]

Pure name swaps (Metall → Adamant and so on) are not listed. Changed beyond
the names:

* `comb`: „+10 % Geschwindigkeit pro Stufe (Transporter, Jäger, Sonden).“ →
  „+10 % Geschwindigkeit pro Stufe (Frachtläufer, Lastbarken, Abfangjäger,
  Spähschädel).“ (the Sturmjäger flies with the Plasma-Impulsantrieb).
* `impulse`: „+20 % pro Stufe (Schwere Jäger, Kreuzer).“ → „+20 % pro Stufe
  (Kolonistenarchen, Sturmjäger, Fregatten; Belagerungsbomber bis
  Warp-Antrieb 8).“
* `hdrive`: „+30 % pro Stufe (Schlachtschiffe).“ → „+30 % pro Stufe
  (Kathedralschiffe, Jagdkreuzer, Vernichter, Weltenbrecher;
  Belagerungsbomber ab Stufe 8).“ (also wrong before).
* `hyper`: „Erschließt den Hyperraum.“ → „Erschließt den Warp.“
* `spy`: „Bessere Spionageberichte, bessere Abwehr.“ → „Bessere
  Auspex-Berichte, bessere Abwehr.“
* `bc`: „Schnell und stark gegen Transporter, Kreuzer und Schlachtschiffe.“
  → „Schnell und stark gegen Frachtläufer, Lastbarken, Fregatten und
  Kathedralschiffe.“
* `bb`: „Stark gegen Raketenwerfer, Laser- und Ionengeschütze; fliegt ab
  Hyperraumantrieb 8 mit dem Hyperraumantrieb.“ → „Stark gegen
  Raketenbatterien, Lichtlanzen und Ionenlanzen; fliegt ab Warp-Antrieb 8
  mit dem Warp-Antrieb.“

## Long texts

* **[E]** Content rule, replaces the one of #63 for all 48 entries (owner,
  2026-11-12): two paragraphs. The first is one or two sentences of lore;
  the second starts with „So funktioniert es:“ and explains the mechanics
  precisely in words: what the entry affects and where (this planet or all
  planets), what a further level or more units change, lock rules, what it
  unlocks; for ships and defense their role, drive, cargo and fuel, rapid
  fire in both directions, shots that bounce off a shield, rebuilding after
  a battle, once per planet.
* **[E]** Only words, no numbers and no formulas (owner: „nur Worte, keine
  Zahlen“), so nothing goes stale; no exact factors either. Every statement
  is checked against the code (`economy.ts`, `research.ts`, `flight.ts`,
  `battle.ts`, `lab.ts`, `yard.ts`, `arrival.ts`, `fleet-actions.ts`,
  `actions.ts`).
* **[E]** The short `ds` stays a short, cost-free one-liner.
* **[E]** The panel shows the two paragraphs as two escaped `<p>`, split at
  the blank line (`paragraphs()` in `src/client/logic/explain.ts`).
* **[V]** Short and precise, not sprawling (owner, 2026-11-12): the lore
  exactly one sentence, the mechanics at most three sentences with only
  what a player needs to decide (what it affects and where, what a level
  changes, rapid fire in both directions, locks, once per planet), at most
  about 350 characters in all. Prerequisites are listed only where they
  are the point (Warp-Theorie, Lichtlanzen-, Ionen- and Plasma-Lehre,
  Gravitonen-Mysterium); „Eine Flotte fliegt so schnell wie ihr langsamstes
  Schiff“ only in the drive texts.
* **[V]** All 48 texts are drafts for the owner: the field `lt` of each
  entry in `src/shared/catalog.ts`, written again under these limits.
* Rapid fire is called „Schnellfeuer“ (explained once, in the Frachtläufer
  text); the rebuilt defense is „ein großer Teil“, for a dome „oft“.
* `src/shared/explain.test.ts` checks: every entry has a text (the list
  `LATER` is empty and may only shrink); exactly two paragraphs, the lore
  one sentence, the second starting with „So funktioniert es:“ and at most
  three sentences, at most 350 characters; no digit; plain text, other
  than `ds`; no classic name of this concept; no protected Games Workshop
  name.
