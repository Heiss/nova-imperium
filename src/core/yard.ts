// The shipyard lock, used by the server and the client. A building with the
// component `locks` for the shipyard (#183) stops the shipyard while it is
// upgraded, and its upgrade waits until the shipyard has no orders (classic
// rule; Nanitenfabrik: #48, D1).
// Also the limit of units a planet may have, the shield domes (#50), read
// through the rule module of the component `limit` (#114), and the room of
// the silos for the missiles (#54), read through the rule module of the
// components `silo` and `missile`.
import { LIMIT, LOCKS, MISSILE, SILO, UNIT } from './catalog.ts';
import { type Limit, room } from './components/limit.ts';
import { homeOf, stoppers, stops } from './components/locks.ts';
import {
  fits,
  type Missile,
  missilePlaces,
  siloPlaces,
} from './components/silo.ts';
import { maxAfford } from './economy.ts';
import { text } from './text.ts';
import type { Levels, Planet } from './types.ts';

/** The building that is the shipyard itself: the one whose levels ships and defense need. */
export const YARD_HOME = homeOf(LOCKS, 'shipyard')!;

/** The name of a building in a message: its short name, else its name. */
const messageName = (key: string): string => {
  const t = text(key);
  return t?.short ?? t?.n ?? key;
};

/** The buildings that lock the shipyard, with the short name for messages. */
export const YARD_LOCK: Readonly<Record<string, string>> = Object.fromEntries(
  stoppers(LOCKS, 'shipyard').map((key) => [key, messageName(key)]),
);

const locks = (key: string): boolean => stops(LOCKS, key, 'shipyard');

/** Whether the place has a shipyard, which ships and defense need. */
export const hasYard = (p: Pick<Planet, 'b'>): boolean =>
  (p.b[YARD_HOME] ?? 0) > 0;

/** The building whose upgrade stops the shipyard now, or null. */
export const yardLockedBy = (p: Pick<Planet, 'bq'>): string | null =>
  p.bq && locks(p.bq.key) ? p.bq.key : null;

/** Whether an upgrade of `key` must wait for the orders of the shipyard. */
export const waitsForYard = (p: Pick<Planet, 'sq'>, key: string): boolean =>
  locks(key) && p.sq.length > 0;

/** The component `limit` of a unit; undefined for anything without one. */
const limitOf = (key: string): Limit | undefined =>
  Object.hasOwn(LIMIT, key) ? LIMIT[key] : undefined;

/** The units of each key in the queue of the shipyard. */
function queued(p: Pick<Planet, 'sq'>): Levels {
  const out: Levels = {};
  for (const q of p.sq) out[q.key] = (out[q.key] ?? 0) + q.n;
  return out;
}

/**
 * How many more units of `key` the planet may order by its `limit`: at most
 * `perPlanet` times, counting those it has and those in the queue (the
 * shield domes once, #50, D3); any other unit without bound.
 */
export function limitRoom(p: Pick<Planet, 'def' | 'sq'>, key: string): number {
  const ordered = p.sq
    .filter((q) => q.key === key)
    .reduce((n, q) => n + q.n, 0);
  return room(limitOf(key), p.def[key] ?? 0, ordered);
}

/** The component `missile` of a unit; undefined for anything without one. */
const missileOf = (key: string): Missile | undefined =>
  Object.hasOwn(MISSILE, key) ? MISSILE[key] : undefined;

/**
 * The places of the silos of a place and those its missiles take, the
 * stock and the queue of the shipyard (#54).
 */
export function siloUse(p: Pick<Planet, 'b' | 'def' | 'sq'>): {
  used: number;
  places: number;
} {
  const q = queued(p);
  const pieces: Levels = {};
  for (const key of Object.keys(MISSILE))
    pieces[key] = (p.def[key] ?? 0) + (q[key] ?? 0);
  return {
    used: missilePlaces(MISSILE, pieces),
    places: siloPlaces(SILO, p.b),
  };
}

/**
 * How many more units of `key` fit into the silos of the planet: a missile
 * as many as its places allow (#54); any other unit without bound.
 */
export function siloRoom(
  p: Pick<Planet, 'b' | 'def' | 'sq'>,
  key: string,
): number {
  const missile = missileOf(key);
  if (!missile) return Infinity;
  const { used, places } = siloUse(p);
  return fits(missile, places - used);
}

/** How many more units of `key` the planet may order: its limit and its silo room. */
export const unitRoom = (
  p: Pick<Planet, 'b' | 'def' | 'sq'>,
  key: string,
): number => Math.min(limitRoom(p, key), siloRoom(p, key));

/** The largest order of `key` the planet can pay and may have. */
export const orderMax = (
  p: Pick<Planet, 'res' | 'b' | 'def' | 'sq'>,
  key: string,
): number => Math.min(maxAfford(p, UNIT[key]!.cost), unitRoom(p, key));
