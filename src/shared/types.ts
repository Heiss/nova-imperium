// Shared data shapes of the game. The server and the browser use the same rules.

export type Cost = readonly [number, number, number];
export type Levels = Record<string, number>;
export type ResKey = 'm' | 'c' | 'd';

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

export interface Queue {
  key: string;
  lvl: number;
  start: number;
  end: number;
  cost: Cost;
}

export interface ShipyardItem {
  key: string;
  n: number;
  unit: number;
}

export interface Planet extends Coords {
  id: string;
  owner: string;
  name: string;
  temp: number;
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

export interface ResearchState {
  research: Levels;
  rq: Queue | null;
}

export type Mission = 'attack' | 'transport' | 'spy' | 'colonize';
export type FleetState = 'out' | 'back';

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
}
