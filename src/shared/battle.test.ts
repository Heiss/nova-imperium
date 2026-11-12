import { describe, expect, it } from 'vitest';
import { seeded, sequence } from '../test/fixtures.ts';
import { battle, buildSide, count, hit, rapid } from './battle.ts';

const unit = (over = {}) => ({
  key: 'lf',
  hull: 400,
  maxHull: 400,
  shield: 10,
  maxShield: 10,
  attack: 50,
  ...over,
});

describe('battle', () => {
  it('builds units with the technology bonus', () => {
    const side = buildSide({
      units: { lf: 2, nope: 4 },
      tech: { armor: 1, shield: 2, weapons: 3 },
    });
    expect(side).toHaveLength(2);
    expect(side[0]?.hull).toBeCloseTo(440, 9);
    expect(side[0]?.maxHull).toBeCloseTo(440, 9);
    expect(side[0]?.shield).toBeCloseTo(12, 9);
    expect(side[0]?.maxShield).toBeCloseTo(12, 9);
    expect(side[0]?.attack).toBeCloseTo(65, 9);
    expect(buildSide({ units: { lf: 1 }, tech: {} })[0]).toEqual(unit());
  });
  it('builds Schlachtkreuzer and Zerstörer with hull (M + K) / 10 (#58, #59)', () => {
    const [bc] = buildSide({ units: { bc: 1 }, tech: {} });
    expect(bc).toEqual({
      key: 'bc',
      hull: 7000,
      maxHull: 7000,
      shield: 400,
      maxShield: 400,
      attack: 700,
    });
    const [dr] = buildSide({
      units: { dr: 1 },
      tech: { armor: 2, shield: 1, weapons: 3 },
    });
    expect(dr?.maxHull).toBeCloseTo(13200, 9);
    expect(dr?.maxShield).toBeCloseTo(550, 9);
    expect(dr?.attack).toBeCloseTo(2600, 9);
  });
  it('knows the rapid fire of Schlachtkreuzer and Zerstörer (#58, #59)', () => {
    expect(rapid('bc', 'sc')).toBe(3);
    expect(rapid('bc', 'lc')).toBe(3);
    expect(rapid('bc', 'hf')).toBe(4);
    expect(rapid('bc', 'cr')).toBe(4);
    expect(rapid('bc', 'bs')).toBe(7);
    expect(rapid('bc', 'probe')).toBe(5);
    expect(rapid('bc', 'lf')).toBe(1);
    expect(rapid('bc', 'dr')).toBe(1);
    expect(rapid('dr', 'll')).toBe(10);
    expect(rapid('dr', 'bc')).toBe(2);
    expect(rapid('dr', 'probe')).toBe(5);
    expect(rapid('dr', 'bs')).toBe(1);
    expect(rapid('dr', 'hl')).toBe(1);
    for (const a of ['lf', 'hf', 'cr', 'bs', 'bc', 'rl', 'll', 'hl', 'gauss'])
      expect(rapid(a, 'dr')).toBe(1);
    for (const a of ['lf', 'hf', 'cr', 'bs', 'rl', 'll', 'hl', 'gauss'])
      expect(rapid(a, 'bc')).toBe(1);
  });
  it('builds the Bomber with hull (M + K) / 10 (#57)', () => {
    const [bb] = buildSide({ units: { bb: 1 }, tech: {} });
    expect(bb).toEqual({
      key: 'bb',
      hull: 7500,
      maxHull: 7500,
      shield: 500,
      maxShield: 500,
      attack: 1000,
    });
    const [boosted] = buildSide({
      units: { bb: 1 },
      tech: { armor: 2, shield: 1, weapons: 3 },
    });
    expect(boosted?.maxHull).toBeCloseTo(9000, 9);
    expect(boosted?.maxShield).toBeCloseTo(550, 9);
    expect(boosted?.attack).toBeCloseTo(1300, 9);
  });
  it('knows the rapid fire of the Bomber (#57)', () => {
    expect(rapid('bb', 'rl')).toBe(20);
    expect(rapid('bb', 'll')).toBe(20);
    expect(rapid('bb', 'hl')).toBe(10);
    expect(rapid('bb', 'probe')).toBe(5);
    expect(rapid('bb', 'sat')).toBe(5);
    // None against the Gaußkanone (classic, before 2019).
    expect(rapid('bb', 'gauss')).toBe(1);
    for (const t of ['sc', 'lc', 'colony', 'lf', 'hf', 'cr', 'bs', 'bc', 'dr'])
      expect(rapid('bb', t)).toBe(1);
    for (const a of ['lf', 'hf', 'cr', 'bs', 'bc', 'dr', 'rl', 'll', 'hl'])
      expect(rapid(a, 'bb')).toBe(1);
    expect(rapid('gauss', 'bb')).toBe(1);
    expect(rapid('bb', 'bb')).toBe(1);
  });
  it('knows rapid fire', () => {
    expect(rapid('cr', 'lf')).toBe(6);
    expect(rapid('hf', 'sc')).toBe(3);
    expect(rapid('lf', 'probe')).toBe(5);
    expect(rapid('probe', 'probe')).toBe(1);
    expect(rapid('rl', 'probe')).toBe(1);
    expect(rapid('lf', 'sc')).toBe(1);
    // Solarsatellit (#46): 5 from every ship but the probe; it has none itself.
    expect(rapid('lf', 'sat')).toBe(5);
    expect(rapid('bs', 'sat')).toBe(5);
    expect(rapid('probe', 'sat')).toBe(1);
    expect(rapid('sat', 'sat')).toBe(1);
    expect(rapid('sat', 'probe')).toBe(1);
    expect(rapid('sat', 'lf')).toBe(1);
    expect(rapid('rl', 'sat')).toBe(1);
  });
  it('lets shields absorb small hits and ignores hits below 1 % of the shield', () => {
    const t = unit({ shield: 1000, maxShield: 1000 });
    hit(t, 9, () => 0);
    expect(t.shield).toBe(1000);
    hit(t, 10, () => 0);
    expect(t.shield).toBe(990);
    expect(t.hull).toBe(400);
  });
  it('damages the hull and lets badly damaged units explode by chance', () => {
    const t = unit();
    hit(t, 110, () => 0.99);
    expect(t.shield).toBe(0);
    expect(t.hull).toBe(300);
    // 210 of 400 left: explodes when the draw is above 0.525.
    const u = unit();
    hit(u, 200, () => 0.6);
    expect(u.hull).toBe(0);
    const v = unit();
    hit(v, 200, () => 0.5);
    expect(v.hull).toBe(210);
    const dead = unit({ hull: 0 });
    hit(dead, 1000, () => 0);
    expect(dead.hull).toBe(0);
  });
  it('does not explode at exactly 70 % hull', () => {
    const t = unit({ shield: 0 });
    hit(t, 120, () => 0.99);
    expect(t.hull).toBe(280);
  });
  it('counts survivors per type', () => {
    expect(count([unit(), unit(), unit({ key: 'rl' })])).toEqual({
      lf: 2,
      rl: 1,
    });
  });
  it('ends at once without defenders', () => {
    expect(
      battle({ units: { lf: 2 }, tech: {} }, { units: {}, tech: {} }),
    ).toEqual({
      winner: 'att',
      rounds: 0,
      att: { lf: 2 },
      def: {},
    });
    expect(
      battle({ units: {}, tech: {} }, { units: { rl: 1 }, tech: {} }).winner,
    ).toBe('def');
    expect(
      battle({ units: {}, tech: {} }, { units: {}, tech: {} }).winner,
    ).toBe('draw');
  });
  it('lasts at most 6 rounds and can end in a draw', () => {
    const r = battle(
      { units: { probe: 1 }, tech: {} },
      { units: { probe: 1 }, tech: {} },
      () => 0.99,
    );
    expect(r).toEqual({
      winner: 'draw',
      rounds: 6,
      att: { probe: 1 },
      def: { probe: 1 },
    });
  });
  it('lets a strong attacker win', () => {
    const r = battle(
      { units: { bs: 5 }, tech: {} },
      { units: { rl: 3 }, tech: {} },
      seeded(1),
    );
    expect(r.winner).toBe('att');
    expect(r.def).toEqual({});
    expect(r.att).toEqual({ bs: 5 });
    expect(r.rounds).toBe(1);
  });
  it('recharges shields every round and lets destroyed units fire in their round', () => {
    // A cruiser against a light fighter; both shoot, the fighter dies, then the cruiser is alone.
    const r = battle(
      { units: { cr: 1 }, tech: {} },
      { units: { lf: 1 }, tech: {} },
      sequence([0, 0.99, 0.99]),
    );
    expect(r).toEqual({ winner: 'att', rounds: 1, att: { cr: 1 }, def: {} });
  });
  it('uses Math.random when no generator is given', () => {
    expect(
      battle({ units: { bs: 1 }, tech: {} }, { units: {}, tech: {} }).winner,
    ).toBe('att');
  });
});
