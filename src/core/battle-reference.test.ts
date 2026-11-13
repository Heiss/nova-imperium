// battle() from the components `unit` and `combat` (#114) is bit-identical
// to battle() before: a property test on generated sides with the same
// random stream (owner, 2026-11-13). The reference below is battle.ts as it
// was on main before the combat components, copied unchanged; it reads the
// tables UNIT and SHIPS, which catalog.test.ts holds equal to version 1.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { seeded } from '../test/fixtures.ts';
import * as N from './battle.ts';
import { SHIPS, UNIT } from './catalog.ts';
import type { Levels } from './types.ts';

// ---- reference: src/core/battle.ts before the combat components ----

type Rng = () => number;

interface Side {
  units: Levels;
  tech: Levels;
}

interface BattleResult {
  winner: 'att' | 'def' | 'draw';
  rounds: number;
  att: Levels;
  def: Levels;
}

interface Unit {
  key: string;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  attack: number;
}

const bonus = (tech: Levels, key: string): number => 1 + 0.1 * (tech[key] ?? 0);

const MAX_ROUNDS = 6;

function buildSide(side: Side): Unit[] {
  const out: Unit[] = [];
  for (const [key, n] of Object.entries(side.units)) {
    const d = UNIT[key];
    if (!d) continue;
    const maxHull = ((d.cost[0] + d.cost[1]) / 10) * bonus(side.tech, 'armor');
    const maxShield = d.sh * bonus(side.tech, 'shield');
    const attack = d.atk * bonus(side.tech, 'weapons');
    for (let i = 0; i < n; i++)
      out.push({
        key,
        hull: maxHull,
        maxHull,
        shield: maxShield,
        maxShield,
        attack,
      });
  }
  return out;
}

/** Rapid fire of `a` against `t`: the chance to shoot again is (r - 1) / r. */
function rapid(a: string, t: string): number {
  const rf = UNIT[a]?.rf?.[t];
  if (rf) return rf;
  // Every ship but the probe and the satellite has rapid fire 5 against both.
  const easy = t === 'probe' || t === 'sat';
  if (easy && SHIPS[a] && a !== 'probe' && a !== 'sat') return 5;
  return 1;
}

function hit(target: Unit, dmg: number, rng: Rng): void {
  if (target.hull <= 0) return;
  if (dmg < 0.01 * target.shield) return;
  if (target.shield >= dmg) target.shield -= dmg;
  else {
    target.hull -= dmg - target.shield;
    target.shield = 0;
  }
  const damaged = target.hull > 0 && target.hull < 0.7 * target.maxHull;
  if (damaged && rng() > target.hull / target.maxHull) target.hull = 0;
}

function fire(shooters: Unit[], targets: Unit[], rng: Rng): void {
  const n = targets.length;
  if (!n) return;
  for (const s of shooters) {
    let again = true;
    while (again) {
      const t = targets[Math.floor(rng() * n)]!;
      hit(t, s.attack, rng);
      const r = rapid(s.key, t.key);
      again = r > 1 && rng() < (r - 1) / r;
    }
  }
}

const alive = (units: Unit[]): Unit[] => units.filter((u) => u.hull > 0);

const recharge = (units: Unit[]): void => {
  for (const u of units) u.shield = u.maxShield;
};

const count = (units: Unit[]): Levels =>
  units.reduce<Levels>((o, u) => {
    o[u.key] = (o[u.key] ?? 0) + 1;
    return o;
  }, {});

function winnerOf(a: Unit[], d: Unit[]): BattleResult['winner'] {
  if (!a.length && d.length) return 'def';
  if (!d.length && a.length) return 'att';
  return 'draw';
}

function battle(
  attacker: Side,
  defender: Side,
  rng: Rng = Math.random,
): BattleResult {
  let a = buildSide(attacker);
  let d = buildSide(defender);
  let rounds = 0;
  for (let r = 1; r <= MAX_ROUNDS && a.length && d.length; r++) {
    rounds = r;
    recharge(a);
    recharge(d);
    fire(a, d, rng);
    fire(d, a, rng);
    a = alive(a);
    d = alive(d);
  }
  return { winner: winnerOf(a, d), rounds, att: count(a), def: count(d) };
}
// ---- end of the reference ----

const KEYS = [...Object.keys(UNIT), 'nope'];
/** Rapid fire also asked for keys of entries that do not fight. */
const PAIRS = [...KEYS, 'metal', 'energy'];
// Inherited names of a plain object. The version before answered them with
// the inherited value (5 against an easy target, or the function `Object`
// as rapid fire); they never reach a battle, and now they are unknown keys.
const INHERITED = ['constructor', 'toString', '__proto__'];

const sideOf = (max: number): fc.Arbitrary<Side> =>
  fc.record({
    units: fc.record(
      Object.fromEntries(KEYS.map((k) => [k, fc.integer({ min: 0, max })])),
      { requiredKeys: [] },
    ) as fc.Arbitrary<Levels>,
    tech: fc.record(
      {
        armor: fc.integer({ min: 0, max: 20 }),
        shield: fc.integer({ min: 0, max: 20 }),
        weapons: fc.integer({ min: 0, max: 20 }),
      },
      { requiredKeys: [] },
    ),
  });

/** A random stream that counts how often it was asked. */
function counted(seed: number): { rng: Rng; calls: () => number } {
  const rng = seeded(seed);
  let n = 0;
  return {
    rng: () => {
      n++;
      return rng();
    },
    calls: () => n,
  };
}

describe('battle from the components equals battle before (#114)', () => {
  it('builds every side bit for bit as before', () => {
    fc.assert(
      fc.property(sideOf(3), (side) => {
        expect(N.buildSide(side)).toStrictEqual(buildSide(side));
      }),
    );
  });

  it('has the rapid fire of before for every pair, unknown keys included', () => {
    for (const a of PAIRS)
      for (const t of PAIRS)
        expect(N.rapid(a, t), `${a} → ${t}`).toBe(rapid(a, t));
  });

  it('treats inherited names as unknown keys: rapid fire 1', () => {
    for (const name of INHERITED)
      for (const other of PAIRS) {
        expect(N.rapid(name, other), `${name} → ${other}`).toBe(1);
        expect(N.rapid(other, name), `${other} → ${name}`).toBe(1);
      }
  });

  it('gives the same result with the same random stream, draw for draw', () => {
    fc.assert(
      fc.property(
        sideOf(8),
        sideOf(8),
        fc.integer({ min: 0, max: 2 ** 32 - 1 }),
        (att, def, seed) => {
          const before = counted(seed);
          const now = counted(seed);
          expect(N.battle(att, def, now.rng)).toStrictEqual(
            battle(att, def, before.rng),
          );
          expect(now.calls()).toBe(before.calls());
        },
      ),
      { numRuns: 200 },
    );
  });
});
