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
reviewed.

* **[E]** Timing: the features of the milestone `next release` (#46, #47,
  #49, #50) are built with their classic names. At the end of the release one
  pull request renames every entry at once, so the game never shows mixed
  names (owner, 2026-11-12). Issue: see the milestone `next release`.
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
* **[V]** Gaps of the package: the Nanitenfabrik (#48, built in #71) is only
  in its planned list, not in `BUILD`, so the script would leave it classic;
  the ten new entries of this release have no abbreviation (`ab`) yet. The
  abbreviations must stay unique.

## Proposed names [V]

Resources: Metall → Adamant, Kristall → Psikristall, Deuterium → Promethium,
Energie stays.

| Key | Classic | Proposed | `ab` |
|---|---|---|---|
| metal | Metallmine | Adamant-Tiefbohrung | AT |
| crystal | Kristallmine | Psikristall-Steinbruch | PS |
| deut | Deuteriumsynthetisierer | Promethium-Raffinerie | PR |
| solar | Solarkraftwerk | Sonnenkathedrale | SK |
| robot | Roboterfabrik | Servitorenschmiede | SF |
| nanite | Nanitenfabrik | Machina-Schwarmhalle | – |
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

New entries of this release (`ab` open):

| Issue | Classic | Name |
|---|---|---|
| #46 | Solarsatellit | Sonnenreliquiar **[E]** |
| #47 | Fusionskraftwerk | Fusionssanktum **[E]** |
| #49 | Ionentechnik / Plasmatechnik / Gravitonforschung | Ionen-Lehre / Plasma-Lehre / Gravitonen-Mysterium |
| #50 | Ionengeschütz / Plasmawerfer | Ionenlanze / Plasmabatterie |
| #50 | Kleine / Große Schildkuppel | Kleiner / Großer Schutzdom |

Missions (only if `MISSION` values are display texts, not stored ids):
attack → Sturmangriff, transport → Versorgungsflug, spy → Auspex-Erkundung,
colonize → Landnahme.

Interface texts: „Nicht genug Rohstoffe“ → „Der Zehnte reicht nicht aus.“,
„Voraussetzungen fehlen“ → „Das Wissen ist noch verschlossen.“, „Bau
abgeschlossen“ → „Das Werk ist vollbracht.“, „Flotte zurückgekehrt“ → „Die
Flotte kehrt heim.“, „Spionagebericht“ → „Auspex-Bericht“, „Trümmerfeld“ →
„Wrackfeld“, „Galaxie“ → „Sternenkarte“, „Allianz“ → „Gilde“, „Angriff“ →
„Feindkontakt! Zu den Waffen!“.

Later issues (#45, #51–#60): Bergungsbarke, Bergung, Weltenformer,
Gartenwelt, Ozeanwelt, Dschungelwelt, Ödwelt, Wüstenwelt, Eiswelt, Gasriese,
Mondfeste, Auspex-Phalanx, Warp-Tor, Raketenkrypta, Abfangrakete,
Orbitalrakete, Gildenarsenal, Wacht halten, Belagerungsbomber, Jagdkreuzer,
Vernichter, Weltenbrecher; IFN → Sternennetz der Gelehrten, Expeditionstechnik
→ Kreuzzugs-Kartografie (package order).
