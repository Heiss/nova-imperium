// „Optionen“: the installation as an app (features/install.ts shows the
// button after each render).
import { optionBox } from './contract.ts';
import InstallBox from './InstallBox.svelte';

export const optionBoxes = [
  optionBox({
    key: 'install',
    order: 90,
    section: 'device',
    component: InstallBox,
  }),
];
