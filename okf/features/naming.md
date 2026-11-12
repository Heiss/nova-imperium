---
type: feature
title: Grimdark naming
description: The rename of all display names to a dark sci-fi style, its timing at the end of the release, the owner's decisions and the proposed names.
---

# Grimdark naming

Source: the owner's package `nova-imperium-40k` (`texte-40k.json`,
`apply-40k-texts.mjs`, README, 2026-11-10), given to Claude on 2026-11-12.
Nothing of it is applied on `main` yet; every catalog entry and icon title
still has its classic name. The script `apply-40k-texts.mjs` was not run or
reviewed. The branch `claude/grimdark-naming` prepares the rename: it brings
the long texts first (see „Long texts [V]“ below); the names follow after
#123 and #60 are merged (owner, 2026-11-12).

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

## Long texts [V]

Drafted by Claude on 2026-11-12 for the owner to confirm; the field `lt` of
every building, research, ship and defense entry on `main` in
`src/shared/catalog.ts` (43 entries) holds them. The panel of #63 shows `lt`
instead of the short `ds` ([Explanation texts](/features/explanation-texts.md)).

* Already with the new names of this concept, resources included (Adamant,
  Psikristall, Promethium), while `n`, `ab`, `ds`, keys, values, icons and
  interface texts stay classic until the rename.
* Content as decided for #63: lore, what the entry does, what a further
  level or more units change. Costs, times and energy values are not
  repeated; the texts have no numbers. Each statement was checked against
  the code (`economy.ts`, `research.ts`, `flight.ts`, `battle.ts`, `lab.ts`,
  `yard.ts`, `arrival.ts`, `fleet-actions.ts`).
* Plain text, two to four sentences, one paragraph. Rapid fire is called
  „Schnellfeuer“; the rebuilt defense after a battle is „ein großer Teil“.
* Not yet written, because the entries are not on `main`: Ionengeschütz
  (`ionc`), Plasmawerfer (`pt`), Kleine and Große Schildkuppel (`ssd`,
  `lsd`) of #50 and the Todesstern (`dstar`) of #60. The list `LATER` in
  `src/shared/explain.test.ts` names them and may only shrink.
* Texts that name other entries must change with them: Lichtlanzen-Lehre,
  Plasma-Lehre and Ionen-Lehre name what they unlock today, the defense
  texts and the ship texts name who has rapid fire against whom (the
  Ionengeschütz and the Todesstern add rapid fire).
* `src/shared/explain.test.ts` checks: every entry on `main` but `LATER`
  has a text; no text says a classic name this concept replaces (its own
  table, not read from this file); two to four sentences, plain text,
  other than `ds`; no protected Games Workshop name.
