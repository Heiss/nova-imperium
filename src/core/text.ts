// The display texts of the catalog entries (owner, 2026-11-13, #113;
// okf/architecture/patterns.md, section 2): the name `n`, the abbreviation
// `ab`, the short text `ds` and the long explanation `lt` of every building,
// research, ship and defense live in src/features/<key>/texts.de.ts, apart
// from the rules. Server and browser read them only through `text(key)`.
//
// The name of each mission lives in src/features/missions/<m>/texts.de.ts
// (owner, 2026-11-14, #116) and is read through `missionText(m)`, apart from
// `text(key)`, because `spy` is both a research and a mission.
//
// The text files are not mutation-tested (stryker.config.json); these
// accessors are.
import { MISSION_TEXTS, TEXTS } from '../features/index.gen.ts';

/** The display texts of a catalog entry, German like the interface. */
export interface EntryText {
  /** The name. */
  n: string;
  /** The abbreviation, unique; shown where an entry has no icon. */
  ab: string;
  /** The short text: a short, cost-free one-liner. */
  ds: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
  /** The plural of the name, where the resources page counts pieces (#114). */
  plural?: string;
  /** What the energy of one piece is given per in the shipyard, „je …“ (#114). */
  per?: string;
}

/** The generated index: every text file, sorted by key. */
const INDEX: readonly (readonly [string, { texts: EntryText }])[] = TEXTS;

const BY_KEY: ReadonlyMap<string, EntryText> = new Map(
  INDEX.map(([key, file]) => [key, file.texts]),
);

/** The texts of a catalog entry; undefined for a key that is no entry. */
export const text = (key: string): EntryText | undefined => BY_KEY.get(key);

/** The display text of a mission, German like the interface (#116). */
export interface MissionText {
  /** The name, shown in the fleet form, the fleet list and the galaxy. */
  n: string;
}

/** The generated index: every mission text file, sorted by mission. */
const MISSION_INDEX: readonly (readonly [string, { texts: MissionText }])[] =
  MISSION_TEXTS;

const BY_MISSION: ReadonlyMap<string, MissionText> = new Map(
  MISSION_INDEX.map(([m, file]) => [m, file.texts]),
);

/** The text of a mission; undefined for a name that is no mission. */
export const missionText = (m: string): MissionText | undefined =>
  BY_MISSION.get(m);
