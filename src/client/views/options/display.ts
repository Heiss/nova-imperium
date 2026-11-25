// „Optionen“: the display of this device (the animations); its data is in
// logic/options/display.ts.
import { displayPart } from '../../logic/options/display.ts';
import DisplayBox from './DisplayBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'display',
    order: 60,
    section: 'device',
    component: DisplayBox,
    data: displayPart,
  }),
];
