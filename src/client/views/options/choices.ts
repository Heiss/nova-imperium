// „Optionen“: the choices of the player (#118); its data is in
// logic/options/choices.ts.
import { choicesPart } from '../../logic/options/choices.ts';
import ChoicesBox from './ChoicesBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'choices',
    order: 10,
    section: 'game',
    component: ChoicesBox,
    data: choicesPart,
  }),
];
