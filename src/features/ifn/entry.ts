// Issue #49. Not in version 1; the classic values (owner, 2026-11-12).

import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 150;
export const leveled: Leveled = {
  cost: [240000, 400000, 160000],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 10,
    },
    r: {
      computer: 8,
      hyper: 8,
    },
  },
};
