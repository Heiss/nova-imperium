// The attack union („Verbandsangriff“, #225) in the browser, without HTML:
// what the box „Verbandsangriff“ of the fleet view shows, which fleets can
// open a union, which unions the fleet form can join, and the arrival line
// of a fleet that joins. The rules are those of src/core/union.ts, the
// limits those of the round the server sends.
import type { RoundRules } from '../../core/round.ts';
import {
  joinMessage,
  planError,
  planMessage,
  joinWindow,
  unionFlight,
  type UnionLimits,
} from '../../core/union.ts';
import type { Universe } from '../../core/types.ts';
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
}

/** The owners of the fleets of a union, each with the number of his fleets, the leader's first. */
function fleetsLine(v: Pick<V, 's'>, u: UnionState): string {
  const counts = new Map<string, number>();
  for (const f of u.fleets) counts.set(f.owner, (counts.get(f.owner) ?? 0) + 1);
  return [...counts]
    .map(([owner, n]) => `${nameOf(v.s.players, owner)} (${n})`)
    .join(', ');
}

/** The unions of the box „Verbandsangriff“, the earliest arrival first (the server sorts them). */
export function unionRows(v: Pick<V, 's'>): UnionRow[] {
  const unions = unionsOf(v.s);
  if (!unions.length) return [];
  const limits = limitsOf(v.s.round);
  return unions.map((u) => ({
    id: u.id,
    title: `Verbandsangriff auf ${coords(u.toC)}`,
    toC: u.toC,
    arr: u.arr,
    leader: nameOf(v.s.players, u.leader),
    counts: `Flotten ${u.fleets.length} / ${limits.fleets} · Spieler ${new Set(u.fleets.map((f) => f.owner)).size} / ${limits.players}`,
    fleets: fleetsLine(v, u),
    invited: u.invited.map((i) => nameOf(v.s.players, i)).join(', '),
    leads: u.leader === v.s.me.id,
  }));
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

/** How a fleet of the form joins a union: its speed, its flight and the arrival X, or the refusal. */
export type UnionJoin =
  { pct: number; ms: number; arr: number } | { refusal: string };

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
  fleet: { dist: number; speed: number },
): UnionJoin {
  if (Number.isNaN(arr))
    return { refusal: 'Bitte die Ankunft des Verbands wählen.' };
  const limits = limitsOf(s.round);
  const refused = planError({ now, arr, limits });
  if (refused) return { refusal: planMessage(refused, limits) };
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
  if ('error' in flight)
    return {
      refusal: joinMessage(
        flight.error,
        limits,
        flight.error === 'early' ? `am ${dt(flight.earliest)}` : '',
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
    : `${dt(join.arr)} / ${dt(join.arr + join.ms)} <span class="dim">(Verband: Geschwindigkeit ${unionSpeed(join.pct)})</span>`;
