// „Achtung“: too little energy on the shown place (#189, D5).
import { production } from '../../../core/economy.ts';
import { fmt } from '../format.ts';
import type { OverviewLines } from './contract.ts';

export const overviewLines: readonly OverviewLines[] = [
  {
    card: 'attention',
    order: 20,
    lines: ({ s, P, R }) => {
      const pr = production(P, s.cfg, R.research);
      const missing = Math.ceil(pr.eUse - pr.eProd);
      return missing > 0
        ? [
            {
              key: 'energy',
              text: `Zu wenig Energie: es fehlen ${fmt(missing)}`,
              link: { view: 'buildings', label: 'Zu den Gebäuden' },
            },
          ]
        : [];
    },
  },
];
