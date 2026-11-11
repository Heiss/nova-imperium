// The battle: up to 6 rounds, shields recharge every round, rapid fire,
// explosions of badly damaged units. `rng` is injectable for tests.
import { SHIPS, UNIT } from './catalog.ts';
import type { Levels } from './types.ts';

export type Rng = () => number;

export interface Side {
  units: Levels;
  tech: Levels;
}

export interface BattleResult {
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

export function buildSide(side: Side): Unit[] {
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
export function rapid(a: string, t: string): number {
  const rf = UNIT[a]?.rf?.[t];
  if (rf) return rf;
  if (t === 'probe' && SHIPS[a] && a !== 'probe') return 5;
  return 1;
}

export function hit(target: Unit, dmg: number, rng: Rng): void {
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

export const count = (units: Unit[]): Levels =>
  units.reduce<Levels>((o, u) => {
    o[u.key] = (o[u.key] ?? 0) + 1;
    return o;
  }, {});

function winnerOf(a: Unit[], d: Unit[]): BattleResult['winner'] {
  if (!a.length && d.length) return 'def';
  if (!d.length && a.length) return 'att';
  return 'draw';
}

export function battle(
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
