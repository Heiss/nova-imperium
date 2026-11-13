---
type: feature
title: Planet fields and the Weltenschmiede
description: Every planet gets a diameter and a limited number of fields, each building level takes one, and the Weltenschmiede (classic Terraformer) adds fields (issue #51).
---

# Planet fields and the Weltenschmiede

Issue #51, milestone `next release` (owner, 2026-11-13). Values from the
owner's list of 2026-11-09 and the wiki (Fields, Diameter, Colonization,
Homeplanet, Terraformer); the owner confirmed them on 2026-11-13.

* **[E]** Fields = ⌊(diameter / 1000)²⌋. The home planet always has 163
  fields (owner, 2026-11-13).
* **[E]** A colony gets fields chosen at random in the range of its
  position, by the wiki table (owner, 2026-11-13); positions 16 to 20 use
  the range of position 15:

  | Pos. | min | max | | Pos. | min | max |
  |---|---|---|---|---|---|---|
  | 1 | 96 | 172 | | 9 | 150 | 246 |
  | 2 | 104 | 176 | | 10 | 142 | 232 |
  | 3 | 112 | 182 | | 11 | 136 | 210 |
  | 4 | 118 | 208 | | 12 | 125 | 186 |
  | 5 | 133 | 232 | | 13 | 114 | 172 |
  | 6 | 146 | 242 | | 14 | 100 | 168 |
  | 7 | 152 | 248 | | 15 to 20 | 90 | 164 |
  | 8 | 156 | 252 | | | | |

* **[E]** Every building level takes one field; defense, ships and research
  do not. A planet without a free field cannot start another building
  level (owner, 2026-11-13).
* **[E]** Weltenschmiede (classic Terraformer, grimdark name of #127):
  level 1 costs 0 Adamant, 50,000 Psikristall, 100,000 Promethium and 1,000
  energy, factor 2; requirements Machina-Schwarmhalle 1 and
  Machina-Energetik 12; the energy must be produced but is not used up,
  like the Gravitonen-Mysterium; every level adds 5 fields (classic, owner's
  list); it takes a field itself (owner, 2026-11-13).
* **[E]** Planets that exist at the migration have no field limit until the
  next new round; the planets of a new round follow the rule (owner,
  2026-11-13).
* **[E]** Universe setting „Zusatzfelder pro Planet“, 0 to 100, default 0,
  added to the fields of every planet (owner, 2026-11-13).
* **[E]** Texts (owner, 2026-11-13, proposal A): overview „Durchmesser:
  12.800 km (54/163 Felder)“; buildings „Felder: 54 / 163“; a full planet
  „Keine freien Felder.“
* **[V]** A planet without a limit shows „Felder: 54 / unbegrenzt“; its
  diameter is drawn from the range of its position. The short and long text
  and the art of the Weltenschmiede are proposed in the pull request.

# Code, interface and tests

* Rules in `src/shared/fields.ts`, used by the server and the browser:
  `fieldsOf(diameter)` = ⌊diameter² / 1,000,000⌋, `fieldRange(position)`
  (the table, clamped to 1 to 15), `colonyDiameter(position, rng)`,
  `usedFields(p)` (the sum of the building levels), `maxFields(p, u)` (null
  without a limit) and `fieldsFull(p, u)`.
* **[V]** A colony first draws its fields evenly in the range of its
  position, then its diameter evenly among the diameters with exactly that
  many fields, with the seeded `ctx.rng` of the game. The home planet gets
  12,800 km (163 fields).
* Storage: `Planet.diameter` (km) and `Planet.unlimited`, columns of
  `planets`, migration 14 (see [SQLite storage](/data/sqlite.md)). A new
  round places new planets, which follow the rule. Colonies founded and
  players who register after the upgrade get a limit at once, because only
  the planets that exist at the migration keep none.
* **[V]** Existing planets after the upgrade: the home planet (the oldest
  planet of its owner) gets 12,800 km, a colony a diameter drawn by SQLite's
  `random()` from the range of its position; both show „unbegrenzt“.
* Catalog: `terraformer` in `BUILD` after the Machina-Schwarmhalle, with two
  new optional fields of `BuildingDef`: `energy` (as for research: `base`,
  `f`; checked, not used up, the Gravitonen-Mysterium pattern of #49) and
  `fields` (fields per level, 5). `maxFields` adds `fields · level` of every
  building, so the rule names no key.
* Action `build` (`src/server/game/actions.ts`): after the queue, the
  requirements and the locks it refuses a full planet with „Keine freien
  Felder.“, then a short energy production with „Zu wenig Energie:
  Weltenschmiede braucht eine Energieproduktion von 1.000, es fehlen …“
  (the check of the Gravitonforschung, now one function for both).
* Universe setting `extraFields` („Zusatzfelder pro Planet“, 0 to 100,
  default 0) in `src/shared/universe.ts`; the admin panel shows it with the
  others, and it counts at once for every planet with a limit.
* Interface: overview row „Durchmesser“ with `diameterLine()`, buildings
  line „Felder: 54 / 163“ above the list with `fieldsLine()`
  (`src/client/logic/fields.ts`); a full planet shows „Keine freien
  Felder.“ instead of the button of every building whose requirements are
  met; the Weltenschmiede shows its energy production as a cost with the
  energy icon and „Zu wenig Energie: es fehlen …“ instead of the button. In
  the requirements list a building need on a full planet says „Keine
  freien Felder“ (no period, like the other reasons there).
* **[V]** Texts of a planet without a limit: buildings „Felder: 54 /
  unbegrenzt“, overview „Durchmesser: 14.254 km (54 Felder, unbegrenzt)“.
* **[V]** Weltenschmiede: abbreviation `WE` (unique, `WS` is the
  Waffensegnung); short text „+5 Felder pro Stufe. Braucht eine
  Energieproduktion, verbraucht sie aber nicht.“; long text „Die
  Weltenschmiede bricht Gebirge, füllt Schluchten und hämmert aus totem Fels
  neuen Baugrund. / So funktioniert es: Jede Stufe schafft auf diesem
  Planeten mehrere neue Felder für Gebäude und belegt selbst eines. Der
  Planet muss genug Energie erzeugen; verbraucht wird sie nicht, und jede
  Stufe verlangt mehr.“; art: the Terraformer of the interface v2 icon set
  (`docs/design/interface-v2/icons/buildings/terraformer.svg`, half a green
  world, half bare rock), renamed in `<title>` and `aria-label`.
* Tests: `src/shared/fields.test.ts`, `requirements.test.ts`,
  `catalog.test.ts`, `universe.test.ts`, `src/client/logic/fields.test.ts`,
  `game.test.ts`, `src/server/game/actions.test.ts`, `admin.test.ts`,
  `fleet.test.ts` (a colony in its range), `src/server/db/store.test.ts`,
  `upgrades/migration-14.test.ts`; E2E „a home planet has 163 fields; a
  full planet refuses a new level“, „the Weltenschmiede needs energy
  production and adds five fields“, „a full planet and the field count on a
  phone“ (phone), „the admin gives every planet extra fields“, the colony
  check in „builds solar and switches to a newly founded colony“, and axe
  in `e2e/a11y.spec.ts` (full, short of energy, without a limit).

# Out of scope

* Tearing down buildings; moon fields (#53).
