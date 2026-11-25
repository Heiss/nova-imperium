// „Optionen“: the own activity and play time (#231), filled after each render
// by features/playtime.ts.
import ActivityBox from './ActivityBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'activity',
    order: 40,
    section: 'round',
    component: ActivityBox,
  }),
];
