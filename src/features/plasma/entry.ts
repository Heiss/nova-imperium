// Issue #49. Not in version 1; the classic values (owner, 2026-11-12).

import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 130;
export const leveled: Leveled = {
  cost: [2000, 4000, 1000],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 4,
    },
    r: {
      energy: 8,
      laser: 10,
      ion: 5,
    },
  },
};
