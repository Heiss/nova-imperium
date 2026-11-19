import { describe, expect, it } from 'vitest';
import { seeded, sequence } from '../test/fixtures.ts';
import {
  againChance,
  battle,
  battleOf,
  buildSide,
  count,
  EXPLODES_BELOW,
  hit,
  MAX_ROUNDS,
  rapid,
  SHIELD_IGNORED,
} from './battle.ts';
import { fights, UNIT } from './catalog.ts';

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
  it('builds the new defense with hull (M + K) / 10 and the tech bonus (#50)', () => {
    const plain = buildSide({
      units: { ionc: 1, pt: 1, ssd: 1, lsd: 1 },
      tech: {},
    });
    expect(plain.map((x) => [x.key, x.maxHull, x.maxShield, x.attack])).toEqual(
      [
        ['ionc', 800, 500, 150],
        ['pt', 10000, 300, 3000],
        ['ssd', 2000, 2000, 1],
        ['lsd', 10000, 10000, 1],
      ],
    );
    const [lsd] = buildSide({
      units: { lsd: 1 },
      tech: { armor: 2, shield: 3, weapons: 1 },
    });
    expect(lsd?.hull).toBeCloseTo(12000, 9);
    expect(lsd?.maxHull).toBeCloseTo(12000, 9);
    expect(lsd?.shield).toBeCloseTo(13000, 9);
    expect(lsd?.maxShield).toBeCloseTo(13000, 9);
    expect(lsd?.attack).toBeCloseTo(1.1, 9);
  });
  it('gives only the Bomber and the Todesstern rapid fire against the new defense (#50, #57, #60)', () => {
    const fresh = ['ionc', 'pt', 'ssd', 'lsd'];
    const all = [
      ...['sc', 'lc', 'colony', 'lf', 'hf', 'cr', 'bs', 'bc', 'dr', 'bb'],
      ...['dstar', 'probe', 'sat', 'rl', 'll', 'hl', 'gauss', ...fresh],
    ];
    // Only against the Ionengeschütz: Bomber 10, Todesstern 100.
    const expected: Record<string, number> = { bb: 10, dstar: 100 };
    for (const a of all)
      for (const t of fresh) {
        expect(rapid(a, t), `${a} → ${t}`).toBe(
          t === 'ionc' ? (expected[a] ?? 1) : 1,
        );
        expect(rapid(t, a), `${t} → ${a}`).toBe(1);
      }
  });
  it('lets hits below 1 % of a dome shield bounce off (#50)', () => {
    const [ssd] = buildSide({ units: { ssd: 1 }, tech: {} });
    hit(ssd!, 19.99, () => 0);
    expect(ssd).toMatchObject({ shield: 2000, hull: 2000 });
    hit(ssd!, 20, () => 0);
    expect(ssd).toMatchObject({ shield: 1980, hull: 2000 });
    const [lsd] = buildSide({ units: { lsd: 1 }, tech: { shield: 1 } });
    // 1 % of 11,000: a Schweres Lasergeschütz (250) and a Gaußkanone (1,100) bounce off.
    hit(lsd!, 109.99, () => 0);
    expect(lsd!.shield).toBeCloseTo(11000, 9);
    hit(lsd!, 110, () => 0);
    expect(lsd!.shield).toBeCloseTo(10890, 9);
  });
  it('lets a dome explode below 70 % hull by chance (#50)', () => {
    const dome = () => buildSide({ units: { ssd: 1 }, tech: {} })[0]!;
    // 2,000 shield + 600 hull: 1,400 of 2,000 left, exactly 70 %: no explosion.
    const a = dome();
    hit(a, 2600, () => 0.99);
    expect(a).toMatchObject({ shield: 0, hull: 1400 });
    // 1,000 of 2,000 left: explodes when the draw is above 0.5.
    const b = dome();
    hit(b, 3000, () => 0.51);
    expect(b.hull).toBe(0);
    const c = dome();
    hit(c, 3000, () => 0.5);
    expect(c.hull).toBe(1000);
  });
  it('lets a Plasmawerfer break a small dome in a battle (#50)', () => {
    // 3,000 against 2,000 shield and 2,000 hull: 1,000 hull left, then the draw.
    const r = battle(
      { units: { pt: 1 }, tech: {} },
      { units: { ssd: 1 }, tech: {} },
      sequence([0, 0.99, 0]),
    );
    expect(r).toEqual({ winner: 'att', rounds: 1, att: { pt: 1 }, def: {} });
    // Light fighters bounce off the Große Schildkuppel (50 < 100): a draw.
    const d = battle(
      { units: { lf: 3 }, tech: {} },
      { units: { lsd: 1 }, tech: {} },
      seeded(2),
    );
    expect(d.winner).toBe('draw');
    expect(d.rounds).toBe(6);
    expect(d.def).toEqual({ lsd: 1 });
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
    expect(rapid('bb', 'ionc')).toBe(10);
    expect(rapid('bb', 'pt')).toBe(1);
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
  it('builds the Todesstern with hull (M + K) / 10 (#60)', () => {
    const [ts] = buildSide({ units: { dstar: 1 }, tech: {} });
    expect(ts).toEqual({
      key: 'dstar',
      hull: 900000,
      maxHull: 900000,
      shield: 50000,
      maxShield: 50000,
      attack: 200000,
    });
    const [boosted] = buildSide({
      units: { dstar: 1 },
      tech: { armor: 2, shield: 1, weapons: 3 },
    });
    expect(boosted?.maxHull).toBeCloseTo(1080000, 9);
    expect(boosted?.maxShield).toBeCloseTo(55000, 9);
    expect(boosted?.attack).toBeCloseTo(260000, 9);
  });
  it('knows the rapid fire of the Todesstern (#60)', () => {
    // 1,250 against the probe and the Solarsatellit, not the general 5.
    expect(rapid('dstar', 'probe')).toBe(1250);
    expect(rapid('dstar', 'sat')).toBe(1250);
    expect(rapid('dstar', 'colony')).toBe(250);
    expect(rapid('dstar', 'lf')).toBe(200);
    expect(rapid('dstar', 'cr')).toBe(33);
    expect(rapid('dstar', 'bb')).toBe(25);
    expect(rapid('dstar', 'dr')).toBe(5);
    expect(rapid('dstar', 'gauss')).toBe(50);
    expect(rapid('dstar', 'ionc')).toBe(100);
    // None against itself, the Plasmawerfer and the shield domes (#50, #60).
    const noTarget = ['dstar', 'pt', 'ssd', 'lsd'];
    for (const t of noTarget) expect(rapid('dstar', t), t).toBe(1);
    // Every other unit is a target with its own value (#60 D4): a unit added
    // later fails here until it has one or joins `noTarget`. Missiles do not
    // fight, so they are no target (#54).
    const rf = UNIT.dstar!.rf!;
    const fighters = Object.keys(UNIT).filter((k) => fights(k));
    for (const t of fighters.filter((k) => !noTarget.includes(k))) {
      expect(rf[t], t).toBeGreaterThan(1);
      expect(rapid('dstar', t)).toBe(rf[t]);
    }
  });
  it('fights with the Bergungsbarke as the classic Recycler (#45)', () => {
    const [b] = buildSide({ units: { recycler: 1 }, tech: {} });
    expect(b).toMatchObject({ hull: 1600, shield: 10, attack: 1 });
    // The default 5 against the easy targets, nothing else.
    expect(rapid('recycler', 'probe')).toBe(5);
    expect(rapid('recycler', 'sat')).toBe(5);
    for (const t of ['sc', 'lf', 'recycler', 'rl'])
      expect(rapid('recycler', t)).toBe(1);
    expect(rapid('dstar', 'recycler')).toBe(250);
  });
  it('gives no unit rapid fire against the Todesstern (#60)', () => {
    for (const a of Object.keys(UNIT)) expect(rapid(a, 'dstar'), a).toBe(1);
  });
  it('lets hits below 1 % of its shield bounce off a Todesstern (#60)', () => {
    // At equal tech only units with an attack of 500 or more hurt it.
    const attack = (k: string): number =>
      buildSide({ units: { [k]: 1 }, tech: {} })[0]!.attack;
    const ts = buildSide({ units: { dstar: 1 }, tech: {} })[0]!;
    const small = ['sc', 'lc', 'colony', 'lf', 'hf', 'cr', 'probe', 'sat'];
    const defense = ['rl', 'll', 'hl', 'ionc', 'ssd', 'lsd'];
    for (const k of [...small, ...defense]) hit(ts, attack(k), () => 0);
    expect(ts.shield).toBe(50000);
    for (const k of ['bs', 'bc', 'dr', 'bb', 'gauss', 'pt'])
      hit(ts, attack(k), () => 0);
    // 50,000 − 1,000 − 700 − 2,000 − 1,000 − 1,100 − 3,000
    expect(ts.shield).toBe(41200);
    expect(ts.hull).toBe(900000);
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

describe('battle of several parties (#55)', () => {
  const side = (units: Record<string, number>, tech = {}) => ({ units, tech });
  it('draws exactly as the battle of two when each side has one party', () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      const a = side({ lf: 30, hf: 5, cr: 2 }, { weapons: 2 });
      const d = side({ rl: 20, ll: 5, lf: 10 }, { shield: 1 });
      const two = battle(a, d, seeded(seed));
      const many = battleOf([a], [d], seeded(seed));
      expect(many).toEqual({
        winner: two.winner,
        rounds: two.rounds,
        att: [two.att],
        def: [two.def],
      });
    }
  });
  it('returns the survivors per party, in the order given', () => {
    const r = battleOf(
      [side({ bs: 5 })],
      [side({ rl: 2 }), side({}), side({ probe: 3 })],
      () => 0.99,
    );
    expect(r.def).toHaveLength(3);
    expect(r.att).toEqual([{ bs: 5 }]);
    expect(r.def[1]).toEqual({});
  });
  it('lets every party of a side fight, each with its own technology', () => {
    // The same Raketenwerfer on both defending parties; only the second has
    // armor and shields, and keeps more of them in every seed.
    const r = [1, 2, 3].map((seed) =>
      battleOf(
        [side({ lf: 40 })],
        [side({ rl: 20 }), side({ rl: 20 }, { armor: 10, shield: 10 })],
        seeded(seed),
      ),
    );
    expect(r.map((x) => x.def)).toEqual([
      [{ rl: 8 }, { rl: 17 }],
      [{ rl: 13 }, { rl: 20 }],
      [{ rl: 10 }, { rl: 18 }],
    ]);
    expect(r.map((x) => [x.winner, x.rounds, x.att])).toEqual([
      ['def', 5, [{}]],
      ['def', 5, [{}]],
      ['def', 4, [{}]],
    ]);
  });
  it('lets the defenders win together', () => {
    const r = battleOf(
      [side({ lf: 1 })],
      [side({}), side({ bs: 2 })],
      seeded(5),
    );
    expect(r.winner).toBe('def');
    expect(r.att).toEqual([{}]);
    expect(r.def).toEqual([{}, { bs: 2 }]);
  });
  it('ends at once without any unit on one side', () => {
    expect(battleOf([side({ lf: 2 })], [side({}), side({})])).toEqual({
      winner: 'att',
      rounds: 0,
      att: [{ lf: 2 }],
      def: [{}, {}],
    });
    expect(battleOf([], [side({ rl: 1 })]).winner).toBe('def');
  });
});

describe('the numbers of a battle (#288)', () => {
  it('has the six rounds, the ignored shot and the border of an explosion', () => {
    expect(MAX_ROUNDS).toBe(6);
    expect(SHIELD_IGNORED).toBe(0.01);
    expect(EXPLODES_BELOW).toBe(0.7);
  });

  it('shoots again at (r - 1) / r', () => {
    expect(againChance(1)).toBe(0);
    expect(againChance(2)).toBe(0.5);
    expect(againChance(5)).toBe(0.8);
    expect(againChance(10)).toBeCloseTo(0.9, 12);
  });

  it('lets a battle that nobody wins end after the last round', () => {
    // Two units that cannot hurt each other: the shield ignores every shot.
    const tough = { units: { ssd: 1 }, tech: {} };
    const result = battleOf([tough], [tough], () => 0);
    expect(result.rounds).toBe(MAX_ROUNDS);
    expect(result.winner).toBe('draw');
  });
});
