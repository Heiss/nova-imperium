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
* **[E]** The guides of stage 3 (#289) under „Einstieg“ are listed the same
  way; „Deine nächsten Ziele“ is shown in the states of its `review`, which
  together hold every hint, so its list has the texts of all of them.
* **[E]** The pages of stage 2 (#288) are drafts of Claude from the decided
  rules and the existing game terms, [V] for the owner to check
  afterwards (owner, 2026-11-19, #222). Under „Regeln“ and „Häufige Fragen“
  below, every string of a page is listed in the order of the page, with
  what it is: the line below the title (Line), a heading, a paragraph
  (Text), a formula, the caption and the column heads of a table (Table),
  and the labelled facts of a question (Facts). The numbers in them are the
  values of the default round and universe as the code fills them; on
  another round the page shows that round's values. A guard
  (`articles.test.ts`) keeps the list equal to the pages in the code.
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
* **[E]** The article of the Auspex-Lehre shows the rule of the game for the chance of the Auspex-Abwehr instead of the old danger formula (owner, 2026-11-18, #175); **[V]** its wording, drafted by Claude for the owner to check: formula „Höchste Chance auf Auspex-Abwehr in % = Spähschädel ÷ 4 · Auspex-Lehre des Ziels ÷ deine Auspex-Lehre · (1 + Schiffe am Ziel ÷ 100) (höchstens 100)“, table caption „Höchste Chance auf Auspex-Abwehr bei gleicher Auspex-Lehre“ (rows „Schiffe am Ziel“, columns „n Spähschädel“) and paragraph „Die Chance auf Auspex-Abwehr wird bei jeder Auspex-Erkundung neu zwischen null und dem Höchstwert ausgelost. Mehr Spähschädel und mehr Schiffe am Ziel erhöhen ihn, eine höhere Auspex-Lehre des Ziels auch; deine eigene senkt ihn.“ The numbers come from `src/core/espionage.ts`. **[V]** The paragraph names the Auspex-Erkundung and the Spähschädel as plain words, not as links: the introduction of the article already links both, and no other article links an entry twice (CI of #316: the E2E test of the Lexicanum found two links to the Spähschädel).

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
  the fuel burnt), `harvest` (the cargo of every ship counts), `hold`
  (`HOLD_HOURS` and `HOLD_LIMITS` of `src/core/holding.ts`: the values of
  the text are filled from them; the decisions of #55 for the rest).

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

### Handelsposten (`market`)

* **[V]** Prose (#171, 2026-11-19): „Der Handelsposten bringt auf keiner Stufe mehr Rohstoffe: Er öffnet den Marktplatz und senkt die Gebühr, die bei jedem Tausch vom Ergebnis abgezogen wird. Wie hoch sie auf der ersten Stufe ist und um wie viele Prozentpunkte jede weitere Stufe sie senkt, legt der Admin für die Runde fest; unter null fällt sie nie. Die Tabelle zeigt die Werte dieser Runde. Wie viel du für einen Rohstoff bekommst, bestimmen ebenfalls die Kurse des Admins, die sich mit jedem Tausch verschieben. Dazu kommt ein Tageslimit: Der Admin legt fest, wie viel jeder Spieler an einem Tag tauschen darf, bei null gibt es kein Limit. Wer mehr tauschen will, als vom Tag übrig ist, tauscht nur den Rest; ist nichts mehr übrig, wird der Tausch abgelehnt.“
* **[V]** Keywords: tauschen, Handel, Markt

### Raketenkrypta (`silo`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Raketen, lagern, Lager, Silo

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

### Auspex-Kartographie (`carto`)

* Prose: none; the article has no effect of a level. Its short and its long text are those of the entry (#190), not drafts of this list.
* **[V]** Keywords: vermessen, Position, Planet, Kolonie

### Kreuzzugs-Kartografie (`expo`)

* **[V]** Prose (#93): „Die Stufe bestimmt, wie viele Expeditionen gleichzeitig unterwegs sein dürfen: die Wurzel der Stufe, abgerundet; der Admin kann für die Runde zusätzliche Plätze dazugeben. Jede Expedition belegt dazu einen gewöhnlichen Flottenslot. Außerdem darf eine Expedition höchstens so viele Stunden an der Expeditionsposition bleiben, wie die Stufe hoch ist; auch die Stunden je Stufe legt der Admin für die Runde fest, und er kann bestimmen, dass das Tempo des Universums die Haltezeit teilt. Mit Stufe 9 sind es in einer Runde ohne diese Änderungen 3 Expeditionen und bis zu 9 Stunden.“ The sentences about the admin are new with the settings of 2026-11-19. The formula (the root of the level, rounded down) and the table column of the expeditions at once come from `expeditionSlots`. Its short and its long text are [V] of the entry, not drafts of this list.
* **[V]** Keywords: Expedition, erkunden, entdecken, Rand

### Kolonialverwaltung (`colonial`)

* Prose: none; the article has no effect of a level (the limit depends on the settings of the round, #237). Its short and its long text are [V] of the entry, not drafts of this list.
* **[V]** Keywords: Planetengrenze, Kolonie, Planeten, Limit

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

### Abfangrakete (`abm`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Abwehr, Raketen, abfangen, Schutz

### Orbitalrakete (`ipm`)

* Prose: none; the article has no effect of a level.
* **[V]** Keywords: Raketen, Angriff, beschießen, Fernkampf

## Missionen

### Sturmangriff (`mission-attack`)

* **[V]** Mission text: „Am Ziel kämpft die Flotte gegen die Schiffe und die Verteidigung des Planeten. Gewinnt sie, lädt sie bis zur Hälfte jedes Rohstoffs ein, soweit der Laderaum reicht. Was den Kampf übersteht, fliegt heim. Zerstörte Schiffe beider Seiten hinterlassen ein Trümmerfeld, ein Teil der zerstörten Verteidigung wird wieder aufgebaut. Beide Seiten erhalten einen Kampfbericht.“
* **[V]** Keywords: angreifen, überfallen, plündern, Kampf, Krieg, Beute

### Versorgungsflug (`mission-transport`)

* **[V]** Mission text: „Am Ziel lädt die Flotte ihre ganze Ladung ab und fliegt leer zurück. Gehört der Planet einem anderen Spieler, erhält auch er einen Bericht über die Lieferung.“
* **[V]** Keywords: liefern, schicken, Rohstoffe, Handel, schenken

### Auspex-Erkundung (`mission-spy`)

* **[V]** Mission text: „Am Ziel entsteht ein Auspex-Bericht: die Rohstoffe immer, alles Weitere je nach Auspex-Wert (siehe Auspex-Lehre). Der Verteidiger erfährt, dass er erkundet wurde und von wo.“
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

### Wache stellen (`mission-hold`)

* **[V]** Mission text: „Am Ziel, dem Planeten eines Gildenmitglieds oder Freundes, bleibt die Flotte für die Haltezeit, die du beim Start wählst (von 0 bis 32 Stunden), und verteidigt den Planeten in jedem Kampf zusammen mit seinem Besitzer. Danach fliegt sie heim. Wer halten darf, legt der Admin je Runde fest; den Treibstoff für die Haltezeit zahlst du beim Start. An einem Planeten halten höchstens 4 Spieler mit zusammen höchstens 15 Flotten.“
* **[V]** Keywords: verteidigen, stationieren, beistehen, Gilde

### Mondbruch (`mission-moonbreak`)

* **[V]** Mission text: „Am Ziel, dem Mond eines anderen Spielers, kämpft die Flotte wie beim Sturmangriff gegen die Schiffe und die Verteidigung des Mondes; die anderen Schiffe fliegen mit und kämpfen mit. Nur nach einem gewonnenen Kampf oder gegen einen unverteidigten Mond, und nur mit Weltenbrechern, die den Kampf überstanden haben, folgen zwei voneinander unabhängige Würfe: ob der Mond zerbricht und ob die Weltenbrecher vom eigenen Schuss zerrissen werden. Je größer der Mond, desto seltener zerbricht er und desto eher gehen die Weltenbrecher verloren; je mehr Weltenbrecher, desto eher zerbricht er. Ein zerbrochener Mond ist mit allem, was auf ihm war, verloren und hinterlässt kein Trümmerfeld; Flotten, die ihn anfliegen, landen auf seinem Planeten. Ladung und Beute werden auf den Laderaum der Schiffe gekürzt, die übrig sind. Beide Seiten erhalten einen Kampfbericht.“
* **[V]** Keywords: Mond, vernichten, sprengen, brechen

### Vermessung (`mission-survey`)

* **[V]** Mission text: „Am Ziel vermessen die Spähschädel die freie Position und bringen einen Vermessungsbericht. Je mehr Spähschädel du schickst und je höher deine Auspex-Kartographie steht, desto mehr steht darin; reicht es nicht, bleibt es bei einem groben Text, der nur sagt, was sich von der Position erraten lässt. Die Spähschädel können dabei verloren gehen, und je weiter der Flug, desto eher: Dann gibt es keinen Bericht, und die Position bekommt keine Werte. Sonst fliegen sie heim. Die Position behält die gemessenen Werte 30 Tage ab der ersten Vermessung; wird sie in dieser Zeit besiedelt, bekommt die Kolonie genau diese Werte.“
* **[V]** Keywords: vermessen, Position, Planet, Kolonie

### Raketenangriff (`mission-missile`)

* **[V]** Mission text: „Am Ziel hält jede Abfangrakete des Verteidigers eine anfliegende Orbitalrakete auf. Die übrigen treffen nur Verteidigung, die kämpft: zuerst das Hauptziel, dann alles andere der Reihe nach; Schilde zählen dabei nicht. Ist keine Verteidigung mehr übrig, zerstört der Rest der Wucht die gelagerten Raketen der Raketenkrypta. Zerstörte Verteidigung wird nicht wieder aufgebaut und hinterlässt kein Trümmerfeld. Ist das Ziel inzwischen verschwunden, sind die Raketen verloren; beide Seiten erhalten einen Bericht.“
* **[V]** Keywords: Raketen, beschießen, Fernangriff, Verteidigung

### Expedition (`mission-expedition`)

* **[V]** Mission text (#93): „Am Ziel, der Expeditionsposition am Rand jedes Systems, bleibt die Flotte so viele Stunden, wie du beim Start wählst, höchstens so viele wie die Stufe deiner Kreuzzugs-Kartografie (mindestens 1; der Admin kann die Stunden je Stufe für die Runde ändern und festlegen, dass das Tempo des Universums sie teilt). Dort lässt sich nichts besiedeln. Nach dem Aufenthalt entscheidet der Zufall, in etwa 84 % der Expeditionen bringen etwas: Rohstoffe oder Schiffe, die sich der Flotte anschließen, einen Kampf gegen Piraten oder Aliens, den Verlust der ganzen Flotte oder eine frühere oder spätere Heimkehr. Zerstörte Schiffe eines Kampfes hinterlassen ein Trümmerfeld an der Expeditionsposition, das eine Bergung einsammeln kann. Eine Expedition belegt einen Flottenslot und einen Expeditionsplatz.“ The 84 % is `EVENT_CHANCE`; the events are on since 2026-11-19 with the shares of [Expeditions](/features/expeditions.md).
* **[V]** Keywords: Expedition, erkunden, entdecken, Abenteuer, Rand

## Regeln

### Kampf (`rule-battle`)

* **[V]** Line: „Wie ein Kampf abläuft, was die Forschung bringt und was danach übrig bleibt.“
* **[V]** Heading: „So läuft ein Kampf“
* **[V]** Text: „Ein Kampf dauert höchstens 6 Runden und endet früher, sobald eine Seite keine Einheit mehr hat. In jeder Runde laden die Schilde beider Seiten wieder voll auf, dann schießt jede Einheit auf ein zufällig gewähltes Ziel der Gegenseite. Beide Seiten schießen gleichzeitig: Eine Einheit, die in dieser Runde zerstört wird, hat ihren Schuss trotzdem abgegeben.“
* **[V]** Text: „Ein Schuss trifft zuerst den Schild des Ziels, was der Schild nicht aufhält, geht auf die Struktur. Ein Schuss, der schwächer ist als 1 % des Schilds, den das Ziel gerade noch hat, prallt ab und richtet nichts an. Fällt die Struktur einer Einheit unter 70 % ihres Höchstwerts, kann sie explodieren, und zwar umso wahrscheinlicher, je weniger Struktur ihr bleibt.“
* **[V]** Text: „Gewonnen hat, wer nach dem Kampf noch Einheiten hat, während die andere Seite keine mehr hat. Stehen sich nach der letzten Runde noch beide Seiten gegenüber, endet der Kampf unentschieden.“
* **[V]** Heading: „Schnellfeuer“
* **[V]** Text: „Manche Einheiten schießen mit etwas Glück gleich noch einmal: Das Schnellfeuer ist ein Wert je Schütze und getroffene Art von Einheit, und die Chance auf einen weiteren Schuss wächst mit ihm, ohne je sicher zu werden. Jeder weitere Schuss geht auf ein neu gewürfeltes Ziel, und es zählt das Schnellfeuer gegen dieses Ziel. Ein Wert von 5 heißt: 80 % Chance auf noch einen Schuss.“
* **[V]** Formula: „Chance auf einen weiteren Schuss = (Schnellfeuer − 1) ÷ Schnellfeuer“
* **[V]** Text: „Jedes Schiff hat Schnellfeuer 5 gegen die leichten Ziele (Spähschädel und Sonnenreliquiar), wenn es nicht selbst eines ist. Die Tabelle nennt alle Einheiten mit Schnellfeuer und die Ziele, gegen die sie es haben.“
* **[V]** Table: „Schnellfeuer der Einheiten“
* **[V]** Table: „Einheit | Schnellfeuer gegen“
* **[V]** Heading: „Werte und Forschung“
* **[V]** Text: „Angriff, Schild und Struktur einer Einheit steigen mit der Forschung ihres Besitzers: Waffensegnung hebt den Angriff, Refraktionsfelder den Schild, Adamant-Panzerung die Struktur aller Schiffe und Verteidigungsanlagen. Jede Stufe legt 10 % des Grundwerts obendrauf. Flotten, die an einem Planeten Wache halten, kämpfen mit der Forschung ihres eigenen Besitzers.“
* **[V]** Formula: „Wert im Kampf = Grundwert · (1 + 10 % · Stufe)“
* **[V]** Text: „Die Struktur einer Einheit ist ein Zehntel ihrer Kosten an Adamant und Psikristall. Die Tabelle zeigt die Grundwerte, ohne Forschung.“
* **[V]** Table: „Werte der Einheiten ohne Forschung“
* **[V]** Table: „Einheit | Angriff | Schild | Struktur“
* **[V]** Heading: „Nach dem Kampf“
* **[V]** Text: „Zerstörte Schiffe beider Seiten hinterlassen ein Trümmerfeld. Von der zerstörten Verteidigung wird ein Teil wieder aufgebaut: 70 % je Art. Gehen weniger als 50 Stück einer Art verloren, wird jedes Stück einzeln ausgelost, ab 50 Stück wird der Anteil gerundet. Zerstörte Schiffe werden nie ersetzt, und Raketen kämpfen nicht mit.“
* **[V]** Text: „Gewinnt der Angreifer, lädt er bis zu 50 % jedes Rohstoffs des Planeten ein, soweit der Laderaum seiner übrigen Schiffe reicht. Der Laderaum wird in fester Reihenfolge gefüllt: zuerst Adamant, dann Psikristall, dann Promethium, und was danach noch Platz hat, füllt wieder mit Adamant und Psikristall auf. Danach nimmt er die Ladung der Flotten mit, die am Planeten Wache gehalten haben, soweit noch Platz ist; diese Flotten sind dann verloren.“
* **[V]** Table: „Beute bei einem Planeten mit 200.000 Adamant, 100.000 Psikristall und 50.000 Promethium“
* **[V]** Table: „Freier Laderaum | Adamant | Psikristall | Promethium“
* **[V]** Keywords: Schlacht, Gefecht, Schaden, Beute, Verlust

### Auspex-Erkundung (`rule-spy`)

* **[V]** Line: „Was ein Auspex-Bericht zeigt, wann deine Spähschädel entdeckt werden und was dann geschieht.“
* **[V]** Heading: „Was ein Bericht zeigt“
* **[V]** Text: „Eine Auspex-Erkundung fliegt nur mit Spähschädeln und braucht mindestens Stufe 1 der Auspex-Lehre. Ihr Bericht nennt die Rohstoffe des Ziels immer; was er sonst noch zeigt, hängt vom Auspex-Wert ab. Der Auspex-Wert zählt jeden Spähschädel einmal und deinen Vorsprung in der Auspex-Lehre im Quadrat. Liegt das Ziel vorn, zählt sein Vorsprung ebenso im Quadrat, aber gegen dich. Gezählt werden die Spähschädel, die ankommen, und die Auspex-Lehre beider Seiten bei der Ankunft.“
* **[V]** Formula: „Auspex-Wert = Spähschädel + Vorsprung · |Vorsprung|“
* **[V]** Table: „Auspex-Wert nach Spähschädeln und Vorsprung in der Auspex-Lehre“
* **[V]** Table: „Spähschädel | Ziel führt um 2 | Ziel führt um 1 | Gleichstand | Du führst um 1 | Du führst um 2“
* **[V]** Text: „Je höher der Auspex-Wert, desto mehr steht im Bericht. Die Tabelle nennt, ab welchem Auspex-Wert ein Teil dazukommt.“
* **[V]** Table: „Was der Bericht ab welchem Auspex-Wert zeigt“
* **[V]** Table: „Teil | ab Auspex-Wert“
* **[V]** Text: „Flotten, die am Ziel Wache halten, zählt der Bericht zunächst zur Flotte des Planeten. Ab Stufe 2 der Auspex-Lehre zeigt er sie getrennt unter der Überschrift ‚Gehaltene Flotten‘. Der Bericht nennt auch, wie aktiv das Ziel zuletzt war (Sichtbarkeit und Aktivität).“
* **[V]** Heading: „Auspex-Abwehr“
* **[V]** Text: „Bei jeder Erkundung kann das Ziel deine Spähschädel entdecken. Die Chance wird jedes Mal neu zwischen null und einem Höchstwert ausgelost. Der Höchstwert steigt mit der Zahl der Spähschädel, mit den Schiffen am Ziel und mit der Auspex-Lehre des Ziels, und er sinkt mit deiner eigenen. Ein Ziel ohne Auspex-Lehre entdeckt nie etwas, und über 100 % kommt der Höchstwert nicht. Die Tabelle im Artikel der Auspex-Lehre zeigt ihn für Beispiele.“
* **[V]** Formula: „Höchste Chance in % = Spähschädel ÷ 4 · Auspex-Lehre des Ziels ÷ deine Auspex-Lehre · (1 + Schiffe am Ziel ÷ 100), höchstens 100“
* **[V]** Text: „Wird die Erkundung entdeckt, kämpfen die Spähschädel wie in einem Kampf gegen die Schiffe und die Verteidigung des Ziels und gegen Flotten, die dort Wache halten. Nur Spähschädel, die den Kampf überleben, bringen einen Bericht. Hat das Ziel weder Schiffe noch Verteidigung noch Wache haltende Flotten, gibt es keinen Kampf, und die Spähschädel berichten wie sonst. Der Verteidiger erfährt in jedem Fall, von wo er erkundet wurde und wie hoch die ausgeloste Chance war.“
* **[V]** Heading: „Wen du erkunden darfst“
* **[V]** Text: „Erkunden lassen sich fremde Planeten und Monde. Wer unter Noobschutz steht oder im Urlaubsmodus ist, lässt sich nicht erkunden.“
* **[V]** Keywords: ausspähen, Gegner, Bericht, Späher, entdeckt

### Flug und Treibstoff (`rule-flight`)

* **[V]** Line: „Wie weit ein Ziel ist, wie lange der Flug dauert, was er an Promethium kostet und wie viele Flotten du schicken darfst.“
* **[V]** Heading: „Entfernung“
* **[V]** Text: „Die Entfernung zählt in drei Stufen: Wechselst du die Galaxie, zählt nur der Unterschied der Galaxien. Bleibst du in der Galaxie und wechselst das System, zählt der Unterschied der Systeme, und bleibst du im System, zählt der Unterschied der Positionen. Jede Stufe hat einen Grundwert, damit auch das Nachbarsystem nie ganz nah ist. Gemessen wird nicht um das Ende einer Galaxie herum.“
* **[V]** Formula: „Andere Galaxie: Entfernung = 20.000 · Unterschied der Galaxien“
* **[V]** Formula: „Anderes System: Entfernung = 2.700 + 95 · Unterschied der Systeme“
* **[V]** Formula: „Andere Position: Entfernung = 1.000 + 5 · Unterschied der Positionen“
* **[V]** Formula: „Gleiche Position: Entfernung = 5“
* **[V]** Table: „Entfernung zu Beispielzielen“
* **[V]** Table: „Ziel | Entfernung“
* **[V]** Heading: „Flugzeit“
* **[V]** Text: „Die Flugzeit wächst langsamer als die Entfernung, denn sie folgt der Wurzel daraus. Ein höheres Tempo verkürzt sie ebenfalls nur mit der Wurzel: Für die halbe Flugzeit braucht ein Schiff etwa das Vierfache an Tempo. Beim Start wählst du in Zehnerschritten, mit wie viel Prozent ihres Tempos die Flotte fliegt, und die Flotte fliegt so schnell wie ihr langsamstes Schiff. In diesem Universum laufen alle Flüge 5-mal so schnell.“
* **[V]** Formula: „Flugzeit in Sekunden = (3.500 ÷ Tempoanteil · √(Entfernung · 10 ÷ Tempo) + 10) ÷ Tempo des Universums“
* **[V]** Text: „Der Tempoanteil ist die gewählte Geschwindigkeit zwischen einem Zehntel und dem Ganzen des Tempos. Die Tabelle zeigt die Flugzeit bei vollem Tempo mit deiner Forschung in diesem Universum.“
* **[V]** Table: „Tempo und Flugzeit der Schiffe bei vollem Tempo“
* **[V]** Table: „Schiff | Tempo | Nachbarposition | Nächstes System | Nächste Galaxie“
* **[V]** Heading: „Treibstoff“
* **[V]** Text: „Jedes Schiff verbraucht Promethium, und zwar mehr, je weiter das Ziel ist und je schneller die Flotte fliegt. Der Verbrauch wächst mit der Entfernung gleichmäßig und mit dem Tempoanteil im Quadrat; langsamer zu fliegen spart also Promethium und kostet Zeit. Zum Verbrauch aller Schiffe kommt immer ein Promethium dazu.“
* **[V]** Formula: „Promethium = Summe über alle Schiffe (Verbrauch · Anzahl · Entfernung ÷ 35.000 · (Tempoanteil + 1)²), gerundet, + 1“
* **[V]** Text: „Wer Wache stellt, zahlt den Treibstoff für die Haltezeit beim Start dazu, und zwar ein Zehntel des Grundverbrauchs je Schiff und Stunde, mindestens aber ein Promethium. Die Verlegung schreibt dem Zielplaneten die Hälfte des verbrauchten Treibstoffs gut.“
* **[V]** Formula: „Treibstoff der Haltezeit = Summe über alle Schiffe (Grundverbrauch · Anzahl · Stunden ÷ 10), abgerundet, mindestens 1“
* **[V]** Formula: „Gutschrift der Verlegung = ⌊verbrauchter Treibstoff ÷ 2⌋“
* **[V]** Heading: „Antriebe“
* **[V]** Text: „Das Tempo eines Schiffs hängt vom Antrieb ab, mit dem es fliegt, und von deiner Forschung darin: Jede Stufe legt einen festen Anteil des Grundtempos obendrauf, bei jedem Antrieb einen anderen. Die Artikel der Antriebe nennen die Werte im Einzelnen.“
* **[V]** Table: „Zuwachs des Tempos je Stufe der Antriebsforschung“
* **[V]** Table: „Forschung | Zuwachs je Stufe“
* **[V]** Formula: „Tempo = Grundtempo · (1 + Zuwachs · Stufe des Antriebs)“
* **[V]** Text: „Einige Schiffe wechseln den Antrieb, sobald du die dazugehörige Forschung erreicht hast; ab dann zählen ihr neues Grundtempo und der Zuwachs des neuen Antriebs.“
* **[V]** Facts: „Belagerungsbomber: fliegt ab Warp-Antrieb Stufe 8 mit Warp-Antrieb und dem Grundtempo 5.000“
* **[V]** Heading: „Flottenslots“
* **[V]** Text: „Wie viele Flotten gleichzeitig unterwegs sein dürfen, bestimmt die Kogitator-Doktrin: Ohne sie ein Flottenslot, und jede Stufe bringt einen dazu, über alle deine Planeten zusammen. Raketen aus der Raketenkrypta brauchen keinen Slot.“
* **[V]** Formula: „Flottenslots = 1 + Stufe der Kogitator-Doktrin“
* **[V]** Stand: „Dein Stand: Stufe 0 der Kogitator-Doktrin, 1 Flottenslot.“
* **[V]** Keywords: fliegen, Entfernung, Flugzeit, Verbrauch, Tempo

### Trümmerfelder und Bergung (`rule-debris`)

* **[V]** Line: „Was zerstörte Schiffe hinterlassen und wie eine Bergung es einsammelt.“
* **[V]** Heading: „Wie ein Trümmerfeld entsteht“
* **[V]** Text: „Nach einem Kampf bleiben 30 % des Adamants und des Psikristalls aller zerstörten Schiffe beider Seiten als Trümmerfeld an der Position liegen, auch die der Flotten, die dort Wache gehalten haben. Promethium und Verteidigungsanlagen hinterlassen nichts. Ein Trümmerfeld wächst mit jedem Kampf an derselben Position und bleibt liegen, bis es eingesammelt ist; ein leeres Feld verschwindet. Jeder Spieler sieht jedes Trümmerfeld.“
* **[V]** Formula: „Trümmerfeld = 30 % · (Adamant + Psikristall der zerstörten Schiffe)“
* **[V]** Table: „Was ein zerstörtes Schiff am Trümmerfeld hinterlässt“
* **[V]** Table: „Schiff | Adamant | Psikristall“
* **[V]** Heading: „Die Bergung“
* **[V]** Text: „Eine Bergung braucht mindestens eine Bergungsbarke in der Flotte und fliegt zu einem Trümmerfeld. Eingesammelt wird, was der Laderaum aller Schiffe der Flotte noch fasst, nicht nur der der Bergungsbarken. Adamant und Psikristall werden gleichmäßig geladen, bis die kleinere der beiden Mengen aufgebraucht ist, danach der Rest der anderen. Ein Trümmerfeld ist nicht geschützt: Die erste Flotte, die ankommt, nimmt es sich, eine spätere nur, was übrig ist. Findet eine Flotte kein Feld mehr, fliegt sie leer zurück.“
* **[V]** Table: „Bergung eines Feldes mit 60.000 Adamant und 30.000 Psikristall“
* **[V]** Table: „Freier Laderaum | Adamant | Psikristall | Bleibt im Feld“
* **[V]** Text: „Aus einem Trümmerfeld kann auch ein Mond entstehen; wie, steht unter Monde.“
* **[V]** Keywords: Trümmer, Wrack, Schrott, bergen, einsammeln

### Monde (`rule-moons`)

* **[V]** Line: „Wie ein Mond entsteht, was auf ihm Platz hat und wie er zerbricht.“
* **[V]** Heading: „Wie ein Mond entsteht“
* **[V]** Text: „Nach einem Kampf an einem Planeten ohne Mond wird gewürfelt, ob ein Mond entsteht. Die Chance ergibt sich aus dem Trümmerfeld, das nach dem Kampf an der Position liegt: je 100.000 Adamant und Psikristall darin ein Prozent, aber nie mehr als 20 %. Gewürfelt wird einmal je Kampf, ein Planet hat höchstens einen Mond, und ein Kampf an einem Mond würfelt nichts. Mehr zum Trümmerfeld steht auf seiner Seite.“
* **[V]** Formula: „Mondchance in % = ⌊(Adamant + Psikristall im Trümmerfeld) ÷ 100.000⌋, höchstens 20“
* **[V]** Table: „Mondchance nach dem Trümmerfeld“
* **[V]** Table: „Adamant und Psikristall im Feld | Mondchance“
* **[V]** Text: „Der Durchmesser des neuen Mondes wird ausgelost und fällt im Mittel größer aus, wenn die Chance hoch war. Die Tabelle zeigt die kleinsten und größten Monde, die bei einer Chance möglich sind.“
* **[V]** Formula: „Durchmesser in km = ⌊√(x + 3 · Chance) · 1.000⌋, mit x ausgelost von 10 bis 20“
* **[V]** Table: „Durchmesser eines neuen Mondes“
* **[V]** Table: „Mondchance | kleinster Mond in km | größter Mond in km“
* **[V]** Heading: „Felder und Gebäude“
* **[V]** Text: „Ein Mond hat 1 Feld, gleich wie groß er ist, und die Zusatzfelder des Universums gelten für ihn nicht. Mehr Felder bringt die Mondzitadelle: Jede Stufe schafft 3 Felder, von denen sie selbst eines belegt. Auf einem Mond lassen sich nur diese Gebäude errichten: Servitorenschmiede, Orbitale Schiffsschmiede, Adamant-Gewölbe, Psikristall-Reliquiar, Promethium-Zisterne, Mondzitadelle, Auspex-Phalanx, Warp-Tor.“
* **[V]** Formula: „Felder des Mondes = 1 + 3 · Stufe der Mondzitadelle“
* **[V]** Heading: „Auspex-Phalanx“
* **[V]** Text: „Die Auspex-Phalanx steht nur auf einem Mond. Ihre Reichweite wächst im Quadrat der Stufe, gezählt in Systemen der eigenen Galaxie. Ein Scan kostet 5.000 Promethium und zeigt alle Flüge von und zu einem fremden Planeten in Reichweite: Schiffe, Herkunft, Ziel und Ankunft, aber keine Ladung. Ein Mond lässt sich nicht scannen, und der gescannte Spieler erfährt nichts davon.“
* **[V]** Formula: „Reichweite in Systemen = Stufe² − 1“
* **[V]** Table: „Reichweite der Auspex-Phalanx“
* **[V]** Table: „Stufe | Reichweite in Systemen“
* **[V]** Heading: „Mondbruch“
* **[V]** Text: „Mit Weltenbrechern lässt sich der Mond eines anderen Spielers zerstören (Mondbruch). Nach einem gewonnenen Kampf, oder gegen einen Mond ohne Verteidigung, folgen zwei voneinander unabhängige Würfe: ob der Mond zerbricht und ob die Weltenbrecher vom eigenen Schuss zerrissen werden. Je größer der Mond, desto seltener zerbricht er und desto eher gehen die Weltenbrecher verloren; je mehr Weltenbrecher, desto eher zerbricht er. Ein zerbrochener Mond ist mit allem, was auf ihm war, verloren und hinterlässt kein Trümmerfeld. Flotten, die zu ihm unterwegs sind, landen auf seinem Planeten.“
* **[V]** Formula: „Chance auf Mondbruch in % = (100 − √Durchmesser) · √Weltenbrecher, höchstens 100“
* **[V]** Formula: „Chance auf Verlust der Weltenbrecher in % = √Durchmesser ÷ 2“
* **[V]** Table: „Chance auf Mondbruch in Prozent“
* **[V]** Table: „Durchmesser in km | 1 Weltenbrecher | 4 Weltenbrecher | 16 Weltenbrecher“
* **[V]** Table: „Chance auf Verlust der Weltenbrecher“
* **[V]** Table: „Durchmesser in km | Verlust“
* **[V]** Keywords: Mond, Trabant, Zitadelle, Phalanx, zerbrechen

### Warp-Tor und Auspex-Phalanx (`rule-gates`)

* **[V]** Line: „Wie Schiffe zwischen eigenen Monden springen, wie lange die Tore danach abkühlen und was ein Scan der Auspex-Phalanx zeigt.“
* **[V]** Heading: „Der Sprung“
* **[V]** Text: „Das Warp-Tor steht nur auf einem Mond. Ein Sprung geht vom Tor des Mondes, auf dem du gerade bist, zu einem anderen eigenen Mond, auf dem ein Warp-Tor bereit ist. Er verlegt Schiffe sofort und ohne Treibstoff; Rohstoffe bleiben zurück. Es springen nur Schiffe, die fliegen können, also keine Sonnenreliquiare, und du wählst sie aus, höchstens so viele, wie auf dem Mond stehen. Flotten anderer Spieler, die dort Wache halten, bleiben und verteidigen weiter (Wache stellen und Verbandsangriff).“
* **[V]** Text: „Geprüft wird in dieser Reihenfolge: zuerst das Starttor (ein Mond, ein Tor darauf, nicht in Abkühlung), dann das Ziel (ein anderer eigener Mond mit einem Tor, das nicht in Abkühlung ist), dann die Schiffe (mindestens eines, alle fliegend).“
* **[V]** Heading: „Wartezeit nach dem Sprung“
* **[V]** Text: „Nach einem Sprung kühlen beide Tore ab, das Starttor und das Zieltor, und zwar so lange, wie die Stufe des Starttors es verlangt; die Stufe des Zieltors ändert nichts daran. Die Zeit sinkt mit der Stufe, aber nicht gleichmäßig, und ab einer Stufe nicht mehr. Die Minuten der Tabelle teilt das Universum durch sein Tempo; ein schnelleres kühlt die Tore also schneller ab. Solange ein Tor abkühlt, kann es weder starten noch Ziel eines Sprungs sein.“
* **[V]** Formula: „Wartezeit in Minuten = Minuten der Tabelle für die Stufe des Starttors ÷ Geschwindigkeit des Universums“
* **[V]** Table: „Wartezeit nach der Stufe des Starttors“
* **[V]** Table: „Stufe | Minuten | Zeit in diesem Universum“
* **[V]** Heading: „Der Scan der Auspex-Phalanx“
* **[V]** Text: „Die Auspex-Phalanx steht nur auf einem Mond. Von dort scannst du einen fremden Planeten in Reichweite: Sie zeigt alle Flüge von und zu diesem Planeten, von jedem Spieler, nach Ankunft geordnet, mit Schiffen, Herkunft, Ziel und Ankunft, aber ohne Ladung, Besitzer, Auftrag und Treibstoff. Eine Flotte, die dort Wache hält, zeigt sich als haltend, mit dem Ende ihrer Haltezeit. Flüge des Mondes dieses Planeten gehören nicht dazu. Ein Scan kostet 5.000 Promethium auf dem Mond, auch wenn gerade nichts fliegt. Der gescannte Spieler bekommt keinen Bericht und erfährt nichts davon.“
* **[V]** Text: „Die Reichweite zählt in Systemen, nur in der Galaxie des Mondes und ohne Umlauf um ihr Ende; die Tabelle dazu steht unter Monde. Nicht scannen lassen sich Monde, eigene Planeten und freie Positionen. Auch diese Ablehnungen und ein Ziel außer Reichweite kosten nichts.“
* **[V]** Formula: „Reichweite in Systemen = Stufe² − 1“
* **[V]** Keywords: Warp, springen, Scan, Wartezeit, Phalanx

### Planeten und Felder (`rule-planets`)

* **[V]** Line: „Wie viele Gebäudestufen ein Planet fasst, wie groß und warm eine neue Kolonie wird und wie du eine Stufe zurückbaust.“
* **[V]** Heading: „Größe und Felder“
* **[V]** Text: „Wie viele Gebäudestufen ein Planet fasst, hängt von seinem Durchmesser ab: Er hat so viele Felder wie das Quadrat seines Durchmessers in tausend Kilometern, abgerundet. Jede Gebäudestufe belegt ein Feld; Schiffe, Verteidigung und Forschung belegen keines. Ohne freies Feld lässt sich keine weitere Gebäudestufe bauen. Jede Stufe der Weltenschmiede schafft 5 Felder, von denen sie selbst eines belegt, und in diesem Universum bekommt jeder Planet außerdem 0 Zusatzfelder. Dein Heimatplanet hat immer 163 Felder.“
* **[V]** Formula: „Felder = ⌊(Durchmesser in km ÷ 1.000)²⌋ + Zusatzfelder + 5 · Stufe der Weltenschmiede“
* **[V]** Heading: „Neue Kolonien nach Position“
* **[V]** Text: „Eine neue Kolonie bekommt zuerst eine zufällige Zahl von Feldern aus dem Bereich ihrer Position und dann einen Durchmesser, der dazu passt. Die Tabelle zeigt den Bereich je Position, dazu die Temperatur und den Typ des Planeten.“
* **[V]** Table: „Felder, Temperatur und Typ einer neuen Kolonie nach Position“
* **[V]** Table: „Position | Felder | Höchsttemperatur | Typ im ungeraden System | Typ im geraden System“
* **[V]** Text: „Die Temperatur sinkt mit jeder Position nach außen gleichmäßig; der Wert einer Kolonie liegt um einen festen Spielraum um die Mitte ihrer Position. Je kälter der Planet, desto mehr Promethium fördert die Promethium-Raffinerie. Der Typ eines Planeten folgt allein aus seiner Position und ist nur ein Aussehen; er ändert keinen Wert.“
* **[V]** Formula: „Mitte der Höchsttemperatur in °C = 130 − (Position − 1) · 10“
* **[V]** Heading: „Eine Stufe zurückbauen“
* **[V]** Text: „Ein Gebäude lässt sich um eine Stufe zurückbauen, jeweils eine Stufe je Auftrag. Der Rückbau läuft in der Bauschleife des Planeten und nimmt einen Teil der Bauzeit der Stufe in Anspruch. Ist der Erstattungsfaktor der Runde positiv, bekommst du diesen Anteil der Kosten der Stufe zurück, sobald der Rückbau fertig ist. Ist er negativ, kostet der Rückbau diesen Anteil schon beim Start, und du musst ihn bezahlen können. In dieser Runde beträgt der Faktor 50 % und der Rückbau 50 % der Bauzeit. Der Admin legt beides für die Runde fest.“
* **[V]** Formula: „Erstattung bei positivem Faktor = ⌊Kosten der Stufe · Faktor ÷ 100⌋, nach dem Rückbau“
* **[V]** Formula: „Kosten bei negativem Faktor = ⌊Kosten der Stufe · |Faktor| ÷ 100⌋, beim Start“
* **[V]** Text: „Der Faktor reicht von -100 % bis 100 %. Zurückbauen geht nicht auf einem Mond, nicht ohne Stufe und nicht, solange die Bauschleife des Planeten läuft. Auch nicht, solange das Gebäude gebraucht wird, also nicht, wenn die Schiffsschmiede Aufträge hat oder das Scholarium forscht, und nicht, wenn danach mehr Felder belegt wären, als der Planet hat, wie bei der Weltenschmiede. Die Raketenkrypta lässt sich nicht zurückbauen, wenn ihre Plätze danach für die Raketen nicht mehr reichen, die Raketen in der Schiffsschmiede mitgezählt; dann baust du erst Raketen ab. Die Punkte der Highscore sinken um die Kosten der zurückgebauten Stufe.“
* **[V]** Keywords: Planet, Felder, Platz, Temperatur, abreißen

### Kolonien und Planetengrenze (`rule-colonies`)

* **[V]** Line: „Wie du eine Kolonie gründest, wie viele Planeten du haben darfst, wie du eine aufgibst und was der Hauptplanet ist.“
* **[V]** Heading: „Eine Kolonie gründen“
* **[V]** Text: „Eine Kolonie gründest du mit einer Kolonistenarche und dem Auftrag Landnahme. Das Ziel muss eine freie Position sein: Eine Position, an der eine Kolonie aufgegeben wurde, bleibt für jede Landnahme eine Zeit lang gesperrt, und die Expeditionsposition am Rand jedes Systems lässt sich nie besiedeln. Ist die Position bei der Ankunft nicht mehr frei, kehrt die Flotte mit ihrer Ladung um. Die Arche bleibt in der neuen Kolonie, und die Ladung der Flotte wird ihr erster Vorrat. Größe und Temperatur der Kolonie stehen unter Planeten und Felder; eine Vermessung zeigt sie vorher und hält sie 30 Tage fest.“
* **[V]** Heading: „Die Planetengrenze“
* **[V]** Text: „Der Admin kann für die Runde festlegen, wie viele Planeten ein Spieler besitzen darf, der Heimatplanet eingerechnet. Monde zählen nicht mit. Beim Start einer Landnahme zählen deine Planeten und die Landnahmen, die schon unterwegs sind, zusammen; ist die Grenze damit erreicht, wird der Start abgelehnt. Bei der Ankunft zählen nur die Planeten, die du hast: Ist die Grenze dann erreicht, kehrt die Flotte mit der Arche und ihrer Ladung zurück. Auf Wunsch des Admins gibt es die Forschung Kolonialverwaltung, die die Grenze um einige Planeten je Stufe anhebt, nie über 20 Planeten insgesamt; sie gibt es nur in einer Runde mit Grundgrenze und lässt sich nur bis zur höchsten Stufe erforschen, die der Admin festlegt. Eine höhere Stufe zählt wie diese. Ohne Grundgrenze gibt es keine Grenze.“
* **[V]** Facts: „Grundgrenze in dieser Runde: keine Grenze“
* **[V]** Facts: „Kolonialverwaltung in dieser Runde: nein“
* **[V]** Heading: „Eine Kolonie aufgeben“
* **[V]** Text: „Eine Kolonie kannst du aufgeben, mit deinem Passwort. Nicht aufgeben lässt sich der Hauptplanet, und es darf nichts mehr auf die Kolonie oder ihren Mond verweisen: kein Flug von dort oder dorthin, keine Forschung, die dort läuft, und kein Auftrag der Bauschleife oder der Schiffsschmiede. Alles auf der Kolonie ist dann verloren, auch ihr Mond. Die Position bleibt 24 Stunden für eine Landnahme gesperrt; der Admin legt das für die Runde fest.“
* **[V]** Text: „Der Admin kann sie auf 1 bis 720 Stunden einstellen.“
* **[V]** Heading: „Der Hauptplanet“
* **[V]** Text: „Der Hauptplanet ist der Planet, den du in den Optionen wählst; ohne Wahl ist es dein erster Planet. Er bestimmt nur, wohin die Navigation springt und wo geforscht wird. Wechselst du, sperrt das den nächsten Wechsel für 7 Tage; der Admin legt das für die Runde fest. Verlierst du den gewählten Planeten, wird der älteste Planet, den du noch hast, zum Hauptplaneten, ohne Sperre. Die Sperre kann der Admin auf 1 bis 30 Tage einstellen.“
* **[V]** Keywords: Kolonie, Planetengrenze, gründen, aufgeben, Hauptplanet

### Raketen (`rule-missiles`)

* **[V]** Line: „Wo Raketen lagern, wie weit und wie schnell sie fliegen und was sie am Ziel zerstören.“
* **[V]** Heading: „Raketenkrypta und Raketen“
* **[V]** Text: „Raketen lagert die Raketenkrypta, und zwar nur auf Planeten, nicht auf einem Mond. Jede Stufe schafft 10 Plätze. Eine Abfangrakete belegt 1 Platz, eine Orbitalrakete 2 Plätze; ein Auftrag, für den der Platz nicht reicht, wird abgelehnt. Gezählt werden die Raketen, die schon lagern, und die, die in der Schiffsschmiede in Auftrag sind. Raketen kämpfen in keinem Kampf mit und zählen nur für die Gesamtpunkte; sie werden gebaut wie Verteidigung.“
* **[V]** Formula: „Platz für Raketen = 10 · Stufe der Raketenkrypta“
* **[V]** Heading: „Abschuss, Reichweite und Flugzeit“
* **[V]** Text: „Orbitalraketen startest du in der Sternenkarte, von einem Planeten, auf dem sie lagern, auf einen fremden Planeten oder Mond in derselben Galaxie. Sie brauchen keinen Flottenslot und lassen sich nicht zurückrufen. Die Reichweite hängt von deinem Plasma-Impulsantrieb ab und zählt in Systemen; ohne den Antrieb ist kein Ziel in Reichweite. Der Abschuss wird verweigert, wenn dort kein Planet oder Mond steht, wenn er dir gehört, wenn er außer Reichweite liegt, wenn sein Besitzer im Urlaubsmodus ist oder unter dem Schutz der Schwachen steht. Die Raketen verlassen die Verteidigung des Startplaneten schon beim Abschuss.“
* **[V]** Formula: „Reichweite in Systemen = 5 · Stufe des Plasma-Impulsantriebs − 1“
* **[V]** Formula: „Flugzeit in Sekunden = (30 + 60 · Systeme) ÷ Tempo des Universums“
* **[V]** Table: „Reichweite nach dem Plasma-Impulsantrieb“
* **[V]** Table: „Stufe | Reichweite in Systemen“
* **[V]** Table: „Flugzeit nach der Entfernung in diesem Universum“
* **[V]** Table: „Systeme | Flugzeit“
* **[V]** Stand: „Dein Stand: Stufe 0 des Plasma-Impulsantriebs, Reichweite keine.“
* **[V]** Heading: „Der Einschlag“
* **[V]** Text: „Am Ziel hält jede Abfangrakete des Verteidigers eine Orbitalrakete auf, an einem Mond die Abfangraketen seines Planeten. Die übrigen Raketen richten Schaden an, und zwar nur an Verteidigung, die im Kampf mitkämpft; Schilde zählen nicht. Der Schaden geht zuerst auf das Hauptziel, wenn du beim Abschuss eines wählst, danach auf alle Arten der Reihe nach: Raketenbatterie, Lichtlanze, Schwere Lichtlanze, Massebeschleuniger, Ionenlanze, Plasmabatterie, Kleiner Schutzdom, Großer Schutzdom. Ein Stück ist zerstört, wenn der Schaden seine ganze Struktur deckt; was für ein weiteres Stück nicht reicht, geht an die nächste Art. Angriff und Struktur steigen mit der Forschung: Waffensegnung beim Angreifer, Adamant-Panzerung beim Verteidiger, je 10 % des Grundwerts je Stufe.“
* **[V]** Formula: „Zerstörte Stücke der Hauptziel-Art = ⌊(Raketen − abgefangene) · 12.000 · (1 + 0,1 · Stufe der Waffensegnung) ÷ (Struktur · (1 + 0,1 · Stufe der Adamant-Panzerung))⌋, höchstens so viele, wie da sind“
* **[V]** Table: „Struktur und Zerstörung als Hauptziel, ohne Forschung und ohne Abfangraketen“
* **[V]** Table: „Verteidigung | Struktur | 1 Orbitalrakete | 5 Orbitalraketen | 10 Orbitalraketen | 25 Orbitalraketen“
* **[V]** Text: „Ist keine Verteidigung mehr übrig, geht der Rest des Schadens auf die Raketen, die in der Raketenkrypta des Ziels lagern, in der Reihenfolge des Katalogs (Abfangrakete, Orbitalrakete); Abfangraketen, die schon eine Orbitalrakete aufgehalten haben, sind dabei nicht mehr da. Zerstörte Verteidigung wird nicht wieder aufgebaut und hinterlässt kein Trümmerfeld. Beide Seiten bekommen einen Bericht. Steht bei der Ankunft kein fremder Planet oder Mond mehr an der Position, sind die Raketen verloren.“
* **[V]** Keywords: Raketen, Raketenkrypta, Abfangraketen, Reichweite, Schaden

### Vermessung (`rule-survey`)

* **[V]** Line: „Wie du eine freie Position vermisst, was der Bericht je nach Auspex-Wert zeigt und wann Spähschädel verloren gehen.“
* **[V]** Heading: „Was eine Vermessung ist“
* **[V]** Text: „Mit einer Vermessung erfährst du vor der Landnahme, was an einer freien Position auf dich wartet. Dafür fliegen nur Spähschädel, und der Auftrag braucht die Auspex-Kartographie, mindestens die erste Stufe; ohne sie ist er nicht zu haben. Die Flotte belegt wie jede Flotte einen Flottenslot und fliegt nach der Messung heim. Ist die Position bei der Ankunft nicht mehr frei oder nach einer aufgegebenen Kolonie noch gesperrt, kehrt sie um.“
* **[V]** Text: „Die Werte der Position, ihren Durchmesser und ihre Temperatur, bekommt sie bei der ersten Vermessung, die einen Bericht bringt, nach denselben Regeln wie eine neue Kolonie (Planeten und Felder). Sie bleiben 30 Tage erhalten, gezählt ab dieser ersten Vermessung; eine weitere Vermessung beginnt die Zeit nicht neu. Wird die Position in dieser Zeit besiedelt, bekommt die Kolonie genau diese Werte. Sonst werden Werte und Berichte danach gelöscht, und eine neue Vermessung würfelt neue. Gehen die Spähschädel verloren, gibt es keinen Bericht und die Position bekommt keine Werte.“
* **[V]** Heading: „Auspex-Wert und Bericht“
* **[V]** Text: „Wie viel der Bericht zeigt, hängt vom Auspex-Wert der Vermessung ab. Jeder Spähschädel zählt einmal, jede Stufe der Auspex-Kartographie doppelt. Je höher der Auspex-Wert, desto mehr steht im Bericht; die Liste nennt, was ab welchem Wert dazukommt. Gezählt werden die Spähschädel, die ankommen, und die Stufe bei der Ankunft.“
* **[V]** Formula: „Auspex-Wert = Spähschädel + 2 · Stufe der Auspex-Kartographie“
* **[V]** Table: „Auspex-Wert nach Spähschädeln und Stufe der Auspex-Kartographie“
* **[V]** Table: „Spähschädel | Stufe 1 | Stufe 2 | Stufe 3 | Stufe 5“
* **[V]** Facts: „Unter 4: Nur, was sich von der Position erraten lässt: der Planetentyp, die Spanne der Felder an dieser Position, die Temperatur um einen Mittelwert, die Bahn und eine Größe mit dem Zusatz vermutlich. Der Bericht ist als ungenau markiert.“
* **[V]** Facts: „Ab 4: Dazu die Felder des Planeten, um 20 % nach oben und unten, und seine höchste Temperatur, um 10 °C nach oben und unten. Das Fenster behält seine Breite, liegt aber zufällig verschoben; der wahre Wert liegt immer darin.“
* **[V]** Facts: „Ab 7: Die Felder und die höchste Temperatur des Planeten genau.“
* **[V]** Facts: „Ab 10: Alles, was über den Planeten bekannt ist: Temperatur, Durchmesser, Felder im Vergleich mit dem Durchschnitt der Position, Planetentyp, Promethium-Faktor, Energie eines Sonnenreliquiars und Vor- und Nachteile als Stichworte.“
* **[V]** Heading: „Was der grobe Bericht von der Position sagt“
* **[V]** Text: „Der grobe Bericht nennt die Bahn und damit die Temperatur der Position und schätzt die Größe. Die Bahn ergibt sich aus der Position im System: ein Fünftel der Positionen liegt innen, drei Fünftel in der Mitte, ein Fünftel außen. Die Größe richtet sich nach dem Durchschnitt der Felder an der Position, in drei gleich breiten Teilen der Spanne aller Positionen.“
* **[V]** Table: „Bahn nach der Position in diesem Universum“
* **[V]** Table: „Positionen | Bahn“
* **[V]** Table: „Größe nach dem Durchschnitt der Felder der Position“
* **[V]** Table: „Felder im Durchschnitt | Größe“
* **[V]** Heading: „Verlust der Spähschädel“
* **[V]** Text: „Beim Eintreffen können die Spähschädel verloren gehen. Dabei wird zuerst eine Verlustchance zwischen null und dem Höchstwert ausgelost und dann einmal gewürfelt, ob die ganze Flotte verloren ist; dann gibt es keinen Bericht. Mehr Spähschädel erhöhen den Höchstwert, ein weiter Weg auch, jede Stufe der Auspex-Kartographie senkt beides. Die Entfernung wird gemessen wie bei jedem Flug (Flug und Treibstoff), vom Startplaneten aus.“
* **[V]** Formula: „Höchste Verlustchance in % = Spähschädel · 5 ÷ Stufe + 6 · (Entfernung ÷ 1.000)^0,8 ÷ (1 + 0,4 · Stufe), höchstens 60 %“
* **[V]** Table: „Höchste Verlustchance bei einem Weg von 5 Systemen“
* **[V]** Table: „Spähschädel | Stufe 1 | Stufe 2 | Stufe 3 | Stufe 5“
* **[V]** Table: „Höchste Verlustchance mit 4 Spähschädeln nach Entfernung“
* **[V]** Table: „Systeme entfernt | Stufe 1 | Stufe 2 | Stufe 3 | Stufe 5“
* **[V]** Keywords: Vermessung, vermessen, Position, Kartographie, Bericht

### Expeditionen (`rule-expeditions`)

* **[V]** Line: „Wohin eine Expedition fliegt, wie lange sie bleibt und was sie finden, erleben oder verlieren kann.“
* **[V]** Heading: „Ziel, Plätze und Haltezeit“
* **[V]** Text: „Eine Expedition fliegt zur Expeditionsposition am Rand jedes Systems, der Position 16 in diesem Universum, gleich hinter der letzten Planetenposition. Dort lässt sich nichts besiedeln. Der Auftrag braucht die Kreuzzugs-Kartografie, mindestens die erste Stufe, und belegt einen Flottenslot und einen Expeditionsplatz. Die Plätze zählen auch die Expeditionen, die schon auf dem Heimweg sind. Die Haltezeit wählst du beim Start in ganzen Stunden bis zum Höchstwert; erst wenn sie um ist, wird das Ergebnis der Expedition ausgelost, und die Flotte fliegt heim. Die Haltezeit kostet keinen Treibstoff.“
* **[V]** Formula: „Expeditionsplätze = ⌊√Stufe der Kreuzzugs-Kartografie⌋ + zusätzliche Plätze der Runde“
* **[V]** Formula: „Höchste Haltezeit in Stunden = Stufe · Stunden je Stufe der Runde“
* **[V]** Table: „Plätze und Haltezeit nach der Stufe in dieser Runde“
* **[V]** Table: „Stufe | Expeditionsplätze | Höchste Haltezeit | Dauer in diesem Universum“
* **[V]** Stand: „Dein Stand: Stufe 0 der Kreuzzugs-Kartografie, 0 Expeditionsplätze, höchste Haltezeit 0 Std.“
* **[V]** Heading: „Was geschehen kann“
* **[V]** Text: „Nach der Haltezeit wird einmal ausgelost: In etwa 84 % der Expeditionen bringen ein Ereignis, die anderen kehren ohne etwas heim. Welches Ereignis es ist, folgt den Anteilen der Tabelle; außer dem Verlust der Flotte hat jedes eine Größe. Das Ergebnis steht im Bericht, und was von der Flotte übrig ist, fliegt heim.“
* **[V]** Table: „Anteil der Ereignisse“
* **[V]** Table: „Ereignis | Anteil an allen Expeditionen | Anteil an den Ereignissen“
* **[V]** Table: „Anteil der Größen unter den Ereignissen mit Größe“
* **[V]** Table: „Größe | Anteil“
* **[V]** Heading: „Rohstofffund“
* **[V]** Text: „Ein Rohstofffund beginnt mit einer Grundzahl, die mit der Größe des Ereignisses wächst. Dann wird die Sorte ausgelost. Die Grundzahl wird durch den Teiler der Sorte geteilt und mit einem Faktor malgenommen, der aus den Expeditionspunkten deiner Flotte folgt: Sie zählen aus den Kosten ihrer Schiffe in Adamant und Psikristall, mindestens so viel wie angegeben und höchstens bis zur Obergrenze, die mit den Punkten des Ersten der Rangliste steigt. Mitgenommen wird nur, was die Laderäume fassen; die Hälfte des verbrauchten Treibstoffs belegt dort schon Platz.“
* **[V]** Formula: „Fund = ⌊Grundzahl ÷ Teiler der Sorte · Faktor⌋, höchstens der freie Laderaum; Faktor = Expeditionspunkte, mindestens 200 und höchstens die Obergrenze“
* **[V]** Formula: „Expeditionspunkte = Summe über alle Schiffe (Anzahl · (Adamant + Psikristall des Schiffs)) · 5 ÷ 1.000“
* **[V]** Table: „Grundzahl, Teiler und Anteil je Sorte“
* **[V]** Table: „Sorte | Teiler | Anteil an den Funden“
* **[V]** Table: „Grundzahl eines Rohstofffunds nach Größe“
* **[V]** Table: „Größe | Grundzahl“
* **[V]** Table: „Obergrenze der Punkte nach den Punkten des Ersten der Rangliste“
* **[V]** Table: „Punkte des Ersten | Rohstofffund | Schiffsfund“
* **[V]** Heading: „Schiffsfund“
* **[V]** Text: „Bei einem Schiffsfund haben die gefundenen Schiffe zusammen so viele Strukturpunkte, wie die Grundzahl der Größe mal die Expeditionspunkte der Flotte ergibt, mindestens aber 10.000. Dann wird immer wieder ein Schiff ausgelost, alle gleich wahrscheinlich, und davon eine Anzahl gefunden, bis die Punkte aufgebraucht sind oder das ausgeloste Schiff nicht mehr hineinpasst; dort endet der Fund. Gefunden werden kann, was bis zu einem Schritt schwerer ist als das schwerste Schiff der Flotte. Die Schiffe schließen sich der Flotte an. Die Kolonistenarche, die Bergungsbarke und der Weltenbrecher finden nichts und werden nie gefunden; eine Flotte nur aus ihnen findet keine Schiffe.“
* **[V]** Table: „Grundzahl eines Schiffsfunds nach Größe“
* **[V]** Table: „Größe | Grundzahl“
* **[V]** Table: „Was eine Flotte finden kann, nach ihrem schwersten Schiff“
* **[V]** Table: „Schwerstes Schiff der Flotte | Findbare Schiffe“
* **[V]** Heading: „Piraten und Aliens“
* **[V]** Text: „Bei einem Kampf gegen Piraten oder Aliens greifen sie an, und deine Flotte verteidigt sich. Von jeder Schiffsart deiner Flotte kommt ein Anteil als Angreifer, der um ein Zehntel nach oben oder unten streut, dazu einige Schiffe einer festen Art. Waffen, Schilde und Panzerung der Angreifer richten sich nach deiner Forschung. Gekämpft wird nach den Regeln des Kampfes (Kampf). Die zerstörten Schiffe beider Seiten hinterlassen ein Trümmerfeld an der Expeditionsposition, das eine Bergung einsammeln kann (Trümmerfelder und Bergung). Was von deiner Flotte übrig ist, fliegt heim; ist nichts mehr übrig, ist die Flotte verloren. Der Bericht ist ein Kampfbericht.“
* **[V]** Formula: „Angreifer einer Art = Schiffe der Art in deiner Flotte · Anteil · (1 − 0,1 + 2 · 0,1 · Zufall von 0 bis 1), bei Piraten abgerundet, bei Aliens aufgerundet; dazu die zusätzlichen Schiffe“
* **[V]** Formula: „Stufe der Piraten = Stufe deiner Forschung − 3, mindestens 0“
* **[V]** Formula: „Stufe der Aliens = Stufe deiner Forschung + 3“
* **[V]** Table: „Die Angreifer nach Größe“
* **[V]** Table: „Angreifer | Größe | Anteil je Schiffsart | Zusätzliche Schiffe“
* **[V]** Heading: „Frühere und spätere Rückkehr, Verlust“
* **[V]** Text: „Eine Expedition kann sich verirren oder eine Abkürzung finden, und die Zeit des Heimflugs ändert sich dann wirklich. Bei einer späteren Rückkehr dauert der Heimflug um die Haltezeit mal den Faktor der Größe länger. Bei einer früheren wird er um ein Drittel der Haltezeit mal den Faktor kürzer, mindestens 1 Sek. lang bleibt er aber. Beim Verlust der Flotte kommt nichts zurück, und es bleibt kein Trümmerfeld.“
* **[V]** Formula: „Spätere Rückkehr: Heimflug = Flugzeit + Haltezeit · Faktor“
* **[V]** Formula: „Frühere Rückkehr: Heimflug = Flugzeit − Haltezeit ÷ 3 · Faktor, mindestens 1 Sek.“
* **[V]** Table: „Der Faktor nach Größe“
* **[V]** Table: „Größe | Faktor“
* **[V]** Heading: „Einstellungen dieser Runde“
* **[V]** Text: „Der Admin legt drei Dinge für die Runde fest und kann sie während der Runde ändern. Die Liste nennt ihre Werte jetzt und die Grenzen, in denen sie liegen dürfen.“
* **[V]** Facts: „Zusätzliche Expeditionsplätze: 0 (von 0 bis 10)“
* **[V]** Facts: „Haltezeit in Stunden je Stufe: 1 (von 1 bis 24)“
* **[V]** Facts: „Haltezeit durch das Universums-Tempo teilen: nein“
* **[V]** Keywords: Expedition, erkunden, Fund, Piraten, Haltezeit

### Wache stellen und Verbandsangriff (`rule-allies`)

* **[V]** Line: „Wer an einem fremden Planeten Wache halten darf, was die Wache tut und wie mehrere Spieler gemeinsam angreifen.“
* **[V]** Heading: „Wache stellen: wer, wo und wie lange“
* **[V]** Text: „Mit Wache stellen fliegt eine Flotte zum Planeten oder Mond eines Verbündeten, bleibt dort die Haltezeit, die du beim Start wählst, und verteidigt ihn in jedem Kampf zusammen mit seinem Besitzer; danach fliegt sie heim. Wer Verbündeter ist, legt der Admin für die Runde fest. Eine Gilde zählt nur, solange es in der Runde Gilden gibt (Gilden). Bei einem Spieler im Urlaubsmodus oder unter dem Schutz der Schwachen kann niemand Wache stellen.“
* **[V]** Facts: „Verbündete für Halten und Verband: Gilde und Freunde“
* **[V]** Facts: „Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre: 2 (von 0 bis 30)“
* **[V]** Text: „Die Haltezeit beträgt 0, 1, 2, 4, 8, 16 oder 32 Stunden. Sie läuft in Echtzeit, das Tempo des Universums teilt sie nicht. Den Treibstoff für die Haltezeit zahlst du beim Start zusammen mit dem für den Flug: ein Zehntel des Grundverbrauchs der Flotte je Stunde, mindestens 1 Promethium. An einem Planeten halten höchstens 4 verschiedene Spieler mit zusammen höchstens 15 Flotten, die eigene Flotte des Besitzers nicht mitgerechnet; gezählt werden auch Flotten, die noch unterwegs sind. Solange eine Flotte Wache hält, kannst du sie zurückrufen; sie ist dann nach so langer Zeit zu Hause, wie ihr Hinflug gedauert hat.“
* **[V]** Formula: „Treibstoff der Haltezeit = ⌊Summe aller Schiffe (Anzahl · Grundverbrauch) · Stunden ÷ 10⌋, mindestens 1“
* **[V]** Heading: „Was eine Wache tut“
* **[V]** Text: „Eine Flotte, die Wache hält, kämpft als eigene Partei mit der Forschung ihres Besitzers, und zwar in allen drei Kämpfen an diesem Ort: beim Sturmangriff, beim Mondbruch und im Kampf gegen entdeckte Spähschädel der Auspex-Erkundung. Raketen kämpfen nicht mit. Jeder Besitzer bekommt den Bericht des Verteidigers, und was die Wache verliert, liegt zum Teil im Trümmerfeld (Trümmerfelder und Bergung). Eine Flotte des Angreifers selbst, die dort Wache hält, bleibt aus dem Kampf. Gewinnt der Angreifer, nimmt er zuerst seinen Anteil vom Vorrat des Planeten und dann die ganze Ladung der Flotten, die Wache gehalten haben, soweit sein Laderaum reicht; diese Flotten sind dann zerstört (Kampf).“
* **[V]** Text: „Der Gastgeber sieht eine Flotte, die Wache hält, mit allen Schiffen und ihrer Haltezeit. Im Auspex-Bericht zählt sie zur Flotte des Planeten, bis die Auspex-Lehre des Spähers die Stufe der Runde erreicht; ab dann steht sie getrennt unter Gehaltene Flotten. In der Auspex-Phalanx zeigt sie sich als haltend, mit dem Ende ihrer Haltezeit.“
* **[V]** Heading: „Urlaubsmodus und Mondbruch“
* **[V]** Text: „Beginnt der Gastgeber den Urlaubsmodus, fliegen alle Flotten, die bei ihm Wache halten, sofort heim, und ihre Besitzer bekommen einen Bericht. Eine Flotte, die noch unterwegs ist, hält bei der Ankunft nicht mehr, sondern kehrt gleich um. Wer selbst mit einer Flotte Wache hält, kann den Urlaubsmodus nicht beginnen, solange sie draußen ist (Urlaubsmodus).“
* **[V]** Text: „Zerbricht ein Mond (Monde), wechseln die Flotten, die dort Wache halten und am Kampf nicht beteiligt waren, zum Planeten des Mondes und halten dort bis zum Ende ihrer Zeit weiter; die Grenzen des Planeten werden dabei nicht geprüft, und ihre Besitzer bekommen einen Bericht. Da ein Mond nur nach einem gewonnenen Kampf zerbricht und dieser keinen Verteidiger übrig lässt, betrifft das nur die eigene Flotte des Angreifers.“
* **[V]** Heading: „Verbandsangriff: eröffnen, einladen, beitreten“
* **[V]** Text: „Einen Angriffsverband eröffnest du aus einem eigenen Sturmangriff, der noch unterwegs ist: nicht zurückgerufen, noch nicht angekommen und in keinem Verband. Dieser Angriff führt den Verband an. Der Anführer lädt Verbündete mit Namen ein, nicht den Besitzer des Ziels; die Eingeladenen zählen schon gegen die Grenze der Spieler. Wer Verbündeter ist, bestimmt dieselbe Einstellung wie bei der Wache. Beitreten heißt, einen Sturmangriff auf dasselbe Ziel zu schicken, mit allen Prüfungen eines Angriffs: Schiffe, Treibstoff, Flottenslots, Urlaubsmodus und Schutz des Ziels. Der Anführer und wer schon im Verband ist, braucht keine Einladung, alle anderen schon; ein Spieler darf mehrere Flotten schicken. Ein Spieler im Urlaubsmodus kann nicht beitreten.“
* **[V]** Heading: „Ankunft, Verspätung und Grenzen“
* **[V]** Text: „Alle Flotten eines Verbands kommen gemeinsam an und kämpfen in einem Kampf als mehrere Angreifer, jede mit der Forschung ihres Besitzers; die Flotte des Anführers führt. Eine Flotte, die früh genug da wäre, wartet und kommt mit den anderen an. Eine, die später käme, verzögert den Verband, aber höchstens um 30 % der Restflugzeit; dann verschieben sich Ankunft und Rückkehr aller Flotten im Verband um die Verspätung. Eine Flotte, die den Verband stärker verzögern würde, wird abgelehnt. Eine Sperre kurz vor der Ankunft gibt es in dieser Runde nicht. Ein Verband, der angekommen ist, ist geschlossen. Eine beigetretene Flotte kehrt nach der Dauer ihres eigenen Flugs zurück.“
* **[V]** Formula: „Eine Flotte darf den Verband verzögern, wenn (ihre Ankunft − Ankunft des Verbands) · 100 ≤ Verspätung in Prozent · Restflugzeit“
* **[V]** Table: „Die größte Verspätung nach der Restflugzeit“
* **[V]** Table: „Restflugzeit | Größte Verspätung“
* **[V]** Facts: „Verbandsangriff: höchstens Flotten: 16 (von 1 bis 50)“
* **[V]** Facts: „Verbandsangriff: höchstens Spieler: 5 (von 1 bis 20)“
* **[V]** Facts: „Verbandsangriff: Verspätung in Prozent der Restflugzeit: 30 (von 0 bis 100)“
* **[V]** Facts: „Verbandsangriff: kein Beitritt in den letzten Minuten (0 = aus): 0 (von 0 bis 1.440)“
* **[V]** Heading: „Beute und Rückruf“
* **[V]** Text: „Es gibt eine einzige Beute wie bei einem einzelnen Angreifer; sie reicht höchstens so weit, wie der freie Laderaum aller überlebenden Schiffe zusammen. Sie wird nach dem freien Laderaum auf die Flotten verteilt; keine Flotte bekommt mehr, als sie tragen kann, und was nirgends Platz findet, wird nicht ausgegeben. Jede Flotte behält ihre eigene Ladung und fliegt damit heim; eine Flotte ohne Überlebende ist verloren.“
* **[V]** Formula: „Anteil einer Flotte an der Beute = ⌊Beute · freier Laderaum der Flotte ÷ freier Laderaum aller Flotten⌋, die übrigen Einheiten gehen der Reihe nach an die ersten Flotten, die noch Platz haben“
* **[V]** Text: „Ruft der Anführer seine Flotte zurück, ist der Angriff für alle aufgelöst und alle Flotten kehren um; die anderen Besitzer bekommen einen Bericht. Ruft ein Teilnehmer seine Flotte zurück, kehrt nur sie um und verlässt den Verband, die Ankunft des Verbands bleibt. Gegen den ganzen Verband verteidigen auch die Flotten, die am Ziel Wache halten, jede als eigene Partei; eine eigene Flotte eines Spielers des Verbands, die dort Wache hält, bleibt aus dem Kampf. Der Mondbruch, die Raketen und die Auspex-Erkundung kennen keinen Verband. Der Verteidiger sieht jede Flotte wie sonst auch, aber nichts vom Verband.“
* **[V]** Keywords: Wache, verteidigen, Verband, gemeinsam, Beute

### Produktion, Energie und Lager (`rule-production`)

* **[V]** Line: „Was ein Planet fördert, warum eine Mine weniger bringt als angegeben und wo die Förderung endet.“
* **[V]** Heading: „Was ein Planet fördert“
* **[V]** Text: „Jeder Planet fördert von selbst eine Grundmenge je Stunde, auch ohne Gebäude: 100 Adamant und 50 Psikristall, mit dem Tempo des Universums malgenommen. Dazu kommt die Förderung der Gebäude. Ein Mond fördert nichts. Im Urlaubsmodus ruht die Förderung.“
* **[V]** Heading: „Energie“
* **[V]** Text: „Die Förderstätten brauchen Energie, und zwar mehr, je höher ihre Stufe ist. Reicht die erzeugte Energie des Planeten nicht für alle, fördern alle im selben Verhältnis weniger: Das ist der Energiefaktor. Er ist nie größer als eins, mehr Energie als nötig bringt also keine zusätzliche Förderung. Energie liefern die Sonnenkathedrale, das Fusionssanktum und die Sonnenreliquiare. Die Tabelle zeigt den Energiefaktor eines Planeten mit nur diesen beiden Gebäuden.“
* **[V]** Table: „Energiefaktor mit Adamant-Tiefbohrung und Sonnenkathedrale“
* **[V]** Table: „Adamant-Tiefbohrung Stufe | Sonnenkathedrale Stufe 5 | Sonnenkathedrale Stufe 10 | Sonnenkathedrale Stufe 15 | Sonnenkathedrale Stufe 20“
* **[V]** Text: „Ist der Vorrat eines Rohstoffs leer und würde weiter sinken, weil ein Gebäude ihn verbraucht, läuft dieses Gebäude gedrosselt, und zwar genau so, dass der Vorrat bei null bleibt. Den Anteil, mit dem ein Gebäude läuft, kannst du auch selbst einstellen; er senkt Förderung und Verbrauch entsprechend.“
* **[V]** Heading: „Lager“
* **[V]** Text: „Die Förderung endet, sobald das Lager eines Rohstoffs voll ist; was darüber liegt, etwa nach einer Lieferung, bleibt liegen und sinkt nur durch Verbrauch. Ohne Ausbau fasst das Lager 100.000 je Rohstoff. Die drei Lager (Adamant-Gewölbe, Psikristall-Reliquiar und Promethium-Zisterne) vergrößern es stufenweise.“
* **[V]** Keywords: Förderung, Energie, Energiemangel, Lager, Produktion

### Bauen, Forschen und Schiffsschmiede (`rule-queues`)

* **[V]** Line: „Wie lange ein Auftrag dauert, wie viele gleichzeitig laufen und was ein Abbruch zurückgibt.“
* **[V]** Heading: „Gebäude“
* **[V]** Text: „Auf jedem Planeten läuft eine Bauschleife: Ein Gebäude wird um eine Stufe ausgebaut, dann das nächste. Die Kosten werden beim Start bezahlt; brichst du den Auftrag ab, bekommst du sie voll zurück. Die Bauzeit hängt von den Kosten der Stufe ab, und jede Stufe der Servitorenschmiede beschleunigt sie, jede der Machina-Schwarmhalle halbiert sie. Eine Stufe dauert mindestens eine Sekunde, und das Tempo des Universums teilt jede Zeit.“
* **[V]** Formula: „Bauzeit in Stunden = (Adamant + Psikristall der Stufe) ÷ (2.500 · (1 + Stufe der Servitorenschmiede) · 2^Stufe der Machina-Schwarmhalle) ÷ Tempo des Universums“
* **[V]** Table: „Bauzeit im Verhältnis zu einem Planeten ohne beide Gebäude“
* **[V]** Table: „Stufe der Servitorenschmiede | Machina-Schwarmhalle Stufe 0 | Machina-Schwarmhalle Stufe 1 | Machina-Schwarmhalle Stufe 2 | Machina-Schwarmhalle Stufe 3“
* **[V]** Heading: „Forschung“
* **[V]** Text: „Es läuft immer nur eine Forschung zugleich, für alle deine Planeten zusammen. Sie braucht ein Scholarium; jede Stufe davon beschleunigt sie, aber solange es ausgebaut wird, ruht die Forschung, und es lässt sich nicht ausbauen, solange geforscht wird. Wie bei Gebäuden bekommst du die Kosten voll zurück, wenn du abbrichst.“
* **[V]** Formula: „Forschungszeit in Stunden = (Adamant + Psikristall der Stufe) ÷ (1.000 · (1 + Stufe des Scholariums)) ÷ Tempo des Universums“
* **[V]** Heading: „Schiffsschmiede“
* **[V]** Text: „Die Orbitale Schiffsschmiede arbeitet ihre Aufträge nacheinander ab; die Liste fasst höchstens 20 Aufträge, Schiffe und Verteidigung zusammen. Jede Stufe der Schiffsschmiede und der Machina-Schwarmhalle verkürzt die Zeit je Stück. Solange sie oder die Machina-Schwarmhalle ausgebaut werden, arbeitet die Schiffsschmiede nicht, und ihr Ausbau wartet auf eine leere Liste.“
* **[V]** Formula: „Zeit je Stück in Stunden = (Adamant + Psikristall des Stücks) ÷ (2.500 · (1 + Stufe der Orbitalen Schiffsschmiede) · 2^Stufe der Machina-Schwarmhalle) ÷ Tempo des Universums“
* **[V]** Text: „Einen Auftrag kannst du jederzeit abbrechen: Alle Stücke des Auftrags, die noch nicht fertig sind, werden voll erstattet, auch das, an dem gerade gearbeitet wird; dessen Fortschritt geht verloren. Fertige Stücke bleiben auf dem Planeten. Wird der erste Auftrag abgebrochen, beginnt der nächste sofort.“
* **[V]** Keywords: bauen, Bauzeit, Bauschleife, Auftrag, abbrechen

### Schutz der Schwachen (`rule-protection`)

* **[V]** Line: „Wer vor wem geschützt ist: der Noobschutz und der Schutz im Urlaubsmodus.“
* **[V]** Heading: „Noobschutz“
* **[V]** Text: „Wer viel weniger Punkte hat als du, ist vor dir geschützt: Du kannst ihn nicht angreifen und nicht erkunden, ihn nicht mit einem Mondbruch oder Raketen treffen und bei ihm keine Wache stellen. Als geschützt gilt, wer weniger als 20 % deiner Punkte hat. Es zählen die Punkte der Gesamtwertung (Highscore). Der Schutz gilt nur gegen Stärkere: Ein Spieler mit wenig Punkten darf einen mit vielen angreifen. Versorgungsflüge sind nicht betroffen. Auf der Sternenkarte sind geschützte Spieler mit (n) markiert.“
* **[V]** Formula: „Geschützt, wenn Punkte des Ziels · 5 < deine Punkte“
* **[V]** Table: „Wer vor dir geschützt ist“
* **[V]** Table: „Deine Punkte | Geschützt sind Spieler mit weniger Punkten als“
* **[V]** Text: „Der Noobschutz gilt für die Aufträge Sturmangriff, Auspex-Erkundung, Mondbruch, Raketenangriff und Wache stellen.“
* **[V]** Heading: „Urlaubsmodus“
* **[V]** Text: „Ein Spieler im Urlaubsmodus ist vor allen neuen Aufträgen anderer Spieler geschützt, ganz gleich, wie viele Punkte er hat, und auch vor Versorgungsflügen und Raketen. Seine Planeten und Monde bleiben so lange unberührt, bis er den Urlaubsmodus beendet.“
* **[V]** Keywords: Noobschutz, geschützt, Schutz, angreifen, Punkte

### Urlaubsmodus (`rule-vacation`)

* **[V]** Line: „Wie du das Spiel pausierst, was dann ruht und wann du zurückkehren kannst.“
* **[V]** Heading: „Starten“
* **[V]** Text: „Den Urlaubsmodus startest du in den Optionen. Das geht nur, wenn nichts mehr läuft: Keine eigene Flotte darf unterwegs sein, und auf keinem deiner Planeten und Monde darf ein Bauauftrag, eine Forschung oder ein Auftrag der Schiffsschmiede laufen oder warten.“
* **[V]** Heading: „Solange er läuft“
* **[V]** Text: „Deine Produktion ruht, und du kannst nichts tun, außer den Urlaubsmodus zu beenden und die Benachrichtigungen einzustellen: Das Spiel zeigt eine Sperrseite statt der Ansichten. Passwort, Passkeys und das Konto selbst kannst du weiter ändern. Alle deine Planeten und Monde sind vor neuen Aufträgen anderer Spieler geschützt (Schutz der Schwachen).“
* **[V]** Heading: „Beenden“
* **[V]** Text: „Beenden kannst du den Urlaubsmodus erst, wenn seine Mindestdauer vorbei ist; sie läuft ab dem Start in echter Zeit und beträgt in dieser Runde 48 Stunden. Der Admin legt sie für die Runde fest und kann sie während der Runde ändern. Eine neue Runde beendet den Urlaubsmodus von selbst.“
* **[V]** Formula: „Frühestes Ende = Start + Mindestdauer“
* **[V]** Keywords: Urlaub, Pause, pausieren, abwesend

### Sichtbarkeit und Aktivität (`rule-vision`)

* **[V]** Line: „Was du von fremden Flotten siehst und woran du erkennst, ob ein Spieler aktiv ist.“
* **[V]** Heading: „Fremde Flotten“
* **[V]** Text: „Wie viel du von einer fremden Flotte siehst, die zu deinen Planeten fliegt, hängt von deiner Auspex-Lehre ab. Ab Stufe 2 siehst du die Zahl der Schiffe, ab Stufe 4 auch die Schiffsarten, ab Stufe 8 die genaue Zahl je Art. Jede Grenze gilt für sich. Der Server schickt nur, was du siehst, und die Ladung bleibt immer verborgen. Die Grenzen gelten für jede fremde Flotte und legt der Admin für die Runde fest.“
* **[V]** Table: „Was du bei einer fremden Flotte siehst“
* **[V]** Table: „Deine Auspex-Lehre | Schiffe insgesamt | Schiffsarten | Genaue Zahl je Art“
* **[V]** Text: „Das Beispiel ist eine Flotte mit 15 Schiffen in 2 Arten. Eigene Flotten siehst du immer ganz.“
* **[V]** Heading: „Aktivität“
* **[V]** Text: „Auf der Sternenkarte und im Bericht einer Auspex-Erkundung siehst du, wann ein Planet zuletzt aktiv war. Aktivität setzt, wer sich anmeldet (dann nur auf seinem Hauptplaneten) oder im Spiel etwas tut (dann auf allen Planeten und Monden). Flotten, Erkundungen und fertige Gebäude setzen keine. In den ersten 15 Minuten nach der Aktivität steht nur, dass der Planet aktiv ist. Danach zeigt die Karte, wie viele Minuten es her ist, bis höchstens 59 Minuten; später steht nichts mehr.“
* **[V]** Table: „Was die Sternenkarte nach der Aktivität zeigt“
* **[V]** Table: „Minuten seit der Aktivität | Anzeige“
* **[V]** Heading: „Inaktive Spieler“
* **[V]** Text: „Auch ein Spieler zeigt, wenn er lange nichts getan hat: Wer 7 Tage nichts getan hat, gilt als inaktiv, wer 28 Tage nichts getan hat, als lange inaktiv. Die Werte legt der Admin für die Runde fest.“
* **[V]** Table: „Wann ein Spieler inaktiv heißt“
* **[V]** Table: „Tage ohne Aktivität | Anzeige“
* **[V]** Heading: „Deine Spielzeit“
* **[V]** Text: „Unter Optionen siehst du, wie viel du gespielt hast: eine Schätzung der aktiven Zeit, nur für dich, für heute, die letzten sieben Tage und die Runde. Aktiv zählt die Zeit, in der die Seite sichtbar im Vordergrund ist und du gerade etwas getan hast: geklickt, getippt oder gescrollt. Nach einer Minute ohne Eingabe und wenn du die Seite verlässt, pausiert die Zählung; kurze Lesepausen zählen mit. Die Tage werden nach UTC gezählt.“
* **[V]** Keywords: sichtbar, erkennen, Aktivität, inaktiv, Spielzeit

### Tagesbelohnung und Erfolge (`rule-rewards`)

* **[V]** Line: „Wie die Tagesbelohnung wächst und was die Erfolge auszahlen.“
* **[V]** Heading: „Tagesbelohnung“
* **[V]** Text: „Einmal je Tag kannst du dir eine Belohnung abholen. Sie besteht aus den Rohstoffen, die ein mittlerer Spieler in einer bestimmten Zahl von Minuten fördert: Für jeden Rohstoff zählt die Stundenproduktion, die in der Mitte aller Spieler liegt (der Median), umgerechnet auf die Minuten dieses Tages. Die Minuten steigen mit dem Tag der Runde, zuerst schnell, dann immer langsamer, und bleiben ab Tag 30 gleich. Der Tag wechselt um Mitternacht UTC. Die Belohnung kommt auf deinen Heimatplaneten und darf das Lager überfüllen.“
* **[V]** Formula: „Minuten = 30 + 60 · ln(Tag) ÷ ln(30), gerundet, ab Tag 30 unverändert“
* **[V]** Formula: „Belohnung = ⌊Stundenproduktion des mittleren Spielers · Minuten ÷ 60⌋, je Rohstoff“
* **[V]** Table: „Belohnung bei einer mittleren Produktion von 6.000 Adamant, 3.000 Psikristall und 1.500 Promethium je Stunde“
* **[V]** Table: „Tag der Runde | Minuten | Adamant | Psikristall | Promethium“
* **[V]** Heading: „Erfolge“
* **[V]** Text: „Ein Erfolg ist eine Zielmarke, die du erreichst, zum Beispiel eine Stufe eines Gebäudes oder eine Zahl von Schiffen. Hast du sie erreicht, holst du die Belohnung ab, und zwar je Erfolg nur einmal. Sie kommt auf den Heimatplaneten. Für eine Stufe zahlt ein Erfolg 5 % der Kosten der erreichten Stufe, für Schiffe und Verteidigungsanlagen 2,5 % der Kosten eines Stücks je Stück der Zielmarke, nie mehr als 30.000 je Rohstoff.“
* **[V]** Table: „Die Reihen der Erfolge und ihre Zielmarken“
* **[V]** Table: „Reihe | Zielmarken“
* **[V]** Text: „Die Erfolge für gestartete Flotten und Aufträge an die Schiffsschmiede zahlen feste Beträge, die mit der Zielmarke wachsen.“
* **[V]** Table: „Belohnung für gestartete Flotten und Aufträge an die Schiffsschmiede“
* **[V]** Table: „Zielmarke | Flotten: Adamant, Psikristall, Promethium | Aufträge: Adamant, Psikristall, Promethium“
* **[V]** Heading: „In dieser Runde“
* **[V]** Text: „Der Admin legt je Runde fest, ob es Erfolge und Tagesbelohnungen gibt.“
* **[V]** Facts: „Erfolge: ja“
* **[V]** Facts: „Tagesbelohnungen: ja“
* **[V]** Keywords: Belohnung, täglich, Achievement, Erfolg, abholen

### Highscore (`rule-highscore`)

* **[V]** Line: „Wie die Punkte zählen und was die Wertungen unterscheidet.“
* **[V]** Heading: „So zählen die Punkte“
* **[V]** Text: „Die Highscore kennt mehrere Wertungen, und jeder Spieler sieht jede: Gesamt, Gebäude, Forschung, Flotte und Verteidigung. Gebäude, Verteidigung und die Gesamtwertung zählen einen Punkt je 1.000 Rohstoffe, die in sie gesteckt sind, abgerundet. Die Forschung zählt einen Punkt je erforschter Stufe und die Flotte einen Punkt je Schiff, ganz gleich, was es gekostet hat, auch Sonnenreliquiare. Die Wertungen ergeben zusammen nicht die Gesamtwertung. Reißt du eine Stufe ab, sinken deine Punkte um die Kosten dieser Stufe.“
* **[V]** Formula: „Punkte = ⌊verbaute Rohstoffe ÷ 1.000⌋“
* **[V]** Table: „Wie jede Wertung zählt“
* **[V]** Table: „Wertung | Zählt“
* **[V]** Text: „Die Gesamtwertung entscheidet über den Noobschutz.“
* **[V]** Keywords: Punkte, Platz, Rangliste, Wertung, Statistik

### Marktplatz (`rule-market`)

* **[V]** Line: „Wie du Rohstoffe tauschst: Verhältnisse, Preise, Gebühr und Tageslimit dieser Runde.“
* **[V]** Heading: „So wird getauscht“
* **[V]** Text: „Auf dem Marktplatz tauschst du Adamant, Psikristall und Promethium gegeneinander; Energie lässt sich nicht tauschen. Du brauchst dafür einen Handelsposten auf dem Planeten, auf dem du tauschst. Wie viel du bekommst, bestimmen die Verhältnisse, die der Admin je Rohstoffpaar festlegt, der aktuelle Preis und die Gebühr. Reicht das Lager des Planeten für das Ergebnis nicht, wird der Tausch gekürzt: Du bekommst, was hineinpasst, und gibst nur die Menge dafür her.“
* **[V]** Facts: „Marktplatz in dieser Runde: ja“
* **[V]** Heading: „Verhältnisse und Preise“
* **[V]** Text: „Das Verhältnis nennt, wie viel du für 1.000 bekommst, wenn der Preis der Basispreis ist und keine Gebühr anfällt. Jeder Tausch senkt den Preis genau dieses Paares um einen Anteil der getauschten Menge; das umgekehrte Paar behält seinen Preis, damit sich eine Folge von Tauschen nicht lohnt. Danach erholt sich der Preis gleichmäßig bis zum Basispreis, in dieser Runde in 24 Stunden. Der Anteil beträgt 5 Promille je 1.000 getauschter Einheiten. Alle Spieler haben denselben Preis.“
* **[V]** Table: „Verhältnisse dieser Runde“
* **[V]** Table: „Du gibst | Du bekommst | Menge für 1.000 gegebene“
* **[V]** Formula: „Ergebnis = ⌊Menge · Verhältnis ÷ 1.000 · Preis ÷ 1.000.000 · (1.000 − Gebühr) ÷ 1.000⌋, mit dem Preis in Millionsteln des Basispreises und der Gebühr in Tausendsteln des Ergebnisses“
* **[V]** Formula: „Neuer Preis = ⌊Preis · 1.000.000 ÷ (1.000.000 + Preisschritt · getauschte Menge)⌋“
* **[V]** Heading: „Gebühr und Tageslimit“
* **[V]** Text: „Die Gebühr zieht der Handelsposten vom Ergebnis ab. Sie beträgt auf Stufe eins 10 % und sinkt mit jeder weiteren Stufe um 1 Prozentpunkt, aber nie unter null. Außerdem darf jeder Spieler an einem Tag, gezählt nach UTC, nur eine begrenzte Menge tauschen: in dieser Runde 100.000 Einheiten. Wer mehr tauschen will, als vom Tag übrig ist, tauscht nur den Rest; ist nichts mehr übrig, wird der Tausch abgelehnt. Der Admin legt Gebühr und Limit für die Runde fest.“
* **[V]** Table: „Gebühr nach Stufe des Handelspostens“
* **[V]** Table: „Stufe | Gebühr“
* **[V]** Keywords: tauschen, Handel, Kurs, Gebühr, Rohstoffe

### Gilden (`rule-guilds`)

* **[V]** Line: „Wie eine Gilde beitritt und arbeitet, welche Ränge und Rechte es gibt, was der Chat erlaubt und wie Freundschaften entstehen.“
* **[V]** Heading: „Beitreten und Mitglieder“
* **[V]** Text: „Du kannst in einer Gilde sein oder eine offene Bewerbung haben, aber nicht beides. Wer eine Gilde gründet, ist ihre Leitung; wer sich bewirbt, wird aufgenommen, wenn jemand mit dem Recht dazu zustimmt. Mitglieder einer Gilde dürfen beieinander Wache halten, soweit die Runde es erlaubt (Wache stellen). Wird ein Mitglied angegriffen oder trifft ein Mondbruch seinen Mond, erscheint beim Start des Angriffs ein Ereignis im Chat seiner Gilde. Wer die Leitung hat, kann nicht austreten, solange es andere Mitglieder gibt: Er gibt zuerst die Leitung weiter oder löst die Gilde auf.“
* **[V]** Facts: „Gilden in dieser Runde: ja“
* **[V]** Heading: „Ränge und Rechte“
* **[V]** Text: „Jedes Mitglied hat einen Rang, und jeder Rang hat eine Reihe von Rechten. Eine neue Gilde beginnt mit zwei Rängen, der Leitung und dem Rang Mitglied; was darüber hinausgeht, richtet die Leitung ein oder ein Rang, der das Recht dazu hat. Es gibt genau eine Leitung, und sie hat alle Rechte. Nur die Leitung löst die Gilde auf, gibt die Leitung weiter und wählt den Rang, den neue Mitglieder bekommen.“
* **[V]** Table: „Die Rechte eines Rangs“
* **[V]** Table: „Recht | Neue Mitglieder haben es“
* **[V]** Text: „Die Ränge sind geordnet: Ein Mitglied wirkt nur auf Mitglieder eines niedrigeren Rangs, und es vergibt nur Ränge und Rechte, die es selbst hat. Eine Gilde hat höchstens 25 Ränge, die Leitung eingerechnet. Ein Rangname braucht 2 bis 24 Zeichen und kommt in der Gilde nur einmal vor, ob groß oder klein geschrieben.“
* **[V]** Heading: „Der Chat“
* **[V]** Text: „Der Gildenchat zeigt die Nachrichten der Mitglieder und die Ereignisse der Gilde. Lesen, schreiben und löschen sind eigene Rechte. Eine Nachricht darf höchstens 1.000 Zeichen lang sein, und jedes Mitglied darf nur alle 2 Sekunden eine schreiben. Der Chat behält die letzten 500 Einträge, die Ereignisse eingerechnet. Eine neue Runde leert alle Chats.“
* **[V]** Heading: „Freunde“
* **[V]** Text: „Neben der Gilde gibt es Freunde. Eine Freundschaft entsteht erst, wenn die Anfrage angenommen ist; du kannst eine Anfrage stellen, eine erhaltene annehmen oder ablehnen, deine eigene zurückziehen und eine Freundschaft beenden. Hat dich jemand schon angefragt, kannst du ihn nicht noch einmal anfragen: Nimm seine Anfrage an. Freunde sehen einander online oder offline, und alle Freundschaften und Anfragen bleiben in einer neuen Runde erhalten. Wer bei wem Wache halten darf, legt der Admin je Runde fest: Gilde, Freunde oder beides.“
* **[V]** Facts: „Wache halten dürfen in dieser Runde: Gilde und Freunde“
* **[V]** Keywords: Gilde, Rang, Rechte, Leitung, Chat

### Endzeit (`rule-endzeit`)

* **[V]** Line: „Das Geschenk am Ende einer Runde: eine Flotte aus allem, was fliegt, und die Stufen, die dafür nötig sind.“
* **[V]** Heading: „Die Gabe“
* **[V]** Text: „Am Ende einer Runde kann der Admin die Endzeit einläuten, und zwar einmal je Runde. Dann bekommt jeder Spieler mit einem Heimatplaneten eine Flotte, die von jedem Schiff, das fliegen kann, 42 Stück enthält, und die von jedem Rohstoff 1.000.000 als Ladung trägt. Die Flotte startet vom Heimatplaneten und fliegt zu ihm; auf dem Weg lässt sie sich nicht zurückrufen, und sie belegt keinen Flottenslot. In diesem Universum ist die Flugzeit der Gabe zunächst auf 240 Minuten eingestellt; der Admin kann sie beim Einläuten ändern, aber nur auf 1 bis 4.320 Minuten.“
* **[V]** Text: „Die Ladung kommt auf dem Heimatplaneten an, auch über das Lager hinaus. Die Schiffe zählen für die Punkte der Highscore vom Start an wie jede Flotte, Gebäude und Forschung ab der Ankunft. Der Noobschutz bleibt wie er ist.“
* **[V]** Heading: „Was bei der Ankunft angehoben wird“
* **[V]** Text: „Bei der Ankunft werden die Forschung und die Gebäude des Heimatplaneten auf die Stufen angehoben, die alle Voraussetzungen im Spiel zusammen verlangen, dazu auf ein paar Mindeststufen. Höhere Stufen bleiben, und nichts wird weggenommen. Die Gebäude dürfen dabei mehr Felder brauchen, als der Planet hat, und es werden nur Gebäude angehoben, die auf einem Planeten stehen dürfen. Ein Bau oder eine Forschung, die damit überholt ist, wird abgebrochen und erstattet.“
* **[V]** Table: „Gebäude des Heimatplaneten“
* **[V]** Table: „Gebäude | Stufe“
* **[V]** Table: „Forschung“
* **[V]** Table: „Forschung | Stufe“
* **[V]** Keywords: Geschenk, Rundenende, Gabe, Gottkaiser

### Dieses Universum (`rule-universe`)

* **[V]** Line: „Die Einstellungen dieses Universums und dieser Runde, wie der Admin sie gewählt hat.“
* **[V]** Heading: „Tempo und Größe“
* **[V]** Text: „Dieses Universum läuft 5-mal so schnell wie das Original: Produktion, Bauzeiten, Forschungszeiten und Flüge laufen entsprechend schneller. Es hat 2 Galaxien mit je 50 Systemen, und jedes System hat 15 Positionen für Planeten und danach die Expeditionsposition (16). Jeder Spieler hat einen Heimatplaneten. Der Server rechnet rund um die Uhr, auch wenn du nicht eingeloggt bist. Es gibt kein Premium und keine Dunkle Materie, nur Rohstoffe und Geduld.“
* **[V]** Heading: „Alle Einstellungen“
* **[V]** Text: „Diese Tabelle nennt jede Einstellung des Admins mit dem Wert, der in dieser Runde gilt, und dem Wert, mit dem eine neue Runde beginnt. Einstellungen, die der Admin nur beim Start einer Runde setzt, stehen darunter.“
* **[V]** Table: „Einstellungen des Universums“
* **[V]** Table: „Einstellung | Wert in dieser Runde | Standard“
* **[V]** Table: „Einstellungen, die nur eine neue Runde setzt“
* **[V]** Table: „Einstellung | Wert in dieser Runde | Standard“
* **[V]** Keywords: Universum, Einstellungen, Runde, Tempo, Größe

## Häufige Fragen

### Wie bekomme ich mehr Informationen über den Gegner? (`faq-intel`)

* **[V]** Line: „Mit der Auspex-Lehre und Spähschädeln: Je mehr du schickst und je weiter du in der Auspex-Lehre vorn liegst, desto mehr zeigt der Bericht.“
* **[V]** Heading: „Kurz gesagt“
* **[V]** Text: „Erforsche die Auspex-Lehre und schicke Spähschädel in einer Auspex-Erkundung zum Ziel. Der Bericht nennt immer die Rohstoffe; Flotte, Verteidigung, Gebäude und Forschung kommen dazu, wenn dein Auspex-Wert hoch genug ist. Den Auspex-Wert heben mehr Spähschädel und ein Vorsprung in der Auspex-Lehre vor dem Ziel.“
* **[V]** Heading: „Schritte“
* **[V]** Facts: „Schritt 1: Erforsche die Auspex-Lehre bis mindestens Stufe 1. Sie braucht Scholarium Stufe 3.“
* **[V]** Facts: „Schritt 2: Baue Spähschädel in der Orbitalen Schiffsschmiede. Sie brauchen Orbitale Schiffsschmiede Stufe 3, Promethium-Brennkammer Stufe 3, Auspex-Lehre Stufe 2.“
* **[V]** Facts: „Schritt 3: Wähle auf der Sternenkarte den Planeten oder Mond des Gegners und starte die Auspex-Erkundung. Wie viele Spähschädel sie schickt, stellst du in den Optionen ein.“
* **[V]** Facts: „Schritt 4: Öffne den Bericht in deinen Nachrichten. Zeigt er nicht alles, schicke mehr Spähschädel oder forsche weiter in der Auspex-Lehre.“
* **[V]** Heading: „Was du dafür brauchst“
* **[V]** Text: „Die Tabelle nennt, wie viele Spähschädel du gegen ein Ziel mit gleicher Auspex-Lehre brauchst, damit der Bericht den Teil zeigt. Mit jeder Stufe Vorsprung brauchst du weniger, mit jeder Stufe Rückstand mehr; die Zahlen im Einzelnen stehen unter Auspex-Erkundung.“
* **[V]** Table: „Spähschädel bis zum Teil des Berichts, bei gleicher Auspex-Lehre“
* **[V]** Table: „Teil des Berichts | Ab Auspex-Wert | Spähschädel“
* **[V]** Stand: „Dein Stand: Stufe 0 der Auspex-Lehre und 0 Spähschädel. Gegen ein Ziel mit gleicher Auspex-Lehre zeigt dein Bericht: Rohstoffe.“
* **[V]** Keywords: Gegner, ausspähen, Informationen, Bericht, Spähschädel

### Warum kann ich diesen Spieler nicht angreifen? (`faq-attack`)

* **[V]** Line: „Meist schützt ihn sein geringer Punktestand oder der Urlaubsmodus; es kann auch an Slots oder am Ziel liegen.“
* **[V]** Heading: „Kurz gesagt“
* **[V]** Text: „Der Spieler ist geschützt, oder dein Auftrag passt nicht zum Ziel. Das Spiel nennt den Grund, wenn du den Auftrag startest. Diese Gründe gibt es:“
* **[V]** Facts: „Noobschutz: Er hat weniger als 20 % deiner Punkte. Dann kannst du ihn nicht angreifen und nicht erkunden; auf der Sternenkarte steht bei ihm (n). Mehr unter Schutz der Schwachen.“
* **[V]** Facts: „Urlaubsmodus: Er ist im Urlaubsmodus. Dann ist jeder seiner Planeten und Monde vor allen Aufträgen anderer Spieler geschützt.“
* **[V]** Facts: „Eigener Planet: Eigene Planeten kannst du nicht angreifen. Der Auftrag Verlegung bringt Schiffe zu einem eigenen Planeten.“
* **[V]** Facts: „Kein Ziel: An der Position steht kein Planet, oder du hast keine Schiffe gewählt. Eine freie Position lässt sich besiedeln oder vermessen, aber nicht angreifen.“
* **[V]** Facts: „Keine freie Flotte: Alle deine Flottenslots sind belegt; mit 1 Slot kannst du so viele Flotten gleichzeitig schicken. Mehr unter Flottenslots.“
* **[V]** Keywords: angreifen, geschützt, Noobschutz, Urlaub, verweigert

### Wie bekomme ich mehr Flottenslots? (`faq-slots`)

* **[V]** Line: „Mit der Kogitator-Doktrin: Jede Stufe bringt einen Slot dazu.“
* **[V]** Heading: „Kurz gesagt“
* **[V]** Text: „Erforsche die Kogitator-Doktrin. Ohne sie hast du einen Flottenslot, und jede Stufe bringt genau einen weiteren dazu. Die Slots zählen über alle deine Planeten zusammen: Eine Flotte belegt einen, bis sie wieder zu Hause ist. Raketen aus der Raketenkrypta brauchen keinen.“
* **[V]** Heading: „Schritte“
* **[V]** Facts: „Schritt 1: Baue das Gebäude, das die Kogitator-Doktrin braucht: Scholarium Stufe 1.“
* **[V]** Facts: „Schritt 2: Erforsche die Kogitator-Doktrin Stufe um Stufe; die Kosten steigen mit jeder Stufe, der Gewinn von einem Slot bleibt gleich.“
* **[V]** Facts: „Schritt 3: Prüfe in der Flottenansicht, wie viele Slots belegt sind.“
* **[V]** Heading: „Was dir das bringt“
* **[V]** Table: „Flottenslots nach Stufe der Kogitator-Doktrin“
* **[V]** Table: „Stufe | Flottenslots“
* **[V]** Stand: „Dein Stand: Stufe 0 der Kogitator-Doktrin, 1 Flottenslot.“
* **[V]** Text: „Expeditionen belegen einen gewöhnlichen Slot und zusätzlich einen Expeditionsplatz. Wie viele Plätze du hast, bestimmt die Kreuzzugs-Kartografie; in dieser Runde hat der Admin 0 zusätzliche Plätze gegeben. Mit deiner Stufe der Kreuzzugs-Kartografie hast du 0 Plätze.“
* **[V]** Keywords: Flottenslots, Slots, gleichzeitig, Flotten, Kogitator

### Was bleibt nach einer Schlacht übrig? (`faq-aftermath`)

* **[V]** Line: „Die Überlebenden, ein Trümmerfeld, ein Teil der Verteidigung und die Beute des Siegers.“
* **[V]** Heading: „Kurz gesagt“
* **[V]** Text: „Was den Kampf überlebt, bleibt: Der Angreifer fliegt mit den Überlebenden heim, der Verteidiger behält seine Überlebenden und einen Teil der zerstörten Verteidigung. Zerstörte Schiffe sind verloren, hinterlassen aber ein Trümmerfeld, und der Sieger kann Rohstoffe erbeuten. Beide Seiten bekommen einen Kampfbericht.“
* **[V]** Facts: „Überlebende: Der Kampf dauert höchstens 6 Runden; wer dann noch Einheiten hat, behält sie. Mehr unter Kampf.“
* **[V]** Facts: „Verteidigung: 70 % der zerstörten Verteidigung wird wieder aufgebaut. Schiffe werden nie ersetzt, und Raketen kämpfen nicht mit.“
* **[V]** Facts: „Trümmerfeld: 30 % des Adamants und Psikristalls aller zerstörten Schiffe liegen an der Position und lassen sich mit einer Bergung einsammeln (Trümmerfelder und Bergung).“
* **[V]** Facts: „Beute: Gewinnt der Angreifer, nimmt er bis zu 50 % jedes Rohstoffs des Planeten mit, soweit sein Laderaum reicht.“
* **[V]** Facts: „Mond: Aus dem Trümmerfeld kann ein Mond entstehen, mit höchstens 20 % Chance (Monde).“
* **[V]** Keywords: Schlacht, Verluste, Überlebende, Beute, übrig

### Wie gründe ich eine Kolonie? (`faq-colony`)

* **[V]** Line: „Mit einer Kolonistenarche, die du zu einer freien Position schickst.“
* **[V]** Heading: „Kurz gesagt“
* **[V]** Text: „Baue eine Kolonistenarche und schicke sie mit dem Auftrag Landnahme zu einer freien Position. Bleibt sie dort frei, entsteht die Kolonie, und die Arche bleibt in ihr.“
* **[V]** Heading: „Schritte“
* **[V]** Facts: „Schritt 1: Baue eine Kolonistenarche in der Orbitalen Schiffsschmiede. Sie braucht Orbitale Schiffsschmiede Stufe 4, Plasma-Impulsantrieb Stufe 3.“
* **[V]** Facts: „Schritt 2: Suche auf der Sternenkarte eine freie Position. Eine Vermessung mit Spähschädeln (Vermessung) zeigt vorher, wie groß und wie warm der Planet wird.“
* **[V]** Facts: „Schritt 3: Prüfe die Planetengrenze: In manchen Runden darf ein Spieler nur eine bestimmte Zahl von Planeten haben (Kolonien und Planetengrenze).“
* **[V]** Facts: „Schritt 4: Schicke die Kolonistenarche mit der Landnahme zu dieser Position; Rohstoffe, die du mitgibst, werden der erste Vorrat der Kolonie.“
* **[V]** Keywords: Kolonie, gründen, besiedeln, neuer, Planet

### Warum fördert meine Mine weniger als angegeben? (`faq-mine`)

* **[V]** Line: „Meist fehlt Energie; es kann auch am Lager, am Anteil oder an der Temperatur liegen.“
* **[V]** Heading: „Kurz gesagt“
* **[V]** Text: „Die Zahlen in den Listen nennen die Förderung bei voller Energie. Was wirklich ankommt, hängt von diesen Dingen ab:“
* **[V]** Facts: „Energie: Reicht die Energie des Planeten nicht für alle Förderstätten, fördern alle im selben Verhältnis weniger. Baue die Sonnenkathedrale aus, errichte ein Fusionssanktum oder stelle Sonnenreliquiare auf.“
* **[V]** Facts: „Lager: Ist das Lager eines Rohstoffs voll, hört seine Förderung auf. Baue das passende Lager aus (Adamant-Gewölbe, Psikristall-Reliquiar, Promethium-Zisterne) oder gib Rohstoffe aus.“
* **[V]** Facts: „Eingestellter Anteil: Läuft ein Gebäude nicht auf dem vollen Anteil, den du eingestellt hast, fördert es entsprechend weniger.“
* **[V]** Facts: „Temperatur: Die Promethium-Raffinerie fördert auf kalten Planeten mehr und auf warmen weniger.“
* **[V]** Facts: „Leerer Vorrat: Verbraucht ein Gebäude einen Rohstoff, dessen Vorrat leer ist, läuft es gedrosselt, genau so, dass der Vorrat bei null bleibt.“
* **[V]** Facts: „Urlaubsmodus: Im Urlaubsmodus ruht die Förderung.“
* **[V]** Keywords: Mine, Förderung, weniger, Energiemangel, Lager

### Wie komme ich an mehr Rohstoffe? (`faq-resources`)

* **[V]** Line: „Förderung ausbauen, Energie sichern, tauschen, bergen oder erbeuten.“
* **[V]** Heading: „Kurz gesagt“
* **[V]** Text: „Es gibt mehrere Wege: mehr fördern, tauschen, Trümmer bergen, erbeuten und Belohnungen abholen.“
* **[V]** Facts: „Mehr fördern: Baue die Förderstätten aus (Adamant-Tiefbohrung, Psikristall-Steinbruch, Promethium-Raffinerie) und sorge für genug Energie und Lagerplatz. Mehr unter Produktion, Energie und Lager.“
* **[V]** Facts: „Tauschen: In dieser Runde gibt es den Marktplatz: Mit einem Handelsposten tauschst du die drei Rohstoffe gegeneinander (Marktplatz).“
* **[V]** Facts: „Bergen: Nach Kämpfen liegen 30 % der zerstörten Schiffe als Trümmerfeld an der Position; eine Bergung sammelt es ein (Trümmerfelder und Bergung).“
* **[V]** Facts: „Erbeuten: Wer einen Planeten besiegt, nimmt bis zu 50 % jedes Rohstoffs mit, soweit der Laderaum reicht (Kampf). Geschützte Spieler kannst du nicht angreifen (Schutz der Schwachen).“
* **[V]** Facts: „Belohnungen: Die Tagesbelohnung und die Erfolge zahlen Rohstoffe aus (Tagesbelohnung und Erfolge). Tagesbelohnung in dieser Runde: ja, Erfolge: ja.“
* **[V]** Text: „Dazu kommt, was jeder Planet ohne Gebäude von selbst fördert.“
* **[V]** Keywords: Rohstoffe, Adamant, Psikristall, Promethium, mehr

### Wie schütze ich mich vor Angriffen? (`faq-defend`)

* **[V]** Line: „Mit Verteidigung, Forschung, Wache haltenden Freunden und rechtzeitigem Wissen, wer kommt.“
* **[V]** Heading: „Kurz gesagt“
* **[V]** Text: „Ganz verhindern lässt sich ein Angriff nicht, aber du kannst ihn teuer machen. Verteidigung, Forschung und Freunde, die bei dir Wache halten, kämpfen mit dir. Wer zu schwach ist, steht außerdem unter Schutz.“
* **[V]** Facts: „Verteidigung: Baue Verteidigungsanlagen, etwa die Raketenbatterie oder den Kleinen Schutzdom. Nach einem Kampf werden 70 % der zerstörten Verteidigung wieder aufgebaut (Kampf).“
* **[V]** Facts: „Forschung: Waffensegnung, Refraktionsfelder und Adamant-Panzerung heben Angriff, Schild und Struktur aller deiner Einheiten um 10 % je Stufe.“
* **[V]** Facts: „Wache: Gildenmitglieder und Freunde können mit ihrer Flotte an deinem Planeten Wache halten und kämpfen dann mit dir, wenn jemand dich angreift (Wache stellen).“
* **[V]** Facts: „Wissen: Ab Stufe 2 der Auspex-Lehre siehst du, wie viele Schiffe auf dich zufliegen, ab Stufe 4 welche Arten und ab Stufe 8 die genaue Zahl (Sichtbarkeit und Aktivität). Eine hohe Auspex-Lehre macht es außerdem wahrscheinlicher, dass du eine Auspex-Erkundung bemerkst (Auspex-Erkundung).“
* **[V]** Facts: „Raketen: Abfangraketen halten anfliegende Orbitalraketen auf, eine je Rakete (Abfangrakete).“
* **[V]** Facts: „Schutz: Wer weniger als 20 % der Punkte eines anderen hat, ist vor ihm geschützt; im Urlaubsmodus bist du vor allen geschützt (Schutz der Schwachen).“
* **[V]** Keywords: verteidigen, schützen, Schutz, Abwehr, Angriffe

## Einstieg

### Erste Schritte (`guide-start`)

* **[V]** Line: „Die ersten Tage in Schritten: Förderung, Energie, Forschung, Lager und die erste Flotte.“
* **[V]** Heading: „Womit du beginnst“
* **[V]** Text: „Du beginnst mit einem Heimatplaneten, der 163 Felder hat, und mit 500 Adamant und 500 Psikristall. In diesem Universum läuft alles 5-mal so schnell wie im Original. Der Heimatplanet fördert von Anfang an eine Grundmenge, auch ohne Gebäude (Produktion, Energie und Lager).“
* **[V]** Heading: „Die ersten Tage in Schritten“
* **[V]** Facts: „Schritt 1: Baue die Adamant-Tiefbohrung und den Psikristall-Steinbruch. Die erste Stufe kostet 60 Adamant und 15 Psikristall beziehungsweise 48 Adamant und 24 Psikristall. Ohne Förderstätten kommt nur die Grundmenge herein.“
* **[V]** Facts: „Schritt 2: Baue die Sonnenkathedrale (erste Stufe: 75 Adamant und 30 Psikristall). Die Förderstätten brauchen Energie, und fehlt sie, fördern sie weniger (Produktion, Energie und Lager).“
* **[V]** Facts: „Schritt 3: Baue das Scholarium (erste Stufe: 200 Adamant, 400 Psikristall und 200 Promethium), denn ohne es lässt sich nichts erforschen. Die Auspex-Lehre etwa braucht Scholarium Stufe 3.“
* **[V]** Facts: „Schritt 4: Baue die Servitorenschmiede: Sie verkürzt jede Bauzeit. Es läuft immer nur ein Bauauftrag je Planet, und eine Forschung zugleich (Bauen, Forschen und Schiffsschmiede).“
* **[V]** Facts: „Schritt 5: Sobald ein Lager voll ist, hört seine Förderung auf. Baue dann das Lager aus: Adamant-Gewölbe, Psikristall-Reliquiar oder Promethium-Zisterne.“
* **[V]** Facts: „Schritt 6: Baue die Orbitale Schiffsschmiede, sie braucht Servitorenschmiede Stufe 2, und danach dein erstes Schiff, etwa einen Frachtläufer (2.000 Adamant und 2.000 Psikristall).“
* **[V]** Facts: „Schritt 7: Schicke deine erste Flotte (Deine erste Flotte) und gründe deine erste Kolonie (Deine erste Kolonie). Was dich im Spiel schützt, steht unter Dich verteidigen.“
* **[V]** Facts: „Schritt 8: Sieh unter Deine nächsten Ziele nach, was dein Stand als Nächstes nahelegt.“
* **[V]** Keywords: Anfang, Einstieg, beginnen, Neuling, Tutorial

### Deine erste Kolonie (`guide-colony`)

* **[V]** Line: „Von der Kolonistenarche bis zu den ersten Gebäuden der neuen Kolonie.“
* **[V]** Heading: „Wozu eine Kolonie“
* **[V]** Text: „Eine Kolonie ist ein weiterer Planet. Sie hat eigene Felder für Gebäude, fördert eigene Rohstoffe und hat ein eigenes Lager. Deine Forschung und deine Flottenslots gelten für alle Planeten zusammen. Wie viele Planeten du haben darfst, kann der Admin für die Runde begrenzen (Kolonien und Planetengrenze).“
* **[V]** Heading: „Von der Arche zur Kolonie“
* **[V]** Facts: „Schritt 1: Prüfe die Planetengrenze dieser Runde und gib, wenn sie erreicht ist, eine Kolonie auf oder erforsche, was sie hebt (Kolonien und Planetengrenze).“
* **[V]** Facts: „Schritt 2: Baue eine Kolonistenarche in der Orbitalen Schiffsschmiede. Sie braucht Orbitale Schiffsschmiede Stufe 4, Plasma-Impulsantrieb Stufe 3.“
* **[V]** Facts: „Schritt 3: Suche auf der Sternenkarte eine freie Position. Wie viele Felder die Kolonie bekommt und wie warm sie wird, hängt von der Position ab (Planeten und Felder); eine Vermessung mit Spähschädeln zeigt es vorher.“
* **[V]** Facts: „Schritt 4: Schicke die Arche mit der Landnahme zu dieser Position. Wie lange der Flug dauert und was er an Promethium kostet, nennt das Flottenformular (Flug und Treibstoff).“
* **[V]** Facts: „Schritt 5: Gib der Kolonie Förderstätten und Energie wie dem Heimatplaneten, und baue ihre Lager aus, wenn sie voll werden (Erste Schritte).“
* **[V]** Keywords: Kolonie, Planet, besiedeln, erweitern, Arche

### Deine erste Flotte (`guide-fleet`)

* **[V]** Line: „Vom ersten Schiff bis zum Bericht, und welcher Auftrag zu welchem Ziel passt.“
* **[V]** Heading: „Von Schiff zu Bericht“
* **[V]** Facts: „Schritt 1: Baue Schiffe in der Orbitalen Schiffsschmiede. Welche, hängt vom Auftrag ab: Die Tabelle unten nennt zu jedem Auftrag sein Ziel.“
* **[V]** Facts: „Schritt 2: Prüfe die Flottenslots: Jede Flotte belegt einen, bis sie wieder da ist (Wie bekomme ich mehr Flottenslots?).“
* **[V]** Facts: „Schritt 3: Wähle im Flottenformular die Schiffe, das Ziel und den Auftrag. Die Ladung ist durch den Laderaum der Schiffe begrenzt, und das Promethium für den Flug zahlst du beim Start (Flug und Treibstoff).“
* **[V]** Facts: „Schritt 4: Wähle das Tempo. Langsamer zu fliegen spart Promethium und kostet Zeit; die Flotte ist so schnell wie ihr langsamstes Schiff (Flug und Treibstoff).“
* **[V]** Facts: „Schritt 5: Warte auf den Bericht in den Nachrichten. Bei einem Angriff erfährst du, was der Kampf gebracht hat (Was bleibt nach einer Schlacht übrig?).“
* **[V]** Heading: „Welcher Auftrag für welches Ziel“
* **[V]** Table: „Die Aufträge der Flotte und ihre Ziele“
* **[V]** Table: „Auftrag | Ziel | Ladung | Rückflug“
* **[V]** Text: „Eine Erkundung zeigt vorher, was am Ziel steht (Wie bekomme ich mehr Informationen über den Gegner?). Warum ein Auftrag nicht geht, steht unter Warum kann ich diesen Spieler nicht angreifen?.“
* **[V]** Keywords: Flotte, Schiffe, starten, schicken, Auftrag

### Dich verteidigen (`guide-defense`)

* **[V]** Line: „Was dich schützt und wie du dich auf einen Angriff vorbereitest.“
* **[V]** Heading: „In dieser Reihenfolge“
* **[V]** Facts: „Schritt 1: Erkenne, wer kommt: Ab Stufe 2 der Auspex-Lehre siehst du, wie viele Schiffe auf dich zufliegen, ab Stufe 4 welche Arten und ab Stufe 8 die genaue Zahl (Sichtbarkeit und Aktivität).“
* **[V]** Facts: „Schritt 2: Baue Verteidigungsanlagen in der Orbitalen Schiffsschmiede; die Tabelle unten nennt Kosten und Werte. Nach einem Kampf wird ein Teil der zerstörten Verteidigung wieder aufgebaut (Kampf).“
* **[V]** Facts: „Schritt 3: Erforsche die Waffensegnung, die Refraktionsfelder und die Adamant-Panzerung: Jede Stufe hebt Angriff, Schild oder Struktur aller deiner Einheiten um 10 % des Grundwerts.“
* **[V]** Facts: „Schritt 4: Bitte Gildenmitglieder und Freunde, bei dir Wache zu stellen: Ihre Flotten kämpfen dann mit dir (Gilden).“
* **[V]** Facts: „Schritt 5: Halte Abfangraketen in der Raketenkrypta bereit: Jede Abfangrakete hält eine anfliegende Orbitalrakete auf.“
* **[V]** Facts: „Schritt 6: Denke an den Schutz: Wer viel weniger Punkte hat als der Angreifer, steht unter Noobschutz, und im Urlaubsmodus ist alles geschützt (Schutz der Schwachen).“
* **[V]** Heading: „Die Verteidigungsanlagen“
* **[V]** Table: „Kosten und Werte der Verteidigungsanlagen“
* **[V]** Table: „Anlage | Kosten | Angriff | Schild | Struktur“
* **[V]** Keywords: verteidigen, Abwehr, Angriff, Verteidigung, sichern

### Deine nächsten Ziele (`guide-next`)

* **[V]** Line: „Was deine Planeten, deine Forschung und deine Flotten nach den Regeln als Nächstes nahelegen.“
* **[V]** Heading: „Was die Regeln gerade nahelegen“
* **[V]** Text: „Diese Seite rechnet aus deinem Stand, was die Regeln hervorheben: Energie, die fehlt, ein volles Lager, kein freies Feld, belegte Flottenslots, die Planetengrenze oder eine Voraussetzung, die nur noch eine Stufe entfernt ist. Es sind keine Ratschläge zum Spielstil, nur Folgen der Regeln.“
* **[V]** Text: „Dir fehlt Energie: Die Förderstätten dieses Planeten laufen nur mit 8,48 % ihrer Leistung. Die Sonnenkathedrale, das Fusionssanktum und die Sonnenreliquiare liefern Energie (Produktion, Energie und Lager).“
* **[V]** Text: „Das Lager für Adamant ist voll, und die Förderung steht dort still. Baue Adamant-Gewölbe aus oder gib Rohstoffe aus (Produktion, Energie und Lager).“
* **[V]** Text: „Auf diesem Planeten sind alle Felder belegt (Felder: 1), und keine weitere Gebäudestufe lässt sich bauen. Die Weltenschmiede schafft Felder, oder gründe eine Kolonie (Wie gründe ich eine Kolonie?).“
* **[V]** Text: „Alle Flottenslots sind belegt (Flottenslots: 1). Die Kogitator-Doktrin bringt mit jeder Stufe einen weiteren (Wie bekomme ich mehr Flottenslots?).“
* **[V]** Text: „Du hast die Planetengrenze dieser Runde erreicht (Planeten: 3 von 3). Eine neue Kolonie braucht einen freien Platz: Gib eine Kolonie auf (Kolonien und Planetengrenze).“
* **[V]** Text: „Die Forschung Kolonialverwaltung hebt die Planetengrenze an (deine Stufe: 0, Planetengrenze: 3).“
* **[V]** Heading: „Dein Stand“
* **[V]** Stand: „Dein Stand: Planeten: 3 · Flotten unterwegs: 1 · Punkte: 0“
* **[V]** Text: „Dir fehlt noch eine Stufe, um Machina-Energetik zu bekommen: Scholarium steht auf Stufe 0 und müsste Stufe 1 haben.“
* **[V]** Text: „Dir fehlt noch eine Stufe, um Kogitator-Doktrin zu bekommen: Scholarium steht auf Stufe 0 und müsste Stufe 1 haben.“
* **[V]** Text: „Ohne Förderstätten kommt auf diesem Planeten nur die Grundmenge herein, 100 Adamant und 50 Psikristall je Stunde. Die Adamant-Tiefbohrung und der Psikristall-Steinbruch fördern mehr (Produktion, Energie und Lager).“
* **[V]** Stand: „Dein Stand: Planeten: 1 · Flotten unterwegs: 0 · Punkte: 0“
* **[V]** Text: „Auf diesem Mond sind alle Felder belegt (Felder: 1). Die Mondzitadelle schafft weitere Felder (Monde).“
* **[V]** Text: „Dir fehlt noch eine Stufe, um Orbitale Schiffsschmiede zu bekommen: Servitorenschmiede steht auf Stufe 1 und müsste Stufe 2 haben.“
* **[V]** Text: „Dir fehlt noch eine Stufe, um Auspex-Phalanx zu bekommen: Mondzitadelle steht auf Stufe 0 und müsste Stufe 1 haben.“
* **[V]** Keywords: Ziele, nächste, Ratschlag, Hinweis, Empfehlung

