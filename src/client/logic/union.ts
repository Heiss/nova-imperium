// The attack union („Verbandsangriff“, #225) in the browser, without HTML:
// what the box „Verbandsangriff“ of the fleet view shows, which fleets can
// open a union, which unions the fleet form can join, and the arrival line
// of a fleet that joins. The rules are those of src/core/union.ts, the
// limits those of the round the server sends.
import type { RoundRules } from '../../core/round.ts';
import {
  flightRefusal,
  joinMessage,
  planError,
  planMessage,
  plannedStart,
  joinWindow,
  unionFlight,
  type UnionLimits,
} from '../../core/union.ts';
import { flightMs } from '../../core/flight.ts';
import type { Levels, Universe } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import { coords, dt } from './format.ts';
import { nameOf } from './game.ts';
import type { ClientFleet, GameState, UnionState } from './types.ts';

/** The limits and timing rules of the round (owner, 2026-11-16, D3; 2026-11-17). */
export const limitsOf = (round: RoundRules): UnionLimits => ({
  fleets: round.unionFleets,
  players: round.unionPlayers,
  cutoff: round.unionCutoff,
});

/** The unions the player leads, flies in or is invited to. */
export const unionsOf = (s: Pick<GameState, 'unions'>): UnionState[] =>
  s.unions ?? [];

/** One union as the box shows it. */
export interface UnionRow {
  id: string;
  /** „Verbandsangriff auf [1:4:8]“. */
  title: string;
  /** The place, for the fleet form. */
  toC: UnionState['toC'];
  /** When all its fleets arrive. */
  arr: number;
  leader: string;
  /** „Flotten 2 / 16 · Spieler 2 / 5“. */
  counts: string;
  /** „Anna (1), Bert (2)“, the leader's first. */
  fleets: string;
  /** The players invited who have not joined, „Cora, Dora“; empty when none. */
  invited: string;
  /** The player leads it: he can invite. */
  leads: boolean;
  /** When the leader's fleet starts by itself, while it is planned (#478); else null. */
  start: number | null;
}

/**
 * The owner of each fleet of a union, the leader's first; the leader's fleet
 * counts from the planning, before it starts (#478), as on the server.
 */
const ownersOf = (u: UnionState): string[] => [
  ...(u.start === undefined ? [] : [u.leader]),
  ...u.fleets.map((f) => f.owner),
];

/** The owners of the fleets of a union, each with the number of his fleets, the leader's first. */
function fleetsLine(v: Pick<V, 's'>, u: UnionState): string {
  const counts = new Map<string, number>();
  for (const owner of ownersOf(u))
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  return [...counts]
    .map(([owner, n]) => `${nameOf(v.s.players, owner)} (${n})`)
    .join(', ');
}

/** The unions of the box „Verbandsangriff“, the earliest arrival first (the server sorts them). */
export function unionRows(v: Pick<V, 's'>): UnionRow[] {
  return unionsOf(v.s).map((u) => unionRow(v, u, limitsOf(v.s.round)));
}

/** One union of the box. */
const unionRow = (
  v: Pick<V, 's'>,
  u: UnionState,
  limits: UnionLimits,
): UnionRow => ({
  id: u.id,
  title: `Verbandsangriff auf ${coords(u.toC)}`,
  toC: u.toC,
  arr: u.arr,
  leader: nameOf(v.s.players, u.leader),
  counts: `Flotten ${ownersOf(u).length} / ${limits.fleets} · Spieler ${new Set(ownersOf(u)).size} / ${limits.players}`,
  fleets: fleetsLine(v, u),
  invited: u.invited.map((i) => nameOf(v.s.players, i)).join(', '),
  leads: u.leader === v.s.me.id,
  start: u.start ?? null,
});

/**
 * The ships of `planet` that the player's planned starts hold back (#478):
 * they stay there but no other order takes them.
 */
export function heldBack(s: Pick<GameState, 'unions'>, planet: string): Levels {
  const out: Levels = {};
  for (const u of unionsOf(s))
    if (u.held?.from === planet)
      for (const [k, n] of Object.entries(u.held.ships))
        out[k] = (out[k] ?? 0) + n;
  return out;
}

/** The planned starts of the player that have not started: each takes a fleet slot (#478). */
export const plannedStarts = (s: Pick<GameState, 'unions'>): number =>
  unionsOf(s).filter((u) => u.held !== undefined).length;

/** The ships of `planet` free for an order: what is there, less what a planned start holds back (#478). */
export function freeShips(
  s: Pick<GameState, 'unions'>,
  planet: { id: string; ships: Levels },
): Levels {
  const held = heldBack(s, planet.id);
  return Object.fromEntries(
    Object.entries(planet.ships).map(([k, n]) => [
      k,
      Math.max(0, n - (held[k] ?? 0)),
    ]),
  );
}

