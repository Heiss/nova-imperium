// Kreuzzugs-Kartografie, the classic Expeditionstechnik (#93, owner,
// 2026-11-16, Q1, verified at owiki.de „Expeditionstechnik“): without level 1
// the mission Expedition is not available; the level sets how many
// expeditions fly at once and how long they stay (src/core/expedition.ts).
import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 170;
export const leveled: Leveled = {
  cost: [4000, 8000, 4000],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 3,
    },
    r: {
      spy: 4,
      impulse: 3,
    },
  },
};
