// The component `energyThreshold` (okf/architecture/patterns.md, sections 1
// and 12; #114): the energy production a level of an entry needs on its
// planet, `base` at level 1 times `f` per further level. It is checked, not
// consumed (#49 Gravitonforschung, #51 Weltenschmiede; owner, 2026-11-14).
// The tables keep it as the field `energy` until #118; this module holds the
// formula, and research.ts exports `energyNeed` and `energyShort` unchanged.
import { production } from '../economy.ts';
import type { Levels, Planet, Universe } from '../types.ts';

export interface EnergyThreshold {
  /** The energy production level 1 needs. */
  base: number;
  /** The factor of each further level. */
  f: number;
}

/** The energy production level `level` of `d` needs; 0 for most entries. */
export const energyNeed = (
  d: { energy?: EnergyThreshold },
  level: number,
): number => (d.energy ? d.energy.base * Math.pow(d.energy.f, level - 1) : 0);

/**
 * How much energy production `p` lacks for level `level` of `d`, rounded
 * up; 0 when it is enough. The production counts, not the use (#49), with
 * the Fusionskraftwerk as it runs: `research` holds Energietechnik, and a
 * reactor throttled at an empty stock counts its throttled share (#47).
 */
export const energyShort = (
  d: { energy?: EnergyThreshold },
  level: number,
  p: Pick<Planet, 'b' | 'pct' | 'temp' | 'res'>,
  u: Universe,
  research: Levels = {},
): number =>
  Math.max(
    0,
    Math.ceil(energyNeed(d, level) - production(p, u, research).eProd),
  );
