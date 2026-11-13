import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 10;
export const leveled: Leveled = {
  cost: [0, 800, 400],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 1,
    },
  },
};
