// „Bereit“: new messages (#189, D5).
import { unread } from '../game.ts';
import type { OverviewLines } from './contract.ts';

export const overviewLines: readonly OverviewLines[] = [
  {
    card: 'ready',
    order: 20,
    keys: ['unread'],
    lines: ({ s }) => {
      const fresh = unread(s.reports, s.me.readAt);
      return fresh
        ? [
            {
              key: 'unread',
              text:
                fresh === 1
                  ? '1 ungelesene Nachricht'
                  : `${fresh} ungelesene Nachrichten`,
              link: { view: 'messages', label: 'Lesen' },
            },
          ]
        : [];
    },
  },
];
