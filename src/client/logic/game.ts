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
import {
  type CargoIntent,
  fillEvenly,
  fillOne,
  loadableStock,
  resolveCargo,
} from '../../core/cargo-fill.ts';
import { hoursPerLevel, stayDuration } from '../../core/expedition.ts';
import { HOUR_MS, dueAt } from '../../core/holding.ts';
import { missionRules } from '../../core/missions.ts';
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
    .sort((a, b) => (b[1].points ?? 0) - (a[1].points ?? 0))
    .forEach(([id], i) => (out[id] = i + 1));
  return out;
}

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
  /** What the „alles“ buttons asked for (#407); the server computes those fields again. */
  cargoAll?: CargoIntent;
  /** The holding time of a Halten in hours (#55); only a Halten reads it. */
  hold?: number;
  /** The hours an expedition stays at its position (#93); only a mission that stays reads it, an hour when missing. */
  stay?: number;
  /** The attack union the fleet joins (#225); only a Sturmangriff reads it. */
  union?: string;
}

/** Whether the mission stays at its target for hours the player chooses (#93): an expedition, not a Halten (`holds`). */
export const staysAt = (mission: string): boolean =>
  missionRules(mission)?.maxStay !== undefined;

/** The stay in milliseconds the form asks for: its hours for a mission that stays, else none; the universe speed divides it when the round says so. */
export const stayMs = (
  f: Pick<FleetForm, 'mission' | 'stay'>,
  u: Universe,
): number => (staysAt(f.mission) ? stayDuration(f.stay ?? 1, u) : 0);

/** The most hours of the stay, from the research and the hours per level of the round; none for a mission that does not stay. */
export const maxStay = (
  mission: string,
  research: Levels,
  u: Universe,
): number => missionRules(mission)?.maxStay?.(research, hoursPerLevel(u)) ?? 0;

export interface FleetPreview {
  dist: number;
  /** One way, in milliseconds. */
  ms: number;
  /** How long a Halten holds, in milliseconds (#55); 0 for the others. */
  hold: number;
  /** The stay of an expedition at the target in milliseconds, 0 for a mission that does not stay (#93). */
  stay: number;
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
 * (#55), an expedition arrives when its stay ends and flies home from there
 * (#93).
 */
export const arrivalLine = (
  mission: string,
  now: number,
  pv: Pick<FleetPreview, 'ms' | 'hold'> & Partial<Pick<FleetPreview, 'stay'>>,
): string => {
  // An expedition arrives when its stay ends (#93), a Halten at its target.
  const stay = pv.stay ?? 0;
  return `${dt(now + pv.ms + stay)} / ${missionRules(mission)?.returns === false ? '–' : dt(now + 2 * pv.ms + pv.hold + stay)}`;
};

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
    stay: stayMs(f, u),
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
  return loadableStock(p.res, formFuel(f, distance(p, f.to)));
}

/** „alles“ (#240): fills the holds evenly with the three resources (core/cargo-fill.ts). */
export const cargoMax = (p: Planet, f: FleetForm): Resources =>
  fillEvenly(loadable(p, f), capacity(f.ships));

/**
 * The cargo the server will load for the form (#407): the fields of the
 * „alles“ buttons computed again by the rule of the server, the others as
 * typed; the preview of the fields.
 */
export const cargoPreview = (p: Planet, f: FleetForm): Resources =>
  resolveCargo(loadable(p, f), capacity(f.ships), f.cargo, f.cargoAll ?? null);

/**
 * „alles“ under a field (#240): only that resource, up to the room the other
 * two fields leave; they stay as they are (core/cargo-fill.ts).
 */
export const cargoOne = (p: Planet, f: FleetForm, key: CargoKey): number =>
  fillOne(loadable(p, f), capacity(f.ships), f.cargo, key);

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
