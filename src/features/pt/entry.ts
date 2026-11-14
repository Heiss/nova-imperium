// Issue #50. Not in version 1; the classic values (owner, 2026-11-12).
// No unit has rapid fire against the Ionengeschütz, the Plasmawerfer and the
// shield domes, and they have none.

import type { DefenseFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'defense';
export const order = 60;
export const unit: Unit = {
  cost: [50000, 50000, 30000],
};
export const combat: Combat = {
  atk: 3000,
  sh: 300,
};
export const def: DefenseFields = {
  req: {
    b: {
      yard: 8,
    },
    r: {
      plasma: 7,
    },
  },
};
