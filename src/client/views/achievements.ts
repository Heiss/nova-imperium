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
    mount: mountAchievements,
    fresh: true,
    menu: {
      order: 140,
      label: (round) =>
        round.achievements ? 'Achievements' : 'Tagesbelohnung',
      show: (round) => round.achievements || round.daily,
    },
  },
] satisfies readonly ClientView[];
