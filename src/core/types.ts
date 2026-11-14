// Shared data shapes of the game. The server and the browser use the same rules.
import type { MISSIONS } from '../features/index.gen.ts';

export type Cost = readonly [number, number, number];
export type Levels = Record<string, number>;

export interface Resources {
  m: number;
  c: number;
  d: number;
}

export interface Requirements {
  b?: Levels;
  r?: Levels;
}

export interface Coords {
  g: number;
  s: number;
  p: number;
}

/** A place is coordinates plus a kind (O11, #119); its id is `placeId()`. */
export type Place = Coords & { kind: 'planet' | 'moon' | 'debris' };

export interface Queue {
  key: string;
  lvl: number;
  start: number;
  end: number;
  cost: Cost;
}

interface ShipyardItem {
  key: string;
  n: number;
  unit: number;
}

export interface Planet extends Coords {
  id: string;
  /** A moon is a row of the planets too (#53); debris has its own table. */
  kind: 'planet' | 'moon';
  owner: string;
  name: string;
  temp: number;
  /** Diameter in km; the fields follow from it (#51). */
  diameter: number;
  /** A planet from before the fields (#51): no field limit until a new round. */
  unlimited: boolean;
  res: Resources;
  b: Levels;
  ships: Levels;
  def: Levels;
  bq: Queue | null;
  sq: ShipyardItem[];
  sqT: number | null;
  pct: Levels;
  t: number;
  created: number;
}

/** The running research and the own planet where it started and was paid (#49). */
export interface ResearchQueue extends Queue {
  /** Missing for research started before #49: that was the home planet. */
  planet?: string;
}

export interface ResearchState {
  research: Levels;
  rq: ResearchQueue | null;
}

/**
 * The stored name of a mission: one folder src/features/missions/<m>/, read
 * from the generated index as a type only (owner, 2026-11-14, #116).
 */
export type Mission = (typeof MISSIONS)[number][0];
type FleetState = 'out' | 'back';

export interface Fleet {
  id: string;
  owner: string;
  from: string;
  fromC: Coords;
  to: string;
  toC: Coords;
  mission: Mission;
  ships: Levels;
  cargo: Resources;
  dep: number;
  arr: number;
  ret: number;
  state: FleetState;
  recalled: boolean;
  /** Fuel burnt at the start; a deploy unloads half of it at the target (#129). */
  fuel: number;
}

/** The settings of one universe. The admin changes them in the admin panel. */
export interface Universe {
  speed: number;
  galaxies: number;
  systems: number;
  positions: number;
  baseStore: number;
  maxReports: number;
  startMetal: number;
  startCrystal: number;
  startDeuterium: number;
  /** Fields added to every planet (#51). */
  extraFields: number;
}
