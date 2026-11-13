// The catalog of buildings, research, ships and defense. The numbers are the
// formulas of the classic game rules (rebuilt, no original code or art).
//
// Every entry lives in its own folder, src/features/<key>/entry.ts, and the
// core sees them only through the generated index (okf/architecture/
// patterns.md, sections 1 and 10; #114). An entry exports its `kind`, its
// `order` within the kind, its components and, until their own pull request,
// its other fields unchanged in `def`. Ships and defense have the components
// `unit` and `combat` since the second pull request of #114. This file
// builds the tables of the game from them, in the order of the game (owner,
// 2026-11-13).
//
// The display texts are not here: each entry has them in its own
// src/features/<key>/texts.de.ts, read through `text(key)` of text.ts
// (owner, 2026-11-13, #113). The mission names are in texts.ts (#131).
import { ENTRIES } from '../features/index.gen.ts';
import type { Combat, Fighter } from './components/combat.ts';
import type { Consumes } from './components/consumes.ts';
import type { Leveled } from './components/leveled.ts';
import type { Produces } from './components/produces.ts';
import type { Storage } from './components/storage.ts';
import type { Unit } from './components/unit.ts';
import { MISSION_TEXT } from './texts.ts';
import type { Cost, Requirements } from './types.ts';

/**
 * Energy production a research needs on the planet where it starts, or a
 * building on its planet: `base` at level 1, times `f` per further level. It
 * is checked, not consumed (#49, #51).
 */
interface EnergyNeed {
  base: number;
  f: number;
}

export interface BuildingDef extends Leveled {
  f: number;
  req?: Requirements;
  energy?: EnergyNeed;
  /** Fields every level adds to its planet (Weltenschmiede, #51). */
  fields?: number;
}

export interface ResearchDef extends Leveled {
  req: Requirements;
  energy?: EnergyNeed;
}

export type DriveKey = 'comb' | 'impulse' | 'hdrive';

interface UnitDefBase {
  cost: Cost;
  atk: number;
  sh: number;
  req: Requirements;
  rf?: Record<string, number>;
}

/**
 * A drive a ship switches to once the player has researched `from` (issue
 * #57): it replaces the base `drive` and `speed` of the ship.
 */
interface DriveSwitch {
  drive: DriveKey;
  speed: number;
  from: { research: string; level: number };
}

export interface ShipDef extends UnitDefBase {
  cargo: number;
  /** Base speed with the base `drive`. */
  speed: number;
  fuel: number;
  drive: DriveKey;
  /** Later drives; the last one whose research is reached flies the ship. */
  drives?: DriveSwitch[];
}

export interface DefenseDef extends UnitDefBase {
  /** At most one per planet, the shield domes (#50, D3). */
  once?: true;
}
export type UnitDef = ShipDef | DefenseDef;

/** The fields of a building besides its `leveled` component. */
export type BuildingFields = Omit<BuildingDef, keyof Leveled>;
/** The fields of a research besides its `leveled` component. */
export type ResearchFields = Omit<ResearchDef, keyof Leveled>;
/** The fields of a ship besides its `unit` and `combat` components. */
export type ShipFields = Omit<ShipDef, keyof Unit | keyof Combat>;
/** The fields of a defense besides its `unit` and `combat` components. */
export type DefenseFields = Omit<DefenseDef, keyof Unit | keyof Combat>;

/** The production components; every entry that consumes also produces. */
interface Producing {
  produces?: Produces;
  consumes?: Consumes;
}
/** Research and defense neither produce nor consume. */
type Idle = { [K in keyof Producing]?: never };

