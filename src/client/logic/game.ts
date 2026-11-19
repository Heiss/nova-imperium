// Logic of the interface that is not HTML: ranks, protection, what a button
// shows, the preview of a flight, the cargo button, galaxy navigation.
import {
  type BuildError,
  buildErrors,
  type ResearchError,
  researchErrors,
} from '../../core/economy-checks.ts';
import {
  capacity,
  countUnits,
  distance,
  fleetSpeed,
  flightMs,
  fuelFor,
  holdFuel,
} from '../../core/flight.ts';
import { HOUR_MS, dueAt } from '../../core/holding.ts';
import { missionRules } from '../../core/missions.ts';
import { isProtected as protects } from '../../core/protection.ts';
import type {
  Coords,
  Levels,
  Planet,
  ResearchState,
  Resources,
  Universe,
} from '../../core/types.ts';
import { dt } from './format.ts';
import type { ClientFleet, Players, Report } from './types.ts';

export function ranks(players: Players): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(players)
    .sort((a, b) => b[1].points - a[1].points)
    .forEach(([id], i) => (out[id] = i + 1));
  return out;
}

export const isProtected = (
  players: Players,
  me: string,
  other: string,
): boolean => protects(players[me]?.points ?? 0, players[other]?.points ?? 0);

export const nameOf = (players: Players, id: string): string =>
  players[id]?.name ?? 'Unbekannt';

/** When a fleet is due: its arrival, the end of its holding (#55) or its return. */
export const fleetEnd = (f: ClientFleet): number =>
  dueAt({ ...f, ret: f.ret ?? f.arr });

export const sortFleets = (list: ClientFleet[]): ClientFleet[] =>
  list.slice().sort((a, b) => fleetEnd(a) - fleetEnd(b));

/**
 * What the row of a building shows: its running upgrade, the first code of
 * `buildErrors` (the browser and the server take the same order, O18 (c),
 * F8), or that it can start.
 */
export type BuildState = 'running' | BuildError | 'ready';

export function buildState(
  p: Planet,
  r: ResearchState,
  key: string,
  u: Universe,
): BuildState {
  if (p.bq?.key === key) return 'running';
  return buildErrors(p, r, key, u)[0] ?? 'ready';
}

/** The same for research, from `researchErrors` (F9). */
export type ResearchUiState = 'running' | ResearchError | 'ready';

export function researchState(
  p: Planet,
  r: ResearchState,
  key: string,
  u: Universe,
): ResearchUiState {
  if (r.rq?.key === key) return 'running';
  return researchErrors(p, r, key, u)[0] ?? 'ready';
}

export interface FleetForm {
  ships: Levels;
  /** The position, and whether the planet or its moon (#53). */
  to: Coords & { kind?: 'planet' | 'moon' };
  mission: string;
  pct: number;
  cargo: Resources;
  /** The holding time of a Halten in hours (#55). */
  hold?: number;
}

export interface FleetPreview {
  dist: number;
  ms: number;
  /** How long a Halten holds, in milliseconds (#55); 0 for the others. */
  hold: number;
  fuel: number;
  cap: number;
  load: number;
  fuelShort: boolean;
  overload: boolean;
}

/** Whether the fleet of the form holds at its target (#55). */
const holdsFor = (f: FleetForm): boolean =>
  missionRules(f.mission)?.holds === true;

/** The fuel of the form: the flight, and the holding time of a Halten (#55, D2). */
const formFuel = (f: FleetForm, dist: number): number =>
  fuelFor(f.ships, dist, f.pct) +
  (holdsFor(f) ? holdFuel(f.ships, f.hold ?? 0) : 0);

/**
 * „Ankunft / Rückkehr“ of the form: a mission that stays at its target
 * (deploy, #129) has no return, a Halten comes back after its holding time
 * (#55).
 */
