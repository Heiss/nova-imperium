---
type: log-entry
date: 2026-11-19T18:30
kind: Code
issues: [258, 48]
---

#258 built after the owner's „Geklärt“ of 2026-11-16: every order of the shipyard list, ships and defense alike, can be cancelled; a cancel removes the whole rest of the order and refunds 100 % of the cost of every unit not done yet, the one in progress included, while units done stay; the planet is settled first, the next order starts now when the first one went, the push moves to the new end or goes, a cancelled Schutzdom frees its place, a stale cancel changes nothing. The rule is the pure function `cancelOrder()` in `src/core/cancel-order.ts`, the action `cancelOrder` is in `src/server/game/actions.ts` and listed with one line in `dispatch.ts`, the button „Abbrechen“ per order is in the box of the shipyard and defense pages (`features/queue.ts`). [V] Allowed while an upgrade locks the shipyard (#48); a position that is no whole number from 0 is refused with „Ungültig.“; the accessible name of the button is „Abbrechen: ‹Auftrag›“. See [Cancelling a shipyard order](/features/shipyard-cancel.md).
