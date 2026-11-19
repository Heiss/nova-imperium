---
type: feature
title: Colony ships
---

# Colony ships

* A colony ship costs 10,000 metal, 20,000 crystal and 10,000 deuterium.
  It requires shipyard level 4 and impulse drive level 3.
* A colony ship can found a colony at a free position in the galaxy. The first
  fleet to arrive claims the position. If the position is occupied at arrival,
  the fleet returns with its ships and cargo.
* Founding consumes one colony ship and unloads the fleet's cargo into the
  colony. Extra ships return. The colony has no starting buildings or bonus
  resources.
* Players can switch planets in the header or in the galaxy. Buildings,
  production, the shipyard and fleet departures belong to the active planet.
  Research starts on the active planet when it has a Forschungslabor and is
  paid there; still one research at a time per player. Rewards use the home
  planet (owner, 2026-11-12, see
  [Research](/features/research-ion-plasma-graviton.md)).
* Database migration 9 preserves existing fleets and adds the colonization
  mission. Building and research timers round up to full milliseconds so that
  SQLite can store their deadlines in integer columns.

# Planet limit per player (#237)

Issue #237. The owner's „Geklärt“ of 2026-11-17 (D1 to D6) and the rules of the
issue text of 2026-11-16 are [E]; what the owner leaves to the builder is [V].
The pure rules are in `src/core/colony-limit.ts`, the check of a Landnahme in
`src/features/missions/colonize/`, the server side in
`src/server/game/colony-limit.ts`.

* **[E]** The admin sets for each round how many ordinary planets a player may
  own, the home planet included (`0` = unlimited). Moons do not count. With
  the research „Kolonialverwaltung“ switched on, each level adds a number of
  planets (owner, 2026-11-16: 6 / 8 / 10 / 12 / 14 at base 6, +2 per level,
  highest level 4). A highest level of `0` is no configured ceiling of
  levels. The base limit must be above 0 when the research is on: the server
  refuses the round otherwise, in „Neue Runde“ and in the live settings, with
  „Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.“ (the issue's
  wording).
* **[E]** D1: the values are set in „Neue Runde“ and editable during the round
  (X1, `live`). Lowering the limit removes no planet; while a player is over
  it, new colonies are refused.
* **[E]** D2: the research is a separate one, „Kolonialverwaltung“ (key
  `colonial`, `src/features/colonial/`). **[V]** Cost and requirements are
  the builder's proposal for the owner to confirm: the same as the
  Kreuzzugs-Kartografie (4,000 Adamant, 8,000 Psikristall, 4,000 Promethium,
  factor 2 as for every research; Forschungslabor 3, Spionagetechnik 4,
  Impulstriebwerk 3). **[V]** Name abbreviation „KV“, the texts of its entry
  and of its article, and its picture (the one of the
  Kreuzzugs-Kartografie with its own name until one is drawn).
* **[E]** D3: an outgoing Landnahme reserves a slot at the launch (planets
  owned plus Landnahmen on their way out must stay below the limit) and is
  checked again at the arrival, with the research the player has then
  (research finished during the flight counts). A recalled fleet and one on
  its way home release the slot. At the arrival the check runs in the same
  transaction as the founding (the server's clock runs each arrival in one),
  so arrivals cannot exceed the limit; if it fails, the whole fleet returns
  with its ark and cargo, and nothing is founded.
* **[E]** D4: only the research raises the limit; no other bonus stacks.
* **[E]** D5: the research can be started before the base limit is reached.
* **[E]** D6: defaults and bounds. **[E]** „At most 20 colonies in total“.
  **[V]** Read as: no limit can exceed 20 planets (`MOST_PLANETS`), also with
  a highest level of 0 (the research brings nothing past that number); the
  base is 0 to 20, the planets per level 1 to 20 (a research that unlocks
  nothing is refused), the highest level 0 to 20. **[V]** The default of a
  round without the settings keeps today's game: no limit, research off,
  2 planets per level and a highest level of 4 (the issue's example) for the
  moment the admin switches it on. The values 6 and +2 of D6 are then what
  the admin types in „Neue Runde“ (the dialog is prefilled from the previous
  round); to start new rounds at 6 instead, the default of `roundColonyBase`
  is the one place to change.
* **[V]** The research cannot be started when the round does not have it
  (`off`) or when its highest level is reached (`maxLevel`), as codes of
  `researchErrors`: „Diese Forschung gibt es in dieser Runde nicht.“ and
  „Die höchste Stufe dieser Forschung ist erreicht.“
* **[V]** Words: a refused launch says „Planetengrenze erreicht (6/6).
  Erforsche Kolonialverwaltung oder gib eine Kolonie auf.“ (the issue's
  wording; the count is planets plus Landnahmen on their way; without the
  research in the round the second sentence is „Gib eine Kolonie auf.“); a
  failed arrival reports „Landnahme [g:s:p] gescheitert“ with „Planetengrenze
  erreicht (6/6). Deine Flotte kehrt mit der Kolonistenarche zurück.“; the
  planet overview has a row „Planetengrenze“ and the fleet form names beside
  a Landnahme „Planeten: 6 / 8 · Kolonialverwaltung Stufe 1“ or „Planeten: 6 ·
  unbegrenzt“ (the issue's wording), with the refusal when the limit leaves
  no room.
* **[V]** The labels in the dialog: „Maximale Planeten ohne Forschung (0 =
  unbegrenzt, der Heimatplanet zählt mit)“, „Kolonieforschung aktivieren“
  (Nein / Ja), „Zusätzliche Planeten je Forschungsstufe“, „Maximale
  Forschungsstufe (0 = unbegrenzt erforschbar)“, one fieldset
  „Planetengrenze“, orders 440 to 470 (`roundColonyBase`,
  `roundColonyResearch`, `roundColonyPerLevel`, `roundColonyMaxLevel`).
* **[V]** The registry of the round settings got one optional rule between
  settings, `agrees` (`src/core/round.ts`, checked for „Neue Runde“ and for
  the live settings): asked only when every value is in its range, worded by
  the entry's `refusal`. The research switch uses it.
* **[U]** Not built yet, because they live in the research view that another
  branch is changing: hiding „Kolonialverwaltung“ in the research list while
  the round does not have it (the server refuses it meanwhile), the research
  line „Kolonialverwaltung Stufe 3/4 · +2 Planeten je Stufe · nächste Stufe:
  maximal 14 Planeten“, and the preview line and the hidden extra fields of
  the dialog „Neue Runde“.
