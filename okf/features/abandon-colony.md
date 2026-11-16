---
type: feature
title: Abandon a colony
description: A player gives up a colony that nothing refers to any more, loses everything on it with its moon, and the position is locked for a time the admin sets per round (issue #224).
---

# Abandon a colony

Issue #224, part of the Classic features (#222). The owner's answers of
2026-11-16 to D1 to D3 and Q1. Classic source: owiki.de „Zerstörter
Planet“ (https://owiki.de/index.php?title=Zerst%C3%B6rter_Planet&oldid=76922).

# Decisions

* **[E]** Running references (owner, 2026-11-16, D1): giving up is refused
  while flights, research or orders refer to the planet or its moon.
* **[E]** Position (owner, 2026-11-16, D2): the admin sets per round how
  long the position stays locked before it can be colonized again (see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
* **[E]** Default 24 h, the classic minimum: a destroyed planet stayed at
  least 24 hours and was removed in the nightly run, so 24 to 48 hours
  (owiki „Zerstörter Planet“) (owner, 2026-11-16).
* **[E]** Main planet (owner, 2026-11-16, D3): the chosen main planet
  (#221) cannot be given up; the player changes the main planet first.
  #221 itself still has open points.
* **[E]** Moon and stock (owner, 2026-11-16, Q1): everything is lost, the
  buildings, units, resources, orders and the moon. Classic differs: the
  destroyed planet kept its buildings, fleet and resources until the
  deletion and could still be attacked (owiki „Zerstörter Planet“).

# Out of scope

* Giving up a moon on its own (classic since v0.77b); see
  [Moons](/features/moons.md).