export const arrivalLine = (
  mission: string,
  now: number,
  pv: Pick<FleetPreview, 'ms' | 'hold'>,
): string =>
  `${dt(now + pv.ms)} / ${missionRules(mission)?.returns === false ? '–' : dt(now + 2 * pv.ms + pv.hold)}`;

export function fleetPreview(
  p: Planet,
  r: ResearchState,
  f: FleetForm,
  u: Universe,
): FleetPreview | null {
  if (!countUnits(f.ships)) return null;
  const dist = distance(p, f.to);
  const fuel = formFuel(f, dist);
  const cap = capacity(f.ships);
  const load = f.cargo.m + f.cargo.c + f.cargo.d;
  return {
    dist,
    ms: flightMs(dist, fleetSpeed(f.ships, r), f.pct, u),
    hold: holdsFor(f) ? (f.hold ?? 0) * HOUR_MS : 0,
    fuel,
    cap,
    load,
    fuelShort: fuel + f.cargo.d > p.res.d,
    overload: load > cap,
  };
}

type CargoKey = keyof Resources;
/** The resources a fleet carries, in the order of the cargo fields. */
export const CARGO: CargoKey[] = ['m', 'c', 'd'];

/** What a flight can load: whole units, Promethium after the fuel. */
function loadable(p: Planet, f: FleetForm): Resources {
  // Without ships the holds are empty, whatever the fuel.
  // The fuel of a Wache stellen includes its holding time (#55, D2).
  const fuel = formFuel(f, distance(p, f.to));
  return {
    m: Math.floor(p.res.m),
    c: Math.floor(p.res.c),
    d: Math.max(0, Math.floor(p.res.d - fuel)),
  };
}

/**
 * Equal shares of the room (#240), the resource with the least stock first:
 * what it cannot fill goes to the others. A share is rounded up, so the room
 * is used fully when the stock allows.
 */
function fillEvenly(stock: Resources, room: number): Resources {
  const out = {} as Resources;
  const order = [...CARGO].sort((a, b) => stock[a] - stock[b]);
  order.forEach((k, i) => {
    out[k] = Math.min(stock[k], Math.ceil(room / (order.length - i)));
    room -= out[k];
  });
  return out;
}

/** „alles“ (#240): fills the holds evenly with the three resources. */
export const cargoMax = (p: Planet, f: FleetForm): Resources =>
  fillEvenly(loadable(p, f), capacity(f.ships));

/**
 * „alles“ under a field (#240): only that resource, up to the room the other
 * two fields leave; they stay as they are.
 */
export function cargoOne(p: Planet, f: FleetForm, key: CargoKey): number {
  const others = CARGO.reduce(
    (sum, k) => (k === key ? sum : sum + f.cargo[k]),
    0,
  );
  return Math.max(0, Math.min(loadable(p, f)[key], capacity(f.ships) - others));
}

const STEPS: Record<string, [number, number]> = {
  'g-': [-1, 0],
  'g+': [1, 0],
  's-': [0, -1],
  's+': [0, 1],
};

/** The next galaxy view: galaxies stop at the ends, systems wrap around. */
export function galaxyStep(
  gal: number,
  sys: number,
  dir: string,
  u: Universe,
): { gal: number; sys: number } {
  const [dg, ds] = STEPS[dir] ?? [0, 0];
  let s = sys + ds;
  if (s < 1) s = u.systems;
  if (s > u.systems) s = 1;
  return { gal: Math.max(1, Math.min(u.galaxies, gal + dg)), sys: s };
}

export const unread = (reports: Report[], readAt: number): number =>
  reports.filter((r) => r.time > readAt).length;

export const newestFirst = (reports: Report[]): Report[] =>
  reports.slice().sort((a, b) => b.time - a.time);

/** The values of the admin form, keyed like the universe settings. */
export const settingsFrom = (
  keys: string[],
  read: (key: string) => string,
): Record<string, string> => Object.fromEntries(keys.map((k) => [k, read(k)]));
