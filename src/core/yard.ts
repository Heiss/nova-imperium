// The shipyard lock, used by the server and the client. A building of
// YARD_LOCK stops the shipyard while it is upgraded, and its upgrade waits
// until the shipyard has no orders (classic rule; Nanitenfabrik: #48, D1).
// Also the limit of units a planet may have, the shield domes (#50), read
// through the rule module of the component `limit` (#114).
import { LIMIT, UNIT } from './catalog.ts';
import { type Limit, room } from './components/limit.ts';
import { maxAfford } from './economy.ts';
import type { Planet } from './types.ts';

/** The buildings that lock the shipyard, with the short name for messages. */
export const YARD_LOCK: Readonly<Record<string, string>> = {
  yard: 'Schiffsschmiede',
  nanite: 'Machina-Schwarmhalle',
};

const locks = (key: string): boolean => Object.hasOwn(YARD_LOCK, key);

/** The building whose upgrade stops the shipyard now, or null. */
export const yardLockedBy = (p: Pick<Planet, 'bq'>): string | null =>
  p.bq && locks(p.bq.key) ? p.bq.key : null;

/** Whether an upgrade of `key` must wait for the orders of the shipyard. */
export const waitsForYard = (p: Pick<Planet, 'sq'>, key: string): boolean =>
  locks(key) && p.sq.length > 0;

/** The component `limit` of a unit; undefined for anything without one. */
const limitOf = (key: string): Limit | undefined =>
  Object.hasOwn(LIMIT, key) ? LIMIT[key] : undefined;

/**
 * How many more units of `key` the planet may order: a unit with `limit` at
 * most `perPlanet` times, counting those it has and those in the queue (the
 * shield domes once, #50, D3); any other unit without bound.
 */
export function unitRoom(p: Pick<Planet, 'def' | 'sq'>, key: string): number {
  const queued = p.sq.filter((q) => q.key === key).reduce((n, q) => n + q.n, 0);
  return room(limitOf(key), p.def[key] ?? 0, queued);
}

/** The largest order of `key` the planet can pay and may have. */
export const orderMax = (
  p: Pick<Planet, 'res' | 'def' | 'sq'>,
  key: string,
): number => Math.min(maxAfford(p, UNIT[key]!.cost), unitRoom(p, key));
