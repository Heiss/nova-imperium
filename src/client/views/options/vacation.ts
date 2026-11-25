// „Optionen“: the vacation mode (#223); its data is in
// logic/options/vacation.ts.
import { vacationPart } from '../../logic/options/vacation.ts';
import VacationBox from './VacationBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'vacation',
    order: 30,
    section: 'round',
    component: VacationBox,
    data: vacationPart,
  }),
];
