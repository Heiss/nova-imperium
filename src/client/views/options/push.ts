// „Optionen“: the kinds of push messages (#192), on a server with Web Push
// only; its data is in logic/options/push.ts.
import { pushPart, pushShown } from '../../logic/options/push.ts';
import PushBox from './PushBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'push',
    order: 100,
    section: 'device',
    component: PushBox,
    data: pushPart,
    shown: pushShown,
  }),
];
