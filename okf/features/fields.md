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

# Out of scope

* Tearing down buildings; moon fields (#53).
