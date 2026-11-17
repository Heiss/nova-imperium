// The Warp-Tor (classic Sprungtor with modern levels, #53 and #230,
// okf/features/moons.md): the rules the owner decided on 2026-11-13 and
// 2026-11-16. A jump starts from the gate of the active moon and moves ships
// only, at once and without fuel, to another own moon with a Warp-Tor; both
// gates then cool down by the level of the starting gate. The server asks
// `jumpError` and the fleet view `gateReady` and `jumpTargets` (patterns,
// section 7).
import { canFly } from './catalog.ts';
import { countUnits } from './flight.ts';
import type { Levels, Planet } from './types.ts';

/**
 * The cooldown in minutes by the level of the starting gate, levels 1 to 15
 * (owner, 2026-11-13): the owiki.de values 1: 60, 2: 53, 3: 47, 4: 41,
 * 5: 36, 10: 17, 15: 10, and in between linear, rounded to whole minutes.
 */
const COOLDOWN_MINUTES: readonly number[] = [
  60, 53, 47, 41, 36, 32, 28, 25, 21, 17, 16, 14, 13, 11, 10,
];

/**
 * The cooldown in minutes after a jump from a gate at `level`: 10 from
 * level 15 on. Below level 1 there is no gate and no cooldown.
 */
export const gateCooldown = (level: number): number =>
  level < 1
    ? 0
    : COOLDOWN_MINUTES[Math.min(level, COOLDOWN_MINUTES.length) - 1]!;

/** The cooldown after a jump from a gate at `level`, in milliseconds. */
export const gateCooldownMs = (level: number): number =>
  gateCooldown(level) * 60_000;

/**
 * The level of the Warp-Tor on a place: its building on a moon, 0 on a
 * planet, where it cannot stand. The one place that reads the key.
 */
export const gateLevel = (p: Pick<Planet, 'kind' | 'b'>): number =>
  p.kind === 'moon' ? (p.b.jumpgate ?? 0) : 0;

/** A place with its gate: the moon and when its gate is ready again. */
export type Gate = Pick<Planet, 'id' | 'kind' | 'owner' | 'b'> & {
  /** When the gate is ready again; 0 or a past time when it is ready. */
  ready: number;
};

/** Whether the gate is ready at `now`: built and not cooling down. */
export const gateReady = (gate: Gate, now: number): boolean =>
  gateLevel(gate) > 0 && gate.ready <= now;

/** Why a jump cannot start. */
export type JumpError =
  | 'notMoon'
  | 'noGate'
  | 'cooling'
  | 'noTarget'
  | 'sameMoon'
  | 'targetNoGate'
  | 'targetCooling'
  | 'noShips'
  | 'stationary';

/**
 * Whether `target` can receive a jump from `from` at `now`, or why not:
 * another own moon whose Warp-Tor is ready (both gates must be ready). A
 * missing target (a destroyed moon, #95) is no target.
 */
export function targetError(
  from: Gate,
  target: Gate | null,
  now: number,
): JumpError | null {
  if (!target || target.kind !== 'moon' || target.owner !== from.owner)
    return 'noTarget';
  if (target.id === from.id) return 'sameMoon';
  if (gateLevel(target) < 1) return 'targetNoGate';
  return gateReady(target, now) ? null : 'targetCooling';
}

/**
 * Why the jump of `ships` from the gate `from` to `target` cannot start at
 * `now`, or null when it can: first the starting gate, then the target,
 * then the ships. The ships are those the player picked, at most the ones
 * on the moon; only ships that fly can jump, not the Sonnenreliquiare.
 */
export function jumpError(
  from: Gate,
  target: Gate | null,
  ships: Levels,
  now: number,
): JumpError | null {
  if (from.kind !== 'moon') return 'notMoon';
  if (gateLevel(from) < 1) return 'noGate';
  if (!gateReady(from, now)) return 'cooling';
  const error = targetError(from, target, now);
  if (error) return error;
  if (countUnits(ships) < 1) return 'noShips';
  return Object.keys(ships).every(canFly) ? null : 'stationary';
}

/** Moves the ships from one place to another; both are changed. */
export function moveShips(from: Planet, to: Planet, ships: Levels): void {
  for (const [key, n] of Object.entries(ships)) {
    from.ships[key] = (from.ships[key] ?? 0) - n;
    to.ships[key] = (to.ships[key] ?? 0) + n;
  }
}
