---
type: feature
title: Nanitenfabrik
description: The building that halves building and shipyard times, and the shipyard lock it shares with the Werft.
---

# Nanitenfabrik

Issue #48. Not in version 1; the classic values of the issue, taken over by the
owner as they are (2026-11-11, item 2 = a).

* **[E]** Costs 1,000,000 metal, 500,000 crystal and 100,000 deuterium at
  level 1, factor 2 per level. Requires Roboterfabrik 10 and Computertechnik 10.
* **[E]** Each level halves the build time of buildings, ships and defense:
  buildings `(M + K) / (2500 · (1 + Roboterfabrik) · 2^Nanitenfabrik)` hours,
  ships and defense the same with the Werft instead of the Roboterfabrik.
  Research times are unchanged; one second stays the minimum
  (`src/shared/economy.ts`).
* **[E]** Shipyard lock as for the Werft (D1 = 1, owner 2026-11-11): while the
  Nanitenfabrik is upgraded, the shipyard takes no orders („Die
  Nanitenfabrik wird ausgebaut.“), and its upgrade waits until the shipyard
  has no orders („Die Werft arbeitet gerade.“). The second direction follows
  „as for the Werft“; the issue names only the first.
* **[E]** The lock rules live in one place, `src/shared/yard.ts`
  (`YARD_LOCK`, `yardLockedBy`, `waitsForYard`), used by the server, the
  requirements list and the client (owner, 2026-11-11).
* **[E]** Icon `nanite_factory.svg` from the interface v2 set
  (`docs/design/interface-v2/icons/`).
* Like every building, it gets the level achievements automatically.
* Tests: `src/shared/yard.test.ts`, `economy.test.ts`, `catalog.test.ts`,
  `src/server/game/actions.test.ts`, E2E „the Nanitenfabrik halves build times
  and stops the shipyard (#48)“. The equivalence test with version 1 compares
  only the buildings of version 1.
