// The shipyard lock, used by the server and the client. A building of
// YARD_LOCK stops the shipyard while it is upgraded, and its upgrade waits
// until the shipyard has no orders (classic rule; Nanitenfabrik: #48, D1).
import type { Planet } from './types.ts';

/** The buildings that lock the shipyard, with the short name for messages. */
export const YARD_LOCK: Readonly<Record<string, string>> = {
  yard: 'Werft',
  nanite: 'Nanitenfabrik',
};

const locks = (key: string): boolean => Object.hasOwn(YARD_LOCK, key);

/** The building whose upgrade stops the shipyard now, or null. */
export const yardLockedBy = (p: Pick<Planet, 'bq'>): string | null =>
  p.bq && locks(p.bq.key) ? p.bq.key : null;

/** Whether an upgrade of `key` must wait for the orders of the shipyard. */
export const waitsForYard = (p: Pick<Planet, 'sq'>, key: string): boolean =>
  locks(key) && p.sq.length > 0;
