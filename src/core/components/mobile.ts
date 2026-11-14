// The component `mobile` (okf/architecture/patterns.md, sections 1 and 12;
// #114): a ship that flies. It keeps the names of version 1 as data, cargo,
// base speed, fuel, base drive and the drive switches (owner, 2026-11-14).
// A ship without `mobile` stays at its planet (the Sonnenreliquiar); its
// flight values are the core constant `STATIONARY`. Only this module reads
// the component; flight.ts asks it for the drive and the speed of a ship.
import type { Levels } from '../types.ts';

/** The drive researches; each level adds `DRIVE_BONUS` to the base speed. */
export type DriveKey = 'comb' | 'impulse' | 'hdrive';

/** Bonus on the base speed per level of the drive research. */
export const DRIVE_BONUS: Record<DriveKey, number> = {
  comb: 0.1,
  impulse: 0.2,
  hdrive: 0.3,
};

/**
 * A drive a ship switches to once the player has researched `from` (issue
 * #57): it replaces the base `drive` and `speed` of the ship.
 */
export interface DriveSwitch {
  drive: DriveKey;
  speed: number;
  from: { research: string; level: number };
}

export interface Mobile {
  /** Cargo of one ship. */
  cargo: number;
  /** Base speed with the base `drive`. */
  speed: number;
  /** Fuel of one ship, before distance and speed. */
  fuel: number;
  drive: DriveKey;
  /** Later drives; the last one whose research is reached flies the ship. */
  drives?: DriveSwitch[];
}

/**
 * The flight values of a ship without `mobile`, as version 1 had them for
 * the Sonnenreliquiar: no cargo, no speed, no fuel (owner, 2026-11-14).
 */
export const STATIONARY: Readonly<Mobile> = {
  cargo: 0,
  speed: 0,
  fuel: 0,
  drive: 'comb',
};

export interface ActiveDrive {
  drive: DriveKey;
  speed: number;
}

/**
 * The drive a ship flies with and its base speed: the base drive, or the
 * last drive switch whose research the player has reached.
 */
export function activeDrive(m: Mobile, research: Levels): ActiveDrive {
  let active: ActiveDrive = { drive: m.drive, speed: m.speed };
  for (const d of m.drives ?? [])
    if ((research[d.from.research] ?? 0) >= d.from.level)
      active = { drive: d.drive, speed: d.speed };
  return active;
}

/** The speed of a ship: the base speed of its drive plus the drive research bonus. */
export function speed(m: Mobile, research: Levels): number {
  const a = activeDrive(m, research);
  return a.speed * (1 + DRIVE_BONUS[a.drive] * (research[a.drive] ?? 0));
}
