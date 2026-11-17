// The missiles (#54, okf/features/missiles.md): the owner's rules of
// 2026-11-16, checked on owiki. An Orbitalrakete flies from a planet to a
// foreign planet or moon of the same galaxy, at most (impulse drive level ×
// 5) − 1 systems away, in (30 + 60 × systems) / universe speed seconds. At
// the target the Abfangraketen stop one missile each; the rest hit only the
// defense that fights: the main target first, then the order of the catalog.
// Shields count for nothing; the damage grows with the attacker's weapons
// research, the structure of the defense with the defender's armor
// research. Destroyed defense is not rebuilt and leaves no Trümmerfeld.
// The server and the Sternenkarte both ask `launchError`
// (patterns, section 7); the impact is `strike`.
import { DEF, FIGHTERS, MISSILE } from './catalog.ts';
import { strength } from './components/combat.ts';
import { strikes } from './components/silo.ts';
import type { Coords, Levels, Place, Planet } from './types.ts';

/**
 * The missile that is launched (the Orbitalrakete): the one missile that
 * does not intercept. A contract test checks that there is exactly one.
 */
export const STRIKER: string = Object.keys(MISSILE).find((k) =>
  strikes(MISSILE[k]!),
)!;

/** The missiles that stop incoming ones (the Abfangrakete), in catalog order. */
export const INTERCEPTORS: readonly string[] = Object.keys(MISSILE).filter(
  (k) => !strikes(MISSILE[k]!),
);

/** The defense a missile can hit: every defense that fights, in catalog order. */
export const TARGETS: readonly string[] = Object.keys(DEF).filter((k) =>
  Object.hasOwn(FIGHTERS, k),
);

/** Whether `key` can be the main target of a missile attack. */
export const isTarget = (key: string): boolean => TARGETS.includes(key);

/**
 * The range in systems at an impulse drive level: level × 5 − 1. Without
 * the drive (level 0) it is below 0, so nothing is in range.
 */
export const missileRange = (impulse: number): number => impulse * 5 - 1;

/** Whether `target` is in range from `at`: the same galaxy, |s − s₀| systems. */
export const inMissileRange = (
  at: Coords,
  target: Coords,
  impulse: number,
): boolean =>
  at.g === target.g && Math.abs(at.s - target.s) <= missileRange(impulse);

/** The flight time in milliseconds: (30 + 60 × systems) / universe speed seconds. */
export const missileFlightMs = (
  at: Coords,
  target: Coords,
  speed: number,
): number => ((30 + 60 * Math.abs(at.s - target.s)) / speed) * 1000;

/** Why missiles cannot be launched, as a code; the server says it in German. */
export type LaunchError =
  | 'count'
  | 'noMissiles'
  | 'noPlanet'
  | 'noMoon'
  | 'ownTarget'
  | 'outOfRange'
  | 'protected'
  | 'aim';

/** The place the missiles start from and what the player has. */
export interface Launcher {
  at: Pick<Planet, 'id' | 'owner' | 'def'> & Coords;
  /** The impulse drive level of the player. */
  impulse: number;
}

/** The target of a launch. */
export interface LaunchTarget {
  place: Place;
  /** The owner of the planet or moon there; undefined when there is none. */
  owner?: string;
  /**
   * Whether the target's owner is protected from the launcher: the noob
   * protection, and the vacation mode once #223 is built. The server
   * determines it, and only after the other checks of the target.
   */
  protects(owner: string): boolean;
}

/**
 * Why `n` missiles cannot be launched from `launcher` at `target` with the
 * main target `aim` (a defense key, or null for none); null when they can.
 */
export function launchError(
  launcher: Launcher,
  target: LaunchTarget,
  n: number,
  aim: string | null,
): LaunchError | null {
  if (!Number.isInteger(n) || n < 1) return 'count';
  if (n > (launcher.at.def[STRIKER] ?? 0)) return 'noMissiles';
  if (aim !== null && !isTarget(aim)) return 'aim';
  return targetError(launcher, target);
}

/** Why the target cannot be hit: nothing there, own, out of range, protected. */
function targetError(
  launcher: Launcher,
  target: LaunchTarget,
): LaunchError | null {
  const owner = target.owner;
  if (owner === undefined)
    return target.place.kind === 'moon' ? 'noMoon' : 'noPlanet';
  if (owner === launcher.at.owner) return 'ownTarget';
  if (!inMissileRange(launcher.at, target.place, launcher.impulse))
    return 'outOfRange';
  return target.protects(owner) ? 'protected' : null;
}

/** What an attack of missiles does at its target. */
export interface Strike {
  /** The missiles the Abfangraketen stopped. */
  intercepted: number;
  /** The Abfangraketen used, by key. */
  used: Levels;
  /** The defense destroyed, by key. */
  destroyed: Levels;
}

/** What the missiles meet: the defense and the Abfangraketen that protect it. */
export interface StrikeTarget {
  /** The defense of the target. */
  def: Levels;
  /** The Abfangraketen that protect it: its own, or its planet's for a moon. */
  interceptors: Levels;
}

const bonus = (level: number): number => 1 + 0.1 * level;

/**
 * Below this share of a piece, the rest of the damage is a rounding error of
 * the research bonuses (1.1 × 12,000 / (1.1 × 200) is not exactly 60).
 */
const EPSILON = 1e-9;

/**
 * The impact of `n` missiles (owner, 2026-11-16, D3): the Abfangraketen stop
 * one each, in catalog order; the damage of the rest goes to `aim` first,
 * then to the defense in catalog order, a piece destroyed when its whole
 * structure is covered. The rest of the damage that covers no further piece
 * of one kind goes on to the next kind.
 */
export function strike(
  n: number,
  target: StrikeTarget,
  aim: string | null,
  research: { weapons: number; armor: number },
): Strike {
  const { used, left } = intercept(n, target.interceptors);
  const damage = left * DEF[STRIKER]!.atk * bonus(research.weapons);
  const order =
    aim !== null && isTarget(aim)
      ? [aim, ...TARGETS.filter((k) => k !== aim)]
      : TARGETS;
  return {
    intercepted: n - left,
    used,
    destroyed: destroy(target.def, order, damage, bonus(research.armor)),
  };
}

/** The Abfangraketen stop one missile each, in catalog order. */
function intercept(
  n: number,
  interceptors: Levels,
): { used: Levels; left: number } {
  const used: Levels = {};
  let left = n;
  for (const k of INTERCEPTORS) {
    const stop = Math.min(left, interceptors[k] ?? 0);
    if (stop > 0) used[k] = stop;
    left -= stop;
  }
  return { used, left };
}

/** The defense the damage destroys, kind by kind in `order`. */
function destroy(
  def: Levels,
  order: readonly string[],
  damage: number,
  armor: number,
): Levels {
  const destroyed: Levels = {};
  let rest = damage;
  for (const k of order) {
    const hull = strength(FIGHTERS[k]!).hull * armor;
    const gone = Math.min(def[k] ?? 0, Math.floor(rest / hull + EPSILON));
    if (gone <= 0) continue;
    destroyed[k] = gone;
    rest -= gone * hull;
  }
  return destroyed;
}
