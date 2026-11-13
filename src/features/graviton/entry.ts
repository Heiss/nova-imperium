// Issue #49. Not in version 1; the classic values (owner, 2026-11-12).

import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 140;
export const leveled: Leveled = {
  cost: [0, 0, 0],
};
export const def: ResearchFields = {
  energy: {
    base: 300000,
    f: 3,
  },
  req: {
    b: {
      lab: 12,
    },
  },
};
