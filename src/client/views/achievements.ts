import { mount, unmount } from 'svelte';
import { achievementsPage } from '../logic/achievements.ts';
import type { V } from './common.ts';
import Achievements from './Achievements.svelte';
import type { ClientView } from './contract.ts';

/**
 * „Achievements“ (#118, bundle 5), its data as a property. It is mounted anew
 * on every render, as the HTML view was rendered anew: the filter above the
 * list is applied again after each render (features/achievements.ts), and a
 * phone folds or unfolds a group with a render (`achFold`, #189).
 */
function mountAchievements(target: HTMLElement, v: V) {
  const component = mount(Achievements, {
    target,
    props: { page: achievementsPage(v) },
  });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'achievements',
    mount: mountAchievements,
    anew: true,
    menu: {
      order: 140,
      label: (round) =>
        round.achievements ? 'Achievements' : 'Tagesbelohnung',
      show: (round) => round.achievements || round.daily,
    },
  },
] satisfies readonly ClientView[];
