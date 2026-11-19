// The battle: up to 6 rounds, shields recharge every round, rapid fire,
// explosions of badly damaged units. `rng` is injectable for tests. The
// values of a unit come from its components `unit` and `combat`, read only
// through their rule module (#114).
import { FIGHTERS } from './catalog.ts';
import { rapidFire, strength } from './components/combat.ts';
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

/** What each level of weapons, shield and armour research adds (#285). */
export const TECH_BONUS = 0.1;

/** The factor of weapons, shield or armour research at a level. */
export const techFactor = (level: number): number => 1 + TECH_BONUS * level;

const bonus = (tech: Levels, key: string): number => techFactor(tech[key] ?? 0);

const MAX_ROUNDS = 6;

export function buildSide(side: Side): Unit[] {
  const out: Unit[] = [];
  for (const [key, n] of Object.entries(side.units)) {
    const f = FIGHTERS[key];
    if (!f) continue;
    const s = strength(f);
    const maxHull = s.hull * bonus(side.tech, 'armor');
    const maxShield = s.shield * bonus(side.tech, 'shield');
    const attack = s.attack * bonus(side.tech, 'weapons');
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
export const rapid = (a: string, t: string): number =>
  rapidFire(fighter(a), t, fighter(t));

/** The fighter of a key; an inherited name such as `constructor` is none. */
const fighter = (key: string) =>
  Object.hasOwn(FIGHTERS, key) ? FIGHTERS[key] : undefined;

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

const alive = <T extends Unit>(units: T[]): T[] =>
  units.filter((u) => u.hull > 0);

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

/** The result of a battle of several parties: the survivors of each, in the order given. */
export interface PartiesResult {
  winner: BattleResult['winner'];
  rounds: number;
  att: Levels[];
  def: Levels[];
}

/** A unit and the party it fights for. */
type Fighter = Unit & { party: number };

/** The units of all parties of one side, each marked with its party. */
const sideOf = (sides: readonly Side[]): Fighter[] =>
  sides.flatMap((side, party) =>
    buildSide(side).map((u) => Object.assign(u, { party })),
  );

/** The survivors of each party of a side. */
const survivors = (units: Fighter[], parties: number): Levels[] =>
  Array.from({ length: parties }, (_, i) =>
    count(units.filter((u) => u.party === i)),
  );

/**
 * A battle of several parties on each side (#55, patterns, section 5): every
 * unit shoots at a random unit of the other side, whatever party it belongs
 * to; the losses come back per party. With one party on each side it draws
 * exactly as `battle`.
 */
export function battleOf(
  attackers: readonly Side[],
  defenders: readonly Side[],
  rng: Rng = Math.random,
): PartiesResult {
  let a = sideOf(attackers);
  let d = sideOf(defenders);
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
  return {
    winner: winnerOf(a, d),
    rounds,
    att: survivors(a, attackers.length),
    def: survivors(d, defenders.length),
  };
}

/** The battle of one attacker and one defender. */
export function battle(
  attacker: Side,
  defender: Side,
  rng: Rng = Math.random,
): BattleResult {
  const res = battleOf([attacker], [defender], rng);
  return {
    winner: res.winner,
    rounds: res.rounds,
    att: res.att[0]!,
    def: res.def[0]!,
  };
}
