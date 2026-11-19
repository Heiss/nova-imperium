---
type: feature
title: Cancelling a shipyard order
description: Every order of the shipyard list can be cancelled with a full refund of the units not done yet; units already done stay (issue #258).
---

# Cancelling a shipyard order

Issue #258 („Geklärt“, owner, 2026-11-16; milestone next release, label
`ready`). A player can cancel an order of the shipyard („Schiffsschmiede“) as
they can cancel a building upgrade or a research. The list `P.sq` holds up to
20 orders, each one kind of unit with a count `n` and a time per unit `unit`;
ships and defense share it ([Nanitenfabrik](/features/nanite-factory.md) for
the shipyard lock, [Requirements list](/features/requirements.md) for the
cancel of buildings and research).

# Decisions

* **[E]** Scope: every order of the shipyard list can be cancelled, ships and
  defense alike (owner, 2026-11-16).
* **[E]** Amount: a cancel removes the whole rest of that order, every unit
  of it that is not done yet; units already done stay on the planet (owner,
  2026-11-16).
* **[E]** Refund: 100 % of the cost of every unit not done yet, including the
  unit in progress; its progress is lost (owner, 2026-11-16).
* **[E]** Unchanged from the issue and taken after the cancel of buildings
  and research („Geklärt“, 2026-11-16): the planet is settled first, so
  units finished by now are done and not refunded; cancelling the first
  order lets the next one start now (`sqT = now`), with no order left
  `sqT = null`, and cancelling a later order leaves the time of the running
  one; no confirmation dialog; the push „Schiffsschmiede fertig“ moves to
  the new end of the list or goes when the list is empty; a cancelled
  Schutzdom frees its place (`unitRoom` counts queued units); the action
  `cancelOrder` takes the position and the unit key, and a stale cancel
  changes nothing.
* **[V]** Cancelling is allowed while an upgrade locks the shipyard
  (Schiffsschmiede, Machina-Schwarmhalle, #48): the list waits then and
  nothing runs. In practice the list is empty during a lock, because the
  upgrade waits for an empty list and a locked shipyard takes no orders.
* **[V]** The position must be a whole number from 0, as a JSON number;
  anything else is refused with „Ungültig.“ (a request that no button sends).
  A position that holds no order, or an order of another unit, is no error
  (it finished meanwhile).

# Built [V]

* Rule: `src/core/cancel-order.ts`, `cancelOrder(p, pos, key, now)`, a pure
  function on a planet settled to `now`: it refunds `n` times the cost of the
  unit (`pay` with a negative count), removes the order, sets the start time
  of the list when the first order went, and returns what it took out, or
  null for a stale cancel.
* Action: `cancelOrder` in `src/server/game/actions.ts` next to `order`; the
  only line added to the list of actions is `cancelOrder: A.cancelOrder,` in
  `src/server/game/dispatch.ts`. It settles through `mine()` (an own planet
  only, `d.planet` or the main planet), saves only when something was
  cancelled, and moves the push with `scheduleShipyard()` or removes it with
  `cancelScheduledPush(…, 'shipyard', '<planet>:*')`. The audit row is in
  [Checks of the server actions](/architecture/action-checks.md) (economy).
* Browser: the box „Bauauftrag der Schiffsschmiede“ of the shipyard and defense
  pages has a small red button „Abbrechen“ per order (`data-act="cancelOrder"`,
  `data-pos`, `data-k`); `cancelOrder` in `src/client/features/queue.ts` sends
  `{ pos, key }`. The refund shows like that of a building (no message); the
  list and the countdown of the overview follow the new state.

# Texts [V]

* The button „Abbrechen“ (from the issue), with the accessible name
  „Abbrechen: ‹Auftrag›“, for example „Abbrechen: 3× Raketenbatterie“, so that
  several buttons differ and „Abbrechen“ stays in the name.

# Tests

* `src/core/cancel-order.test.ts` (refund of ships and defense, units done
  stay, the first and a later order, an empty list, a stale or malformed
  cancel, and a property test that an order and its cancel give back exactly
  what was paid);
* `src/server/game/cancel-order.test.ts` (refund amount, done units, start
  time, a stale cancel, a foreign planet, a malformed position, a Schutzdom, a
  locked shipyard, the push moved or removed, the action through `runAction`);
* `src/client/features/queue.test.ts` (the handler with the fake context),
  `src/client/views/catalog-list.test.ts` and the reference
  `src/test/catalog-list-reference.test.ts` (the button in the markup, added
  on purpose).

Worth adding as E2E (Playwright, desktop and phone): order ships and cancel the
first order, the resources are back and the next order starts; cancel a later
order of two and the countdown stays; order a Schutzdom, cancel it and order it
again; a stale cancel (the order finished) shows no error.
