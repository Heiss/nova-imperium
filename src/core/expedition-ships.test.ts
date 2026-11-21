// The expedition points of a fleet and the find of ships (#93, owiki
// „Expeditionspunkte“, „Auffindbare Schiffe“ and „Größe von Flottenfunden“),
// with exact values and the edges of every threshold.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { seeded } from '../test/fixtures.ts';
import { SHIPS } from './catalog.ts';
import type { Size } from './expedition.ts';
import { expoPoints, findable, shipFind } from './expedition-ships.ts';

/** A generator that gives the numbers in turn and then fails: every draw is accounted for. */
function queue(...values: number[]): () => number {
  const rest = [...values];
  return () => {
    if (!rest.length) throw new Error('more draws than expected');
    return rest.shift()!;
  };
}

const TOP = 0.9999999999;

describe('expedition points (owiki: structure points · 5 / 1000)', () => {
  it('are those of the table of the owiki for every ship', () => {
    const table: Record<string, number> = {
      recycler: 80,
      colony: 150,
      dstar: 45_000,
      probe: 5,
      sc: 20,
      lf: 20,
      lc: 60,
      hf: 50,
      cr: 135,
      bs: 300,
      bc: 350,
      bb: 375,
      dr: 550,
    };
    for (const [key, points] of Object.entries(table))
      expect(expoPoints({ [key]: 1 }), key).toBe(points);
  });

  it('add up over the types and the counts', () => {
    expect(expoPoints({ lc: 100 })).toBe(6000);
    expect(expoPoints({ lc: 100, probe: 2, sc: 3 })).toBe(6000 + 10 + 60);
    expect(expoPoints({})).toBe(0);
  });

  it('count nothing for no ship, an unknown key, an inherited name or a count of 0 or less', () => {
    expect(expoPoints({ nope: 5, constructor: 3, toString: 2 })).toBe(0);
    expect(expoPoints({ rl: 10 })).toBe(0);
    expect(expoPoints({ lc: 0, sc: -4 })).toBe(0);
    expect(expoPoints({ lc: 0, sc: 1 })).toBe(20);
  });
});

describe('the ships a fleet can find (owiki „Auffindbare Schiffe“)', () => {
  const find = (fleet: Record<string, number>) => findable(fleet);

  it('finds its own kind and one step heavier', () => {
    expect(find({ probe: 1 })).toEqual(['probe', 'sc']);
    expect(find({ sc: 1 })).toEqual(['probe', 'sc', 'lf']);
    expect(find({ lf: 1 })).toEqual(['probe', 'sc', 'lf', 'lc']);
    expect(find({ lc: 5 })).toEqual(['probe', 'sc', 'lf', 'lc', 'hf']);
    expect(find({ hf: 1 })).toEqual(['probe', 'sc', 'lf', 'lc', 'hf', 'cr']);
    expect(find({ cr: 1 })).toHaveLength(7);
    expect(find({ bs: 1 })).toHaveLength(8);
    expect(find({ bc: 1 })).toHaveLength(9);
  });

  it('finds everything from the Belagerungsbomber on, and never more than the ten', () => {
    const all = ['probe', 'sc', 'lf', 'lc', 'hf', 'cr', 'bs', 'bc', 'bb', 'dr'];
    expect(find({ bb: 1 })).toEqual(all);
    expect(find({ dr: 1 })).toEqual(all);
  });

  it('is set by the heaviest ship, whatever else flies along', () => {
    expect(find({ lf: 2, hf: 1 })).toEqual([
      'probe',
      'sc',
      'lf',
      'lc',
      'hf',
      'cr',
    ]);
    expect(find({ hf: 1, sc: 9 })).toHaveLength(6);
  });

  it('finds nothing with the Kolonistenarche, the Bergungsbarke and the Weltenbrecher alone', () => {
    expect(find({ colony: 1, recycler: 2, dstar: 3 })).toEqual([]);
    expect(find({})).toEqual([]);
    expect(find({ probe: 0 })).toEqual([]);
    expect(find({ sc: -1 })).toEqual([]);
    expect(find({ nope: 4, rl: 4 })).toEqual([]);
  });

  it('finds with a Spähschädel next to them what the probe finds', () => {
    expect(find({ colony: 1, dstar: 1, probe: 1 })).toEqual(['probe', 'sc']);
  });

  it('never lists a ship that is no ship of the game', () => {
    for (const key of find({ dr: 1 })) expect(SHIPS, key).toHaveProperty(key);
  });
});

