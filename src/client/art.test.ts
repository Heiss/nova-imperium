// The art was moved to TypeScript unchanged: every picture equals version 1.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { BUILD, RES, UNIT } from '../shared/catalog.ts';
import { ART_KEYS, artURI } from './art.ts';

const require = createRequire(import.meta.url);
const legacy = require('../test/legacy/art.cjs') as {
  artURI: (k: string) => string | null;
  keys: string[];
};

describe('art', () => {
  it('has one picture for every building, research, ship and defense', () => {
    expect(ART_KEYS.sort()).toEqual(
      [...Object.keys(BUILD), ...Object.keys(RES), ...Object.keys(UNIT)].sort(),
    );
  });
  it('is the same as in version 1', () => {
    expect(ART_KEYS.sort()).toEqual(legacy.keys.slice().sort());
    for (const k of ART_KEYS) expect(artURI(k)).toBe(legacy.artURI(k));
    expect(artURI('nope')).toBeNull();
  });
});
