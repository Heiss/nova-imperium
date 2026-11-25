// „Optionen“: the archive of the rounds (#235); its data is in
// logic/options/archive.ts.
import { archivePart } from '../../logic/options/archive.ts';
import ArchiveBox from './ArchiveBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'archive',
    order: 50,
    section: 'round',
    component: ArchiveBox,
    data: archivePart,
  }),
];
