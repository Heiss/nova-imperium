// Logic of the interface that is not HTML: ranks, protection, what a button
// shows, the preview of a flight, the cargo button, galaxy navigation.
import {
  capacity,
  countUnits,
  distance,
  fleetSpeed,
  flightMs,
  fuelFor,
} from '../../shared/flight.ts';
import { labUpgrading, waitsForLab } from '../../shared/lab.ts';
import { isProtected as protects } from '../../shared/protection.ts';
import { waitsForYard } from '../../shared/yard.ts';
import type {
  Coords,
  Levels,
  Planet,
  ResearchState,
  Resources,
  Universe,
} from '../../shared/types.ts';
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

export const fleetEnd = (f: ClientFleet): number =>
  f.state === 'out' ? f.arr : (f.ret ?? f.arr);

export const sortFleets = (list: ClientFleet[]): ClientFleet[] =>
  list.slice().sort((a, b) => fleetEnd(a) - fleetEnd(b));

export type BuildState =
  'running' | 'missing' | 'queueBusy' | 'yardBusy' | 'labBusy' | 'ready';

export function buildState(
  p: Planet,
  r: ResearchState,
  key: string,
  missing: number,
): BuildState {
  if (p.bq?.key === key) return 'running';
  if (missing) return 'missing';
  if (p.bq) return 'queueBusy';
  if (waitsForYard(p, key)) return 'yardBusy';
  if (waitsForLab(r, key)) return 'labBusy';
  return 'ready';
}

export type ResearchUiState =
  'running' | 'missing' | 'busy' | 'labBusy' | 'ready';

export function researchState(
  p: Planet,
  r: ResearchState,
  key: string,
  missing: number,
): ResearchUiState {
  if (r.rq?.key === key) return 'running';
  if (missing) return 'missing';
  if (r.rq) return 'busy';
  if (labUpgrading(p)) return 'labBusy';
  return 'ready';
}

export interface FleetForm {
  ships: Levels;
  to: Coords;
  mission: string;
  pct: number;
  cargo: Resources;
}

export interface FleetPreview {
  dist: number;
  ms: number;
  fuel: number;
  cap: number;
  load: number;
  fuelShort: boolean;
  overload: boolean;
}

export function fleetPreview(
  p: Planet,
  r: ResearchState,
  f: FleetForm,
  u: Universe,
): FleetPreview | null {
  if (!countUnits(f.ships)) return null;
  const dist = distance(p, f.to);
  const fuel = fuelFor(f.ships, dist, f.pct);
  const cap = capacity(f.ships);
  const load = f.cargo.m + f.cargo.c + f.cargo.d;
  return {
    dist,
    ms: flightMs(dist, fleetSpeed(f.ships, r), f.pct, u),
    fuel,
    cap,
    load,
    fuelShort: fuel + f.cargo.d > p.res.d,
    overload: load > cap,
  };
}

/** Fills the holds: metal first, then crystal, then deuterium minus fuel. */
export function cargoMax(p: Planet, f: FleetForm): Resources {
  const fuel = countUnits(f.ships)
    ? fuelFor(f.ships, distance(p, f.to), f.pct)
    : 0;
  let cap = capacity(f.ships);
  const m = Math.min(Math.floor(p.res.m), cap);
  cap -= m;
  const c = Math.min(Math.floor(p.res.c), cap);
  cap -= c;
  const d = Math.max(0, Math.min(Math.floor(p.res.d - fuel), cap));
  return { m, c, d };
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
