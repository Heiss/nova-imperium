import { rewardHint } from '../logic/menu-hints.ts';
import { rewardsOn } from '../../core/achievements.ts';
import { achievementsPage } from '../logic/achievements.ts';
import Achievements from './Achievements.svelte';
import type { ClientView } from './contract.ts';
import { keptMount } from './kept.ts';

/**
 * „Achievements“ (#118, bundle 5), its data as a property. A fresh render
 * mounts it anew; any other render hands it the new page, so the search the
 * player types stays the same field (#361). The filter lives in
 * logic/achievement-filter.svelte.ts, and features/achievements.ts applies it
 * after each render.
 */
const mountAchievements = keptMount(Achievements, achievementsPage);

export const clientViews = [
  {
    key: 'achievements',
    hint: { mark: ({ state }) => rewardHint(state) },
    mount: mountAchievements,
    fresh: true,
    // The rewards only while achievements or daily rewards are on.
    offered: rewardsOn,
    menu: {
      order: 140,
      label: (round) =>
        round.achievements ? 'Achievements' : 'Tagesbelohnung',
    },
  },
] satisfies readonly ClientView[];
