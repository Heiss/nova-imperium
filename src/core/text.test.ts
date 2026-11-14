// The display texts of the catalog entries live apart from the rules, one
// src/features/<key>/texts.de.ts per entry (owner, 2026-11-13, #113): every
// entry has a name, an abbreviation and a short text, every text file
// belongs to an entry, and `text(key)` gives exactly the texts of its key.
import { describe, expect, it } from 'vitest';
import { ENTRIES, TEXTS } from '../features/index.gen.ts';
import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import { text } from './text.ts';

const KEYS = [BUILD, RES, SHIPS, DEF].flatMap((defs) => Object.keys(defs));
const DISPLAY = ['n', 'ab', 'ds', 'lt', 'plural', 'per'];

describe('display texts of the catalog (#113)', () => {
  it('has one text file per entry and none without an entry', () => {
    expect(KEYS).toHaveLength(49);
    expect(TEXTS.map(([k]) => k)).toEqual(ENTRIES.map(([k]) => k));
    expect(TEXTS.map(([k]) => k).sort()).toEqual([...KEYS].sort());
  });

  it.each(KEYS)('%s: has a name, an abbreviation and a short text', (key) => {
    const t = text(key)!;
    expect(t.n, key).toMatch(/\S/);
    expect(t.ab, key).toMatch(/\S/);
    expect(t.ds, key).toMatch(/\S/);
    expect(
      Object.keys(t).every((f) => DISPLAY.includes(f)),
      key,
    ).toBe(true);
  });

  it('keeps every abbreviation unique', () => {
    const abs = KEYS.map((k) => text(k)!.ab);
    expect(new Set(abs).size).toBe(abs.length);
  });

  it('gives exactly the texts of the file of the key', () => {
    for (const [key, file] of TEXTS) expect(text(key)).toBe(file.texts);
    expect(text('metal')).toEqual({
      n: 'Adamant-Tiefbohrung',
      ab: 'AT',
      ds: 'Fördert Adamant, den wichtigsten Grundrohstoff.',
      lt: expect.stringMatching(/^Bohrtürme reißen Adamant/),
    });
    expect(text('gauss')!.n).toBe('Massebeschleuniger');
  });

  it('has nothing for a key that is no entry', () => {
    for (const key of ['', 'attack', 'toString', '__proto__', 'METAL'])
      expect(text(key), key).toBeUndefined();
  });

  it('keeps the texts out of the rules', () => {
    for (const defs of [BUILD, RES, SHIPS, DEF])
      for (const [key, def] of Object.entries(defs))
        for (const field of DISPLAY) expect(def, key).not.toHaveProperty(field);
  });
});