describe('a find of ships (owiki „Flottenfund“)', () => {
  it('finds nothing and draws nothing for a fleet that finds nothing', () => {
    expect(shipFind(queue(), 'normal', { colony: 3 }, 450, 0)).toEqual({});
    expect(shipFind(queue(), 'huge', {}, 0, 0)).toEqual({});
  });

  it('uses the structure points of the find up to the last ship that fits', () => {
    // A normal find: base 10 (0), times 600 points = 6,000, raised to 10,000.
    // Draws: base, then ship (0.5 · 5 = lf, 4,000) and number (1 to 2: 2), then
    // ship (probe, 1,000) and number (1 to 2: 2).
    expect(
      shipFind(queue(0, 0.5, 0.99, 0, 0.99), 'normal', { lc: 10 }, 600, 0),
    ).toEqual({ lf: 2, probe: 2 });
  });

  it('stops at the first drawn ship that is heavier than what is left', () => {
    // 10,000 − 2 · 4,000 = 2,000; the next draw is the Sturmjäger (10,000).
    expect(
      shipFind(queue(0, 0.5, 0.99, 0.99), 'normal', { lc: 10 }, 600, 0),
    ).toEqual({ lf: 2 });
  });

  it('adds up a ship that is drawn twice', () => {
    // 10,000: probe 4 (0.4 · 10 → 4), then probe again 6.
    expect(
      shipFind(queue(0, 0, 0.3, 0, 0.99), 'normal', { probe: 1 }, 5, 0),
    ).toEqual({ probe: 4 + 6 });
  });

  it('is at least 10,000 structure points, however small the fleet', () => {
    // 10 · 5 points = 50 would find nothing; the floor lets the probe be found 10 times.
    expect(shipFind(queue(0, 0, 0.99), 'normal', { probe: 1 }, 5, 0)).toEqual({
      probe: 10,
    });
    // A fleet just above the floor: 10 · 1,001 = 10,010 allows 10 probes and no more.
    expect(
      shipFind(queue(0, 0, 0.99, 0), 'normal', { probe: 1 }, 1001, 0),
    ).toEqual({ probe: 10 });
  });

  it('takes the base number by the size and the points up to the cap of rank 1', () => {
    // The lightest ship, the highest number, then a Vernichter that no longer
    // fits: a probe is 1,000 structure points, so the find has that many probes.
    const probes = (size: Size, a: number, rank1 = 0) =>
      shipFind(queue(a, 0, TOP, 0.99), size, { dr: 1 }, 1e9, rank1).probe;
    // normal: any number 10 to 50; large: even 52 to 100; huge: even 102 to 200,
    // times the points, at most 1,250 below 100,000 points of rank 1.
    expect(probes('normal', 0)).toBe(12);
    expect(probes('normal', 0.5)).toBe(37);
    expect(probes('normal', TOP)).toBe(62);
    expect(probes('large', 0)).toBe(65);
    expect(probes('large', TOP)).toBe(125);
    expect(probes('huge', 0)).toBe(127);
    expect(probes('huge', TOP)).toBe(250);
    // The caps by rank 1: 1,250, 3,000, 4,500, 6,000.
    expect(probes('normal', TOP, 99_999)).toBe(62);
    expect(probes('normal', TOP, 100_000)).toBe(150);
    expect(probes('normal', TOP, 1_000_001)).toBe(225);
    expect(probes('normal', TOP, 5_000_001)).toBe(300);
  });

  it('takes the points of the fleet when they are below the cap', () => {
    // The Vernichter is 550 points: 50 · 550 = 27,500 structure points.
    expect(
      shipFind(queue(TOP, 0.1, TOP, 0, TOP, 0.99), 'normal', { dr: 1 }, 550, 0),
    ).toEqual({ sc: 6, probe: 3 });
  });

  it('draws the ship equally among the findable ones', () => {
    const seen: Record<string, number> = {};
    const rng = seeded(5);
    const runs = 2000;
    for (let i = 0; i < runs; i++)
      for (const key of Object.keys(shipFind(rng, 'normal', { hf: 1 }, 50, 0)))
        seen[key] = (seen[key] ?? 0) + 1;
    // Six ships can be found, but the Lastbarke (12,000) and the Fregatte
    // (27,000) are heavier than the 10,000 structure points of this find.
    expect(Object.keys(seen).sort()).toEqual(['hf', 'lf', 'probe', 'sc']);
    for (const n of Object.values(seen)) expect(n).toBeGreaterThan(runs / 6);
  });

  it('never finds more structure points than the find allows, nor a ship it cannot find (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e6 }),
        fc.constantFrom<Size>('normal', 'large', 'huge'),
        fc.dictionary(
          fc.constantFrom(...Object.keys(SHIPS)),
          fc.integer({ min: 0, max: 500 }),
        ),
        fc.constantFrom(0, 100_000, 1_000_001, 5_000_001),
        (seed, size, fleet, rank1) => {
          const found = shipFind(
            seeded(seed),
            size,
            fleet,
            expoPoints(fleet),
            rank1,
          );
          const allowed = findable(fleet);
          let sp = 0;
          for (const [key, n] of Object.entries(found)) {
            expect(allowed).toContain(key);
            expect(n).toBeGreaterThan(0);
            sp += n * (SHIPS[key]!.cost[0] + SHIPS[key]!.cost[1]);
          }
          // At most 200 · the cap of the tier, 1,200,000 at the most.
          expect(sp).toBeLessThanOrEqual(1_200_000);
        },
      ),
    );
  });
});
