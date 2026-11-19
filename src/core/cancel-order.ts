// Cancelling an order of the shipyard (#258, owner, 2026-11-16): an order of
// the list `sq`, ships and defense alike, is taken out as a whole, and every
// unit of it that is not done yet is refunded in full, the unit in progress
// included (its progress is lost, as with a building upgrade). Units that
// are done stay on the planet. The planet is the one the server settled to
// `now`, so units finished by now are done and not refunded.
import { UNIT } from './catalog.ts';
import { pay } from './economy.ts';
import type { Planet } from './types.ts';

/** The order a cancel took out of the list. */
export interface Cancelled {
  key: string;
  /** The units that were not done yet, and are refunded. */
  n: number;
}

/**
 * Takes the order at position `pos` out of the shipyard list of `p` when it
 * still holds `key`, and gives back the full cost of its units that are not
 * done yet. Cancelling the first order lets the next one start at `now`, as
 * its progress is lost; with no order left the shipyard has no start time.
 * Cancelling a later order leaves the time of the running one as it is.
 * Returns what was taken out, or null when `pos` holds no order or another
 * unit (the order finished meanwhile), where nothing changes.
 */
export function cancelOrder(
  p: Pick<Planet, 'res' | 'sq' | 'sqT'>,
  pos: number,
  key: string,
  now: number,
): Cancelled | null {
  const order = p.sq[pos];
  if (!order || order.key !== key) return null;
  pay(p, UNIT[order.key]!.cost, -order.n);
  p.sq.splice(pos, 1);
  if (pos === 0) p.sqT = p.sq.length ? now : null;
  return { key: order.key, n: order.n };
}
