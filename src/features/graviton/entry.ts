// Issue #49. Not in version 1; the classic values (owner, 2026-11-12).

import type { ResearchFields } from '../../core/catalog.ts';
import type { EnergyThreshold } from '../../core/components/energy-threshold.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 140;
export const leveled: Leveled = {
  cost: [0, 0, 0],
};
export const energyThreshold: EnergyThreshold = {
  base: 300000,
  f: 3,
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 12,
    },
  },
};
