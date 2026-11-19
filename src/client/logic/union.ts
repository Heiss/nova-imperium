// The attack union („Verbandsangriff“, #225) in the browser, without HTML:
// what the box „Verbandsangriff“ of the fleet view shows, which fleets can
// open a union, which unions the fleet form can join, and the arrival line
// of a fleet that joins. The rules are those of src/core/union.ts, the
// limits those of the round the server sends.
import type { RoundRules } from '../../core/round.ts';
import {
  foundError,
  joinMessage,
  joinTiming,
  type UnionLimits,
} from '../../core/union.ts';
import type { V } from '../views/common.ts';
import { coords, dt, dur } from './format.ts';
import { nameOf } from './game.ts';
import type { ClientFleet, GameState, UnionState } from './types.ts';

/** The limits and timing rules of the round (owner, 2026-11-16, D3; 2026-11-17). */
export const limitsOf = (round: RoundRules): UnionLimits => ({
  fleets: round.unionFleets,
  players: round.unionPlayers,
  delay: round.unionDelay,
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

/**
 * Whether the own fleet can open a union now: a Sturmangriff on its way that
 * has not arrived and belongs to no union (the rule of the server).
 */
export const canOpenUnion = (
  f: ClientFleet,
  me: string,
  now: number,
): boolean =>
  f.owner === me &&
  foundError(
    {
      mission: f.mission,
      state: f.state,
      arr: f.arr,
      recalled: false,
      gift: f.gift,
    },
    now,
    f.union !== undefined,
  ) === undefined;

/** „ · Angriffsverband“ behind an own fleet that flies in a union, the leader's own „ (Anführer)“. */
export const unionPart = (f: ClientFleet): string =>
  f.union === undefined
    ? ''
    : f.union === f.id
      ? ' · Angriffsverband (Anführer)'
      : ' · im Angriffsverband';

/** An own Sturmangriff that can open a union: its target and its arrival. */
export interface OpenRow {
  id: string;
  /** „[1:4:8]“. */
  target: string;
  arr: number;
}

/** The own fleets that can open an attack union now, by arrival. */
export const openRows = (v: Pick<V, 's' | 'now'>): OpenRow[] =>
  v.s.fleets
    .filter((f) => canOpenUnion(f, v.s.me.id, v.now))
    .sort((a, b) => a.arr - b.arr)
    .map((f) => ({ id: f.id, target: coords(f.toC), arr: f.arr }));

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
 * „Ankunft / Rückkehr“ of a fleet that joins the union `id` with a flight of
 * `ms` (the rules of the arrival, src/core/union.ts): it arrives with the
 * union, or delays it, or is refused; null when the union is not known.
 */
export function unionArrivalLine(
  s: Pick<GameState, 'unions' | 'round'>,
  id: string,
  now: number,
  ms: number,
): string | null {
  const union = unionsOf(s).find((u) => u.id === id);
  if (!union) return null;
  const limits = limitsOf(s.round);
  const timing = joinTiming({ now, arr: union.arr, flight: ms, limits });
  if ('error' in timing)
    return `<span class="bad">${joinMessage(timing.error, limits)}</span>`;
  const delay = timing.arr - union.arr;
  const note =
    delay > 0
      ? ` <span class="dim">(verzögert den Verband um ${dur(delay)})</span>`
      : '';
  return `${dt(timing.arr)} / ${dt(timing.arr + ms)}${note}`;
}
