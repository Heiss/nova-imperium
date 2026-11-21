// The achievements and the daily reward: the claim buttons, and the filter
// above the list (search, category, status; its state is
// logic/achievement-filter.svelte.ts, bound by the component), which hides
// what does not match and every group that has nothing left. The markup is in
// views/achievements.ts.
import {
  achievementFilter,
  groupHides,
  hides,
} from '../logic/achievement-filter.svelte.ts';
import { toggleFold } from '../logic/achievement-fold.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

function filterAchievements(): void {
  const filter = achievementFilter;
  document
    .querySelectorAll<HTMLElement>('[data-achievement]')
    .forEach((item) => {
      item.hidden = hides(filter, {
        category: item.dataset.category,
        status: item.dataset.status,
        search: item.dataset.search!,
      });
    });
  document
    .querySelectorAll<HTMLElement>('[data-achievement-group]')
    .forEach((group) => {
      group.hidden = groupHides(
        !!group.querySelector('[data-achievement]'),
        !!group.querySelector('[data-achievement]:not([hidden])'),
      );
    });
}

export const clientFeature = {
  listen: () => {
    document.addEventListener('change', () => {
      if (client.ui.view === 'achievements') filterAchievements();
    });
    document.addEventListener('input', (e) => {
      if (
        client.ui.view === 'achievements' &&
        (e.target as HTMLElement).id === 'achievement_search'
      )
        filterAchievements();
    });
  },
  acts: ({ act, render }) => ({
    achievementClaim: (d) => act('claimAchievement', { id: d.id }),
    dailyClaim: () => act('claimDailyReward'),
    // Phone (#189): unfolds the group „Offen“ or „Erledigt“.
    achFold: (d) => {
      toggleFold(d.g ?? '');
      render();
    },
  }),
  afterRender: () => {
    if (client.ui.view === 'achievements') filterAchievements();
  },
} satisfies ClientFeature;
