// „Optionen“: Web Push on this device (features/push.ts switches it).
import BrowserPushBox from './BrowserPushBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'browserPush',
    order: 110,
    section: 'device',
    component: BrowserPushBox,
  }),
];
