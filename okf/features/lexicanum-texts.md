---
type: feature
title: Lexicanum texts
description: The review list of the texts of the Lexicanum that Claude drafted for the owner to confirm or change (issue #285, owner 2026-11-17) - per article the words before the formulas, the text of a mission and the keywords of the search.
---

# Lexicanum texts

Issue #285 („Geklärt“, owner, 2026-11-17, on the build of stage 1): Claude
drafts the texts the articles of the [Lexicanum](/features/lexicanum.md)
had no source for, and the owner confirms or changes them, as with the
texts of #94 ([Grimdark naming](/features/naming.md)). This file is the
review list: everything in it is a draft **[V]** until the owner confirms
it. A confirmed text becomes **[E]** here; a changed one is changed in the
code and here in the same pull request.

# How to read it

* **[E]** What is drafted (owner, 2026-11-17): the words before the
  formulas for the articles without a source (Kogitator-Doktrin, the three
  drives, weapons, shields and armour, Sternennetz der Gelehrten,
  Auspex-Phalanx, Mondzitadelle, Warp-Tor, the stores, the producers), a short text
  per mission (what happens on arrival), and keywords in everyday words for
  every article.
* **[V]** The texts are shown as the player reads them. Every number in
  them is a value the code fills from the rules (`{name}` in the source,
  as in the article of the Auspex-Lehre), so a changed rule changes the
  number; the guard allows no typed number. Numbers written as words („die
  Hälfte“, „das vierfache Tempo“, „doppelt so hoch“) are typed and follow
  the rule named under „Sources“ below.
* **[V]** Where the texts live: `src/features/<key>/lexicon.de.ts` and
  `src/features/missions/<m>/lexicon.de.ts`; the three drives, the three
  battle researches and the three stores share one text each, built in
  `src/core/lexicon/parts.ts` (`drivePart`, `techPart`, `storePart`), and
  the producers that grow like a mine share the values `growthValues`.
* **[E]** The drafts go into the game as [V]; the owner changes them later
  in this file (owner, 2026-11-17, on pull request #291).
* **[E]** The text of a mission is shown above its facts; only its first
  sentence is the line below its hit in the search (owner, 2026-11-17).
* **[E]** Keywords are not shown; the search finds an article by the start
  of a keyword. A keyword is one word and no classic name (a guard checks
  both). Everyday words that are stems of classic names stay („angreifen“,
  „Speicher“, „Tank“, „Triebwerk“, „Laser“, „Kanone“), and a part of the
  title is allowed („Mond“ at the Mondzitadelle, „Sonne“ at the
  Sonnenkathedrale) (owner, 2026-11-17).
* **[V]** The article of the Auspex-Lehre keeps the text of the design
  study (#287) and its two keywords, the examples of the issue.

# Sources

* **[V]** The rules behind the typed words: the growth of a mine and of the
  Sonnenkathedrale `l · 1.1^l` (`growth` in `src/core/rates.ts`), the
  Fusionssanktum `fusionEnergy` and `fusionUse`, the temperature of the
  Promethium-Raffinerie (its `produces` in `src/features/deut/entry.ts`),
  the stores `capOf` (`src/core/components/storage.ts`), the drives
  `DRIVE_BONUS` and `speed`, the flight time `flightMs` (the square root
  of the speed, hence „etwa das vierfache Tempo“ for half the time), the
  battle researches `TECH_BONUS` and `techFactor`, `fleetSlots`,
  `networkLab`, `phalanxRange`, `inPhalanxRange` and `SCAN_COST`,
  `MOON_FIELDS`, `maxFields` and `usedFields`, the Warp-Tor `gateCooldown` and
  `gateCooldownMs` (the minutes of the table divided by the universe speed,
  [Moons](/features/moons.md)).
* **[V]** The missions: the rules and `arrive.server.ts` of each mission
  folder, `arrive` in `src/server/game/arrival.ts` (a target that no longer
  fits turns the fleet back with what it carries), `plunder` (up to half of
  each resource), `rebuild` and `debrisOf` (told without their shares, which
  belong to the rule page of the battle in stage 2), `deployFuel` (half of
  the fuel burnt), `harvest` (the cargo of every ship counts).

# The texts

## Gebäude

### Adamant-Tiefbohrung (`metal`)

* **[V]** Prose: „Die Förderung wächst schneller als die Stufe: Jede Stufe zählt einmal und legt auf alles noch 10 % drauf. Die doppelte Stufe fördert deshalb mehr als das Doppelte – Stufe 10 rund 3,2-mal so viel wie Stufe 5. Der Energiebedarf wächst im selben Maß. Die Tabelle zeigt die Förderung bei voller Energie.“
* **[V]** Keywords: Erz, Mine, Bergwerk, fördern

### Psikristall-Steinbruch (`crystal`)

* **[V]** Prose: „Der Abbau wächst schneller als die Stufe: Jede Stufe zählt einmal und legt auf alles noch 10 % drauf. Die doppelte Stufe bringt deshalb mehr als das Doppelte – Stufe 10 rund 3,2-mal so viel wie Stufe 5. Der Energiebedarf wächst im selben Maß. Die Tabelle zeigt den Abbau bei voller Energie.“
* **[V]** Keywords: Mine, Bergwerk, schürfen

### Promethium-Raffinerie (`deut`)

* **[V]** Prose: „Der Ausstoß wächst schneller als die Stufe: Jede Stufe zählt einmal und legt auf alles noch 10 % drauf. Die doppelte Stufe bringt deshalb mehr als das Doppelte – Stufe 10 rund 3,2-mal so viel wie Stufe 5. Dazu kommt die Temperatur: Je kälter der Planet, desto mehr Promethium, und jedes Grad weniger bringt gleich viel dazu. Der Energiebedarf wächst im selben Maß wie der Ausstoß. Die Tabelle zeigt den Ausstoß bei voller Energie auf diesem Planeten.“
* **[V]** Keywords: Treibstoff, Sprit, Mine, tanken

### Sonnenkathedrale (`solar`)

* **[V]** Prose: „Die Energie wächst schneller als die Stufe: Jede Stufe zählt einmal und legt auf alles noch 10 % drauf. Die doppelte Stufe liefert deshalb mehr als das Doppelte – Stufe 10 rund 3,2-mal so viel wie Stufe 5. Der Energiebedarf der Minen wächst nach demselben Muster; die Sonnenkathedrale muss also mit ihnen Schritt halten.“
* **[V]** Keywords: Strom, Sonne, Licht, Energiemangel

### Fusionssanktum (`fusion`)

* **[V]** Prose: „Die Energie wächst mit der Stufe, und jede Stufe legt auf alles noch einen Aufschlag drauf. Die Machina-Energetik vergrößert diesen Aufschlag und zahlt sich deshalb umso mehr aus, je höher das Fusionssanktum steht: Auf Stufe 10 liefert es ohne Machina-Energetik 489 Energie, mit Machina-Energetik 10 schon 1.214. Der Promethium-Verbrauch wächst wie die Förderung einer Mine und hängt nicht von der Forschung ab.“
* **[V]** Keywords: Strom, Reaktor, Energiemangel

### Servitorenschmiede (`robot`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: schneller, bauen, Fabrik

### Machina-Schwarmhalle (`nanite`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: schneller, bauen, Fabrik

### Weltenschmiede (`terraformer`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Platz, Bauplatz, ausgebaut

### Orbitale Schiffsschmiede (`yard`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Hangar, Schiffbau, Flotte

### Scholarium (`lab`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: forschen, Wissenschaft, Technologie

### Adamant-Gewölbe (`smetal`)

* **[V]** Prose: „Ohne Ausbau fasst das Lager den Grundwert des Universums. Die erste Stufe bringt 50.000 dazu, die zweite insgesamt 100.000, die dritte 200.000. Auf Dauer wächst der Ausbau mit jeder Stufe um gut die Hälfte: Stufe 10 bringt schon 5.450.000.“
* **[V]** Keywords: Lager, Speicher, voll, Platz

### Psikristall-Reliquiar (`scrystal`)

* **[V]** Prose: „Ohne Ausbau fasst das Lager den Grundwert des Universums. Die erste Stufe bringt 50.000 dazu, die zweite insgesamt 100.000, die dritte 200.000. Auf Dauer wächst der Ausbau mit jeder Stufe um gut die Hälfte: Stufe 10 bringt schon 5.450.000.“
* **[V]** Keywords: Lager, Speicher, voll, Platz

### Promethium-Zisterne (`sdeut`)

* **[V]** Prose: „Ohne Ausbau fasst das Lager den Grundwert des Universums. Die erste Stufe bringt 50.000 dazu, die zweite insgesamt 100.000, die dritte 200.000. Auf Dauer wächst der Ausbau mit jeder Stufe um gut die Hälfte: Stufe 10 bringt schon 5.450.000.“
* **[V]** Keywords: Lager, Speicher, Tank, voll

### Mondzitadelle (`moonbase`)

* **[V]** Prose: „Ein Mond beginnt mit 1 Feld. Jede Stufe der Mondzitadelle bringt 3 Felder und belegt selbst 1 davon – für andere Gebäude bleiben je Stufe 2. Der Gewinn ist auf jeder Stufe gleich, während die Kosten mit jeder Stufe steigen.“
* **[V]** Keywords: Mond, Platz, Bauplatz, Basis

### Auspex-Phalanx (`phalanx`)

* **[V]** Prose: „Die Reichweite wächst im Quadrat: Stufe 1 erfasst nur das eigene System, Stufe 3 reicht 8 Systeme in jede Richtung, Stufe 5 schon 24. Jede Stufe bringt also mehr dazu als die davor. Gezählt wird nur in der eigenen Galaxie und nicht über ihr Ende hinaus. Ein Scan kostet auf jeder Stufe gleich viel: 5.000 Promethium.“
* **[V]** Keywords: Mond, scannen, Radar, beobachten

### Warp-Tor (`jumpgate`)

* **[V]** Prose: „Die Wartezeit nach einem Sprung hängt von der Stufe des Starttors ab und sinkt, aber nicht gleichmäßig: Stufe 1 wartet 60 Minuten, Stufe 5 36, Stufe 10 nur 17. Ab Stufe 15 wird sie nicht mehr kürzer. Diese Minuten teilt das Universum durch seine Geschwindigkeit, ein schnelleres kühlt die Tore also schneller ab; die Tabelle zeigt die Zeit in deinem Universum. Beide Tore warten gleich lang, und zwar nach dem Starttor – die Stufe des Zieltors ändert nichts daran. Der Sprung selbst geschieht sofort und kostet keinen Treibstoff; nur Schiffe springen, die Rohstoffe bleiben zurück.“
* **[V]** Keywords: Tor, springen, Teleport, Flotte, Mond

## Forschung

### Machina-Energetik (`energy`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Strom, Grundlage, Technik

### Lichtlanzen-Lehre (`laser`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Laser, Strahlen, Grundlage

### Promethium-Brennkammer (`comb`)

* **[V]** Prose: „Jede Stufe legt 10 % des Grundtempos obendrauf – bei jedem Schiff, das mit diesem Antrieb fliegt. Der Zuwachs zählt immer vom Grundtempo, nicht vom schon erreichten Tempo: Stufe 5 bringt 50 %. Die Flugzeit sinkt langsamer, als das Tempo steigt: Für die halbe Flugzeit braucht ein Schiff etwa das vierfache Tempo.“
* **[V]** Keywords: Triebwerk, schneller, Flugzeit

### Plasma-Impulsantrieb (`impulse`)

* **[V]** Prose: „Jede Stufe legt 20 % des Grundtempos obendrauf – bei jedem Schiff, das mit diesem Antrieb fliegt. Der Zuwachs zählt immer vom Grundtempo, nicht vom schon erreichten Tempo: Stufe 5 bringt 100 %. Die Flugzeit sinkt langsamer, als das Tempo steigt: Für die halbe Flugzeit braucht ein Schiff etwa das vierfache Tempo.“
* **[V]** Keywords: Triebwerk, schneller, Flugzeit

### Warp-Theorie (`hyper`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Überlicht, Grundlage

### Warp-Antrieb (`hdrive`)

* **[V]** Prose: „Jede Stufe legt 30 % des Grundtempos obendrauf – bei jedem Schiff, das mit diesem Antrieb fliegt. Der Zuwachs zählt immer vom Grundtempo, nicht vom schon erreichten Tempo: Stufe 5 bringt 150 %. Die Flugzeit sinkt langsamer, als das Tempo steigt: Für die halbe Flugzeit braucht ein Schiff etwa das vierfache Tempo.“
* **[V]** Keywords: Triebwerk, schneller, Flugzeit

### Auspex-Lehre (`spy`)

* Text: the text of the design study (#287), not a new draft; see [Lexicanum](/features/lexicanum.md).
* **[V]** Keywords: ausspähen, Gegner

### Kogitator-Doktrin (`computer`)

* **[V]** Prose: „Ohne die Kogitator-Doktrin hast du 1 Flottenslot. Jede Stufe bringt genau einen weiteren dazu – auf jeder Stufe gleich viel, während die Kosten mit jeder Stufe steigen. Mit Stufe 5 sind es 6 Flotten, die gleichzeitig unterwegs sein können, über alle deine Planeten zusammen.“
* **[V]** Keywords: Flotten, gleichzeitig, Slots

### Waffensegnung (`weapons`)

* **[V]** Prose: „Jede Stufe hebt den Angriff aller deiner Schiffe und Verteidigungsanlagen um 10 % des Grundwerts. Der Zuwachs zählt immer vom Grundwert, nicht vom schon erreichten Wert: Mit Stufe 10 ist der Wert doppelt so hoch wie ohne die Forschung. Weil der Zuwachs gleich bleibt, der Wert aber wächst, bringt jede weitere Stufe im Verhältnis etwas weniger.“
* **[V]** Keywords: Schaden, Feuerkraft, stärker, Kampf

### Refraktionsfelder (`shield`)

* **[V]** Prose: „Jede Stufe hebt den Schild aller deiner Schiffe und Verteidigungsanlagen um 10 % des Grundwerts. Der Zuwachs zählt immer vom Grundwert, nicht vom schon erreichten Wert: Mit Stufe 10 ist der Wert doppelt so hoch wie ohne die Forschung. Weil der Zuwachs gleich bleibt, der Wert aber wächst, bringt jede weitere Stufe im Verhältnis etwas weniger.“
* **[V]** Keywords: Schutz, Abwehr, Kampf

### Adamant-Panzerung (`armor`)

* **[V]** Prose: „Jede Stufe hebt die Struktur aller deiner Schiffe und Verteidigungsanlagen um 10 % des Grundwerts. Der Zuwachs zählt immer vom Grundwert, nicht vom schon erreichten Wert: Mit Stufe 10 ist der Wert doppelt so hoch wie ohne die Forschung. Weil der Zuwachs gleich bleibt, der Wert aber wächst, bringt jede weitere Stufe im Verhältnis etwas weniger.“
* **[V]** Keywords: Rumpf, Hülle, Lebenspunkte, Kampf

### Ionen-Lehre (`ion`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Waffen, Grundlage

### Plasma-Lehre (`plasma`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Waffen, Grundlage

### Gravitonen-Mysterium (`graviton`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Schwerkraft, Gravitation

### Sternennetz der Gelehrten (`ifn`)

* **[V]** Prose: „Jede Stufe nimmt ein weiteres Scholarium deiner anderen Planeten ins Netz – die höchsten zuerst. Mitforschen darf ein Scholarium nur, wenn es selbst die Stufe hat, die die Forschung verlangt, und nicht gerade ausgebaut wird. Die Stufen der vernetzten Scholarien zählen zu der des Startplaneten dazu: 3 Scholarien der Stufe 12 forschen mit Stufe 2 des Sternennetzes wie eines der Stufe 36. Mehr Stufen, als du weitere Scholarien hast, bringen nichts.“
* **[V]** Keywords: Netzwerk, vernetzen, forschen, Forschungszeit

## Schiffe

### Frachtläufer (`sc`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Laderaum, Ladung, liefern

### Lastbarke (`lc`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Laderaum, Ladung, liefern

### Kolonistenarche (`colony`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: siedeln, besiedeln, ausbreiten

### Bergungsbarke (`recycler`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Schrott, Wrack, einsammeln

### Abfangjäger (`lf`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Kampfschiff, Jäger, billig, Kanonenfutter

### Sturmjäger (`hf`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Kampfschiff, Jäger, gepanzert

### Fregatte (`cr`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Kampfschiff, schnell

### Kathedralschiff (`bs`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Kampfschiff, Flaggschiff

### Jagdkreuzer (`bc`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Kampfschiff, jagen

### Vernichter (`dr`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Kampfschiff, schwer

### Belagerungsbomber (`bb`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Kampfschiff, Bomben

### Weltenbrecher (`dstar`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Kampfschiff, Superwaffe, Riesenschiff

### Spähschädel (`probe`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: ausspähen, auskundschaften, Späher, Aufklärung

### Sonnenreliquiar (`sat`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Strom, Sonne, Licht, Energiemangel

## Verteidigung

### Raketenbatterie (`rl`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Geschütz, Raketen, billig

### Lichtlanze (`ll`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Geschütz, Laser

### Schwere Lichtlanze (`hl`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Geschütz, Laser

### Massebeschleuniger (`gauss`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Geschütz, Kanone

### Ionenlanze (`ionc`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Geschütz, Ionen, Schild

### Plasmabatterie (`pt`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Geschütz, Plasma, Artillerie

### Kleiner Schutzdom (`ssd`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Schutzschild, Schirm

### Großer Schutzdom (`lsd`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Schutzschild, Schirm

## Missionen

### Sturmangriff (`mission-attack`)

* **[V]** Mission text: „Am Ziel kämpft die Flotte gegen die Schiffe und die Verteidigung des Planeten. Gewinnt sie, lädt sie bis zur Hälfte jedes Rohstoffs ein, soweit der Laderaum reicht. Was den Kampf übersteht, fliegt heim. Zerstörte Schiffe beider Seiten hinterlassen ein Trümmerfeld, ein Teil der zerstörten Verteidigung wird wieder aufgebaut. Beide Seiten erhalten einen Kampfbericht.“
* **[V]** Keywords: angreifen, überfallen, plündern, Kampf, Krieg, Beute

### Versorgungsflug (`mission-transport`)

* **[V]** Mission text: „Am Ziel lädt die Flotte ihre ganze Ladung ab und fliegt leer zurück. Gehört der Planet einem anderen Spieler, erhält auch er einen Bericht über die Lieferung.“
* **[V]** Keywords: liefern, schicken, Rohstoffe, Handel, schenken

### Auspex-Erkundung (`mission-spy`)

* **[V]** Mission text: „Am Ziel entsteht ein Auspex-Bericht: die Rohstoffe immer, alles Weitere je nach Auspex-Wert (siehe Auspex-Lehre). Der Verteidiger erfährt, dass er erkundet wurde und von wo. Werden die Spähschädel abgeschossen, bekommst du den Bericht trotzdem; sonst fliegen sie heim.“
* **[V]** Keywords: ausspähen, auskundschaften, Gegner, Bericht

### Landnahme (`mission-colonize`)

* **[V]** Mission text: „Am Ziel gründet eine Kolonistenarche die neue Kolonie und bleibt dort; die Ladung der Flotte wird der erste Vorrat der Kolonie. Alle anderen Schiffe fliegen leer zurück. Ist die Position inzwischen besetzt, kehrt die ganze Flotte mit ihrer Ladung um.“
* **[V]** Keywords: siedeln, besiedeln, Kolonie, Planet

### Verlegung (`mission-deploy`)

* **[V]** Mission text: „Am Ziel, einem deiner eigenen Planeten, bleiben Schiffe und Ladung; einen Rückflug gibt es nicht. Dazu bekommt der Planet die Hälfte des verbrauchten Treibstoffs als Promethium gutgeschrieben.“
* **[V]** Keywords: verlegen, umziehen, parken, sichern

### Bergung (`mission-harvest`)

* **[V]** Mission text: „Am Trümmerfeld lädt die Flotte Adamant und Psikristall ein, bis das Feld leer oder der Laderaum voll ist. Dabei zählt der Laderaum aller Schiffe, nicht nur der Bergungsbarken. War eine andere Flotte schneller, bleibt nur der Rest; ist das Feld ganz fort, kehrt die Flotte um.“
* **[V]** Keywords: Schrott, Wrack, einsammeln, aufräumen
