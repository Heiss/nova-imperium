---
type: feature
title: Demolition of buildings
description: Tearing down one building level at a time for a refund factor from −100 % to +100 % and a share of the build time, both set by the admin per round (issue #202).
---

# Demolition of buildings

Issue #202, part of the Classic features (#222). The owner's answers of
2026-11-16 to D1 to D7. Moons are out of scope of the issue, and the
Mondzitadelle cannot be torn down ([Moons](/features/moons.md)).

# Decisions

* **[E]** A refund factor from −100 % to +100 % replaces the earlier rule
  „refund = cost × (1 − malus), malus 0 to 100 %, 0 = full refund“ (owner,
  2026-11-16, D7): at +100 % the player gets the full cost of the level
  back, at 0 % the demolition is free and gives nothing back, at −100 % it
  costs the level's cost once more. Default +50 %.
* **[E]** One factor per round, set in the admin panel (owner, 2026-11-16,
  D4; see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
* **[E]** One level per order (owner, 2026-11-16, D1).
* **[E]** The basis is the cost of the demolished level (owner,
  2026-11-16, D2).
* **[E]** Duration: a share of the level's build time, set in the admin
  panel, default 50 % (owner, 2026-11-16, D3).
* **[E]** Not while the building is in use: not while the shipyard builds,
  the lab researches, or the fields would overflow (the Weltenschmiede,
  see [Planet fields](/features/fields.md)) (owner, 2026-11-16, D5).
* **[E]** The highscore points drop by the cost of the demolished level,
  converted like every cost at 1 point per 1,000 resources (owner,
  2026-11-16, D6; see
  [Highscore categories](/features/highscore-categories.md)).

# Open for the build

* **[E]** With a negative factor the demolition costs resources; without
  enough of them the order is refused, as for building (owner,
  2026-11-16).
* **[U]** The range of the time share is not decided.
* **[V]** A demolished level frees its field.
