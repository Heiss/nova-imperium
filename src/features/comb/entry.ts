import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 30;
export const leveled: Leveled = {
  cost: [400, 0, 600],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 1,
    },
    r: {
      energy: 1,
    },
  },
};
