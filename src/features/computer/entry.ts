import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 80;
export const leveled: Leveled = {
  cost: [0, 400, 600],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 1,
    },
  },
};