/** „ · Angriffsverband“ behind an own fleet that flies in a union, the leader's own „ (Anführer)“. */
export const unionPart = (f: ClientFleet): string =>
  f.union === undefined
    ? ''
    : f.union === f.id
      ? ' · Angriffsverband (Anführer)'
      : ' · im Angriffsverband';

/** A union the fleet form can join: its ID, its label and its target. */
export interface JoinChoice {
  id: string;
  label: string;
  to: UnionState['toC'];
  /** The union flies to the moon of the position, not its planet. */
  moon: boolean;
}

/** The unions the fleet form offers: every one the player leads, flies in or is invited to. */
export const joinChoices = (v: Pick<V, 's'>): JoinChoice[] =>
  unionsOf(v.s).map((u) => ({
    id: u.id,
    label: `${nameOf(v.s.players, u.leader)} → ${coords(u.toC)}, Ankunft ${dt(u.arr)}`,
    to: u.toC,
    moon: u.to.startsWith('m'),
  }));

/**
 * How a fleet of the form joins a union: its speed, its flight and the
 * arrival X, or the refusal; with `start`, the leader's fleet starts later
 * by itself at the step of the form (#478).
 */
export type UnionJoin =
  | { pct: number; ms: number; arr: number; start?: number }
  | { refusal: string };

/**
 * How a fleet that starts at `now`, flying `dist` at the speed `speed`,
 * joins the union `id` (the rules of the server, src/core/union.ts, #466):
 * the cut-off, then the speed that brings it there at X; null when the
 * union is not known.
 */
export function unionJoin(
  s: Pick<GameState, 'unions' | 'round'> & { cfg: Universe },
  id: string,
  now: number,
  fleet: { dist: number; speed: number },
): UnionJoin | null {
  const union = unionsOf(s).find((u) => u.id === id);
  if (!union) return null;
  const limits = limitsOf(s.round);
  const closed = joinWindow({ now, arr: union.arr, limits });
  if (closed) return { refusal: joinMessage(closed, limits) };
  return flightAt(s, union.arr, now, fleet);
}

/** The value of the choice „Verband“ that plans a new union (#466, A1a). */
export const PLAN = 'plan';

/**
 * How the leader's own Sturmangriff plans a union arriving at `arr` (#466,
 * the rules of the server): the arrival in the future and beyond the
 * cut-off, then the speed that brings the fleet there; `arr` NaN while no
 * time is chosen.
 */
export function planJoin(
  s: Pick<GameState, 'round'> & { cfg: Universe },
  arr: number,
  now: number,
  fleet: { dist: number; speed: number; pct: number },
): UnionJoin {
  if (Number.isNaN(arr))
    return { refusal: 'Bitte die Ankunft des Verbands wählen.' };
  const limits = limitsOf(s.round);
  const refused = planError({ now, arr, limits });
  if (refused) return { refusal: planMessage(refused, limits) };
  // Too early even at 10 %: the fleet starts later by itself, at the step of
  // the form, and arrives at X (#478).
  const flight = unionFlight({ ...fleet, universe: s.cfg, now, arr });
  if ('error' in flight && flight.error === 'early')
    return {
      pct: fleet.pct,
      ms: flightMs(fleet.dist, fleet.speed, fleet.pct, s.cfg),
      arr,
      start: plannedStart({ ...fleet, universe: s.cfg, arr }),
    };
  return flightAt(s, arr, now, fleet);
}

/** The speed that brings a fleet starting at `now` there at `arr`, or the refusal. */
function flightAt(
  s: { cfg: Universe; round: RoundRules },
  arr: number,
  now: number,
  fleet: { dist: number; speed: number },
): UnionJoin {
  const limits = limitsOf(s.round);
  const flight = unionFlight({ ...fleet, universe: s.cfg, now, arr });
  // The server names the earliest start to the second, rounded up: a fleet
  // sent at it makes the arrival.
  if ('error' in flight)
    return {
      refusal: flightRefusal(flight, limits, (t) =>
        dt(Math.ceil(t / 1000) * 1000),
      ),
    };
  return { pct: flight.pct, ms: arr - now, arr };
}

/** The speed of a joining fleet as the form shows it: „37,5 %“. */
export const unionSpeed = (pct: number): string =>
  `${(pct * 10).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

/**
 * „Ankunft / Rückkehr“ of a fleet that joins a union: X and the way back
 * after a flight as long, with the speed it flies at; the refusal in red.
 */
export const unionArrivalLine = (join: UnionJoin): string =>
  'refusal' in join
    ? `<span class="bad">${join.refusal}</span>`
    : `${dt(join.arr)} / ${dt(join.arr + join.ms)} <span class="dim">(Verband: ${join.start === undefined ? `Geschwindigkeit ${unionSpeed(join.pct)}` : laterPart(join.start, join.pct)})</span>`;

/** The words of a later start in the arrival line (#478) [V]: „Start am …, 50 %“. */
const laterPart = (start: number, pct: number): string =>
  `Start am ${dt(start)} mit ${unionSpeed(pct)}`;
