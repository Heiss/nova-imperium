// Issue #51, the classic Terraformer. Not in version 1; the classic values
// (owner, 2026-11-13).

import type { BuildingFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'building';
export const order = 80;
export const leveled: Required<Leveled> = {
  cost: [0, 50000, 100000],
  f: 2,
};
export const def: BuildingFields = {
  req: {
    b: {
      nanite: 1,
    },
    r: {
      energy: 12,
    },
  },
  energy: {
    base: 1000,
    f: 2,
  },
  fields: 5,
};
