// The catalog of buildings, research, ships and defense. The numbers are the
// formulas of the classic game rules (rebuilt, no original code or art).
//
// Every entry lives in its own folder, src/features/<key>/entry.ts, and the
// core sees them only through the generated index (okf/architecture/
// patterns.md, sections 1 and 10; #114). An entry exports its `kind`, its
// `order` within the kind, its components and, until their own pull request,
// its other fields unchanged in `def`. This file builds the tables of the
// game from them, in the order of the game (owner, 2026-11-13).
//
// The names and texts are German, the interface of the game is German; they
// live in texts.ts, which is not mutation-tested, and each entry gets the
// texts of its key (owner, 2026-11-12, #131).
import { ENTRIES } from '../features/index.gen.ts';
import type { Consumes } from './components/consumes.ts';
import type { Leveled } from './components/leveled.ts';
import type { Produces } from './components/produces.ts';
import type { Storage } from './components/storage.ts';
import {
  BUILD_TEXT,
  DEF_TEXT,
  MISSION_TEXT,
  RES_TEXT,
  SHIP_TEXT,
} from './texts.ts';
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
  n: string;
  ab: string;
  f: number;
  ds: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
  req?: Requirements;
  energy?: EnergyNeed;
  /** Fields every level adds to its planet (Weltenschmiede, #51). */
  fields?: number;
}

export interface ResearchDef extends Leveled {
  n: string;
  ab: string;
  ds: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
  req: Requirements;
  energy?: EnergyNeed;
}

export type DriveKey = 'comb' | 'impulse' | 'hdrive';

interface UnitDefBase {
  n: string;
  ab: string;
  cost: Cost;
  atk: number;
  sh: number;
  req: Requirements;
  rf?: Record<string, number>;
  ds?: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
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

/** The display texts; they come from texts.ts by the key of the entry. */
type Texts = 'n' | 'ab' | 'ds' | 'lt';

/** The fields of a building besides its texts and its `leveled` component. */
export type BuildingFields = Omit<BuildingDef, Texts | keyof Leveled>;
/** The fields of a research besides its texts and its `leveled` component. */
export type ResearchFields = Omit<ResearchDef, Texts | keyof Leveled>;
/** The fields of a ship besides its texts. */
export type ShipFields = Omit<ShipDef, Texts>;
/** The fields of a defense besides its texts. */
export type DefenseFields = Omit<DefenseDef, Texts>;

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
  | (Producing & { kind: 'ship'; order: number; def: ShipFields })
  | (Idle & { kind: 'defense'; order: number; def: DefenseFields });

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

/** A table of the game: the texts of the key, then the values of the entry. */
const table = <T, K extends Entry['kind']>(
  kind: K,
  texts: Record<string, object>,
  values: (e: Extract<Entry, { kind: K }>) => object,
): Record<string, T> =>
  Object.fromEntries(
    ofKind(kind).map(([key, e]) => [key, { ...texts[key], ...values(e) } as T]),
  );

const levels = (e: { leveled: Leveled; def?: object }): object => ({
  ...e.leveled,
  ...e.def,
});

export const BUILD = table<BuildingDef, 'building'>(
  'building',
  BUILD_TEXT,
  levels,
);
export const RES = table<ResearchDef, 'research'>('research', RES_TEXT, levels);
export const SHIPS = table<ShipDef, 'ship'>('ship', SHIP_TEXT, (e) => e.def);
export const DEF = table<DefenseDef, 'defense'>(
  'defense',
  DEF_TEXT,
  (e) => e.def,
);

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
