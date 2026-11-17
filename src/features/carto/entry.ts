// Auspex-Kartographie (#190, D4): upgrades the Spähschädel to survey free
// positions; without level 1 the mission Vermessung is not available, and
// every level raises the score and lowers the loss (src/core/survey.ts).
import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 160;
export const leveled: Leveled = {
  cost: [1000, 2000, 1000],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 3,
    },
    r: {
      spy: 2,
      impulse: 3,
    },
  },
};
