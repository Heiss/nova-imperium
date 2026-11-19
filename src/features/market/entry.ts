// Issue #171, the Handelsposten (owner, 2026-11-17, D3): a new building that
// opens the marketplace on its planet; level 1 is needed, and every higher
// level lowers the fee (src/core/market.ts). The cost, the requirement and
// the place are proposals [V], like the other buildings: 5,000 Adamant,
// 10,000 Psikristall, 5,000 Promethium, factor 2, the Servitorenschmiede at
// level 4; it stands on planets only, as a building without `placement`.

import type { BuildingFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'building';
export const order = 170;
export const leveled: Required<Leveled> = {
  cost: [5000, 10000, 5000],
  f: 2,
};
export const def: BuildingFields = {
  req: {
    b: {
      robot: 4,
    },
  },
};
