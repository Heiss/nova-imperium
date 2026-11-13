// Issue #50. Not in version 1; the classic values (owner, 2026-11-12).
// No unit has rapid fire against the Ionengeschütz, the Plasmawerfer and the
// shield domes, and they have none.

import type { DefenseFields } from '../../core/catalog.ts';

export const kind = 'defense';
export const order = 80;
export const def: DefenseFields = {
  cost: [50000, 50000, 0],
  atk: 1,
  sh: 10000,
  req: {
    b: {
      yard: 6,
    },
    r: {
      shield: 6,
    },
  },
  once: true,
};
