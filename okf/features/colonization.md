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
