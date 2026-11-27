// „Optionen“: „Keine Wachen annehmen“ (#440, 230b); its data is in
// logic/options/holding.ts.
import { holdPart, holdShown } from '../../logic/options/holding.ts';
import HoldBox from './HoldBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'holding',
    order: 35,
    section: 'game',
    component: HoldBox,
    data: holdPart,
    shown: holdShown,
  }),
];
