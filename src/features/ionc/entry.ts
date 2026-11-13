// Issue #50. Not in version 1; the classic values (owner, 2026-11-12).
// No unit has rapid fire against the Ionengeschütz, the Plasmawerfer and the
// shield domes, and they have none.

import type { DefenseFields } from '../../core/catalog.ts';

export const kind = 'defense';
export const order = 50;
export const def: DefenseFields = {
  cost: [2000, 6000, 0],
  atk: 150,
  sh: 500,
  req: {
    b: {
      yard: 4,
    },
    r: {
      ion: 4,
    },
  },
};
