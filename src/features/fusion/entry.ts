// Issue #47. Not in version 1; the classic values (owner, 2026-11-12).

import type { BuildingFields } from '../../core/catalog.ts';
import type { Consumes } from '../../core/components/consumes.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Produces } from '../../core/components/produces.ts';
import { fusionEnergy, fusionUse } from '../../core/rates.ts';

export const kind = 'building';
export const order = 50;
export const leveled: Required<Leveled> = {
  cost: [900, 360, 180],
  f: 1.8,
};
// Its energy grows with Energietechnik; it burns deuterium (#47).
export const produces: Produces = {
  order: 60,
  e: (x) => fusionEnergy(x.level, x.research.energy ?? 0) * (x.pct / 100),
};
export const consumes: Consumes = {
  d: (x) => fusionUse(x.level, x.u) * (x.pct / 100),
};
export const def: BuildingFields = {
  req: {
    b: {
      deut: 5,
    },
    r: {
      energy: 3,
    },
  },
};
