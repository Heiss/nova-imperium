// The achievements and the daily reward: the claim buttons, and the filter
// above the list (search, category, status), which hides what does not match
// and every group that has nothing left. The markup is in
// views/achievements.ts.
import { val } from '../dom.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

function filterAchievements(): void {
  const query = val('#achievement_search').trim().toLocaleLowerCase('de');
  const category = val('#achievement_category');
  const status = val('#achievement_status');
  document
    .querySelectorAll<HTMLElement>('[data-achievement]')
    .forEach((item) => {
      item.hidden =
        (!!category && item.dataset.category !== category) ||
        (!!status && item.dataset.status !== status) ||
        !item.dataset.search!.includes(query);
    });
  document
    .querySelectorAll<HTMLElement>('[data-achievement-group]')
    .forEach((group) => {
      group.hidden =
        !!group.querySelector('[data-achievement]') &&
        !group.querySelector('[data-achievement]:not([hidden])');
    });
}

export const clientFeature = {
  acts: ({ act }) => {
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
    return {
      achievementClaim: (d) => act('claimAchievement', { id: d.id }),
      dailyClaim: () => act('claimDailyReward'),
    };
  },
  afterRender: () => {
    if (client.ui.view === 'achievements') filterAchievements();
  },
} satisfies ClientFeature;
