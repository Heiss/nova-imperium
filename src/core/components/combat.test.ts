// Contract of the component `combat` (okf/architecture/patterns.md, section
// 12; #114): it runs for every entry that has it, so a new ship or defense
// is checked without new test code.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import {
  type Combat,
  EASY_RAPID_FIRE,
  type Fighter,
  rapidFire,
  strength,
} from './combat.ts';
import type { Unit } from './unit.ts';

const FIGHTERS = ENTRIES.flatMap(([key, e]) =>
  'combat' in e
    ? [
        [
          key,
          {
            kind: e.kind,
            unit: e.unit as Unit,
            combat: e.combat as Combat,
          } as Fighter,
        ] as const,
      ]
    : [],
);
const KEYS = new Set<string>(FIGHTERS.map(([key]) => key));

describe('combat: contract for every entry that has it', () => {
  it('is on every ship and every defense, each with a unit', () => {
    expect(FIGHTERS.length).toBe(
      ENTRIES.filter(([, e]) => e.kind === 'ship' || e.kind === 'defense')
        .length,
    );
    for (const [key, e] of ENTRIES)
      expect('unit' in e, key).toBe('combat' in e);
  });

  it.each(FIGHTERS)(
    '%s: hull, shield and attack are finite and above 0',
    (_, f) => {
      for (const x of Object.values(strength(f))) {
        expect(Number.isFinite(x)).toBe(true);
        expect(x).toBeGreaterThan(0);
      }
    },
  );

  it.each(FIGHTERS)(
    '%s: rapid fire is a whole number above 1 against an entry that fights',
    (_, f) => {
      for (const [target, r] of Object.entries(f.combat.rf ?? {})) {
        expect(KEYS.has(target), target).toBe(true);
        expect(Number.isInteger(r)).toBe(true);
        expect(r).toBeGreaterThan(1);
      }
    },
  );

  it('marks only ships as easy targets', () => {
    for (const [key, f] of FIGHTERS)
      if (f.combat.easy) expect(f.kind, key).toBe('ship');
  });
});

describe('combat: the rule', () => {
  const fighter = (
    kind: Fighter['kind'],
    combat: Partial<Combat> = {},
  ): Fighter => ({
    kind,
    unit: { cost: [3000, 1000, 500] },
    combat: { atk: 50, sh: 10, ...combat },
  });

  it('derives the hull from Adamant and Psikristall, (M + K) / 10', () => {
    expect(strength(fighter('ship'))).toEqual({
      hull: 400,
      shield: 10,
      attack: 50,
    });
    expect(
      strength({ ...fighter('defense'), unit: { cost: [0, 7, 99] } }).hull,
    ).toBe(0.7);
  });

  it('takes the rapid fire the attacker names, also against an easy target', () => {
    const a = fighter('ship', { rf: { x: 3, easy: 1250 } });
    expect(rapidFire(a, 'x', fighter('ship'))).toBe(3);
    expect(rapidFire(a, 'easy', fighter('ship', { easy: true }))).toBe(1250);
    const d = fighter('defense', { rf: { x: 4 } });
    expect(rapidFire(d, 'x', undefined)).toBe(4);
  });

  it('gives a ship that is not easy itself 5 against an easy target', () => {
    const easy = fighter('ship', { easy: true });
    expect(EASY_RAPID_FIRE).toBe(5);
    expect(rapidFire(fighter('ship'), 'e', easy)).toBe(5);
    expect(rapidFire(fighter('ship', { rf: { y: 2 } }), 'e', easy)).toBe(5);
    expect(rapidFire(easy, 'e', easy)).toBe(1);
    expect(rapidFire(fighter('defense'), 'e', easy)).toBe(1);
  });

  it('has none otherwise', () => {
    expect(rapidFire(fighter('ship'), 'x', fighter('ship'))).toBe(1);
    expect(rapidFire(fighter('ship'), 'x', fighter('defense'))).toBe(1);
    expect(rapidFire(fighter('ship'), 'x', undefined)).toBe(1);
    expect(rapidFire(undefined, 'x', fighter('ship', { easy: true }))).toBe(1);
  });
});
