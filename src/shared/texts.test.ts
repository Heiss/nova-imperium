// The display texts live apart from the game values (#131): every catalog
// entry has its texts, every text belongs to a catalog entry, and each entry
// carries exactly the texts of its own key.
import { describe, expect, it } from 'vitest';
import { BUILD, DEF, MISSION, RES, SHIPS } from './catalog.ts';
import {
  BUILD_TEXT,
  DEF_TEXT,
  MISSION_TEXT,
  RES_TEXT,
  SHIP_TEXT,
} from './texts.ts';

const DISPLAY = ['n', 'ab', 'ds', 'lt'];

const TABLES = [
  ['BUILD', BUILD, BUILD_TEXT],
  ['RES', RES, RES_TEXT],
  ['SHIPS', SHIPS, SHIP_TEXT],
  ['DEF', DEF, DEF_TEXT],
] as const;

/** The display fields of an entry, as they are in the catalog. */
const shown = (def: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(def).filter(([field]) => DISPLAY.includes(field)),
  );

describe('display texts', () => {
  it.each(TABLES)(
    '%s: the same keys as the catalog, in the same order',
    (_, defs, texts) => {
      expect(Object.keys(texts)).toEqual(Object.keys(defs));
    },
  );

  it.each(TABLES)(
    '%s: every entry shows exactly the texts of its key',
    (_, defs, texts) => {
      for (const [key, def] of Object.entries(defs)) {
        const text = (texts as Record<string, object>)[key];
        expect(shown(def), key).toEqual(text);
        expect(Object.keys(text!).every((f) => DISPLAY.includes(f))).toBe(true);
        expect(def.n, key).toMatch(/\S/);
        expect(def.ab, key).toMatch(/\S/);
      }
    },
  );

  it('names every mission and nothing else', () => {
    expect(MISSION).toEqual(MISSION_TEXT);
    expect(Object.keys(MISSION)).toEqual([
      'attack',
      'transport',
      'spy',
      'colonize',
      'deploy',
    ]);
  });
});