/** What src/features/<key>/entry.ts exports, by its kind. */
type Entry =
  | (Producing & {
      kind: 'building';
      order: number;
      leveled: Required<Leveled>;
      storage?: Storage;
      def?: BuildingFields;
    })
  | (Idle & {
      kind: 'research';
      order: number;
      leveled: Leveled;
      def: ResearchFields;
    })
  | (Producing & {
      kind: 'ship';
      order: number;
      unit: Unit;
      combat: Combat;
      def: ShipFields;
    })
  | (Idle & {
      kind: 'defense';
      order: number;
      unit: Unit;
      combat: Combat;
      def: DefenseFields;
    });

/** The generated index: every entry folder, sorted by key. */
const INDEX: readonly (readonly [string, Entry])[] = ENTRIES;

/** All entries by their order. */
const ALL = [...INDEX].sort(([, a], [, b]) => a.order - b.order);

/** The entries of one kind, in the order of the game. */
const ofKind = <K extends Entry['kind']>(
  kind: K,
): (readonly [string, Extract<Entry, { kind: K }>])[] =>
  ALL.filter(
    (e): e is readonly [string, Extract<Entry, { kind: K }>] =>
      e[1].kind === kind,
  );

/** A table of the game: a copy of the values of each entry of a kind. */
const table = <T, K extends Entry['kind']>(
  kind: K,
  values: (e: Extract<Entry, { kind: K }>) => object,
): Record<string, T> =>
  Object.fromEntries(
    ofKind(kind).map(([key, e]) => [key, { ...values(e) } as T]),
  );

const levels = (e: { leveled: Leveled; def?: object }): object => ({
  ...e.leveled,
  ...e.def,
});

/**
 * The fields of a ship or defense as the tables had them before the
 * components; `easy` is no field of the tables.
 */
const pieces = (e: { unit: Unit; combat: Combat; def: object }): object => {
  const { atk, sh, rf } = e.combat;
  return { ...e.unit, atk, sh, ...(rf && { rf }), ...e.def };
};

export const BUILD = table<BuildingDef, 'building'>('building', levels);
export const RES = table<ResearchDef, 'research'>('research', levels);
export const SHIPS = table<ShipDef, 'ship'>('ship', pieces);
export const DEF = table<DefenseDef, 'defense'>('defense', pieces);

export const UNIT: Record<string, UnitDef> = { ...SHIPS, ...DEF };

export const DRIVE_BONUS: Record<DriveKey, number> = {
  comb: 0.1,
  impulse: 0.2,
  hdrive: 0.3,
};

export const MISSION = {
  attack: MISSION_TEXT.attack,
  transport: MISSION_TEXT.transport,
  spy: MISSION_TEXT.spy,
  colonize: MISSION_TEXT.colonize,
  deploy: MISSION_TEXT.deploy,
} as const;

/** The entries with production components, in the production order (#114). */
export const PRODUCTION = ALL.flatMap(([key, e]) =>
  e.produces
    ? [{ key, kind: e.kind, produces: e.produces, consumes: e.consumes }]
    : [],
).sort((a, b) => a.produces.order - b.produces.order);

/** The entries with the components `unit` and `combat` (ships, defense), by key. */
export const FIGHTERS: Readonly<Record<string, Fighter>> = Object.fromEntries(
  ALL.flatMap(([key, e]) =>
    e.kind === 'ship' || e.kind === 'defense'
      ? [[key, { kind: e.kind, unit: e.unit, combat: e.combat }] as const]
      : [],
  ),
);

/** The entries with a `storage` component. */
export const STORAGE = ofKind('building').flatMap(([key, e]) =>
  e.storage ? [{ key, storage: e.storage }] : [],
);

/** Producers whose share the player sets on the resources page, in the production order. */
export const PRODUCERS: readonly string[] = PRODUCTION.map((e) => e.key);

export const isShip = (key: string): boolean => Object.hasOwn(SHIPS, key);
export const isDefense = (key: string): boolean => Object.hasOwn(DEF, key);

/** Ships that can be sent; the Solarsatellit (speed 0) stays at its planet. */
export const canFly = (key: string): boolean =>
  isShip(key) && SHIPS[key]!.speed > 0;
