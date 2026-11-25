// „Optionen“: the passkeys (features/passkeys.ts adds and lists them).
import { optionBox } from './contract.ts';
import PasskeysBox from './PasskeysBox.svelte';

export const optionBoxes = [
  optionBox({
    key: 'passkeys',
    order: 80,
    section: 'account',
    component: PasskeysBox,
  }),
];
