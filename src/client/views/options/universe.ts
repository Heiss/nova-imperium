// „Optionen“: the link „Dieses Universum“ to the Lexicanum (#288, B4); a line,
// no box; its data is in logic/options/universe.ts.
import { universePart } from '../../logic/options/universe.ts';
import UniverseLink from './UniverseLink.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'universe',
    order: 140,
    section: 'other',
    component: UniverseLink,
    data: universePart,
  }),
];
