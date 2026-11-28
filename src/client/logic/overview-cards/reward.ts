// „Bereit“: a reward to claim (#189, D5).
import { rewardHint } from '../menu-hints.ts';
import type { OverviewLines } from './contract.ts';

export const overviewLines: readonly OverviewLines[] = [
  {
    card: 'ready',
    order: 10,
    keys: ['reward'],
    lines: ({ s }) => {
      const reward = rewardHint(s);
      return reward
        ? [
            {
              key: 'reward',
              text: reward,
              link: { view: 'achievements', label: 'Abholen' },
            },
          ]
        : [];
    },
  },
];
