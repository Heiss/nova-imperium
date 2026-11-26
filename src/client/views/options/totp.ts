// „Optionen“: the authenticator app (#401; features/totp.ts sends its forms);
// its data is in logic/options/totp.ts.
import { totpPart } from '../../logic/options/totp.ts';
import { optionBox } from './contract.ts';
import TotpBox from './TotpBox.svelte';

export const optionBoxes = [
  optionBox({
    key: 'totp',
    order: 75,
    section: 'account',
    component: TotpBox,
    data: totpPart,
  }),
];
