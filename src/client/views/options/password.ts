// „Optionen“: the change of the password (features/login.ts sends the form);
// its data is in logic/options/password.ts.
import { passwordPart } from '../../logic/options/password.ts';
import PasswordBox from './PasswordBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'password',
    order: 70,
    section: 'account',
    component: PasswordBox,
    data: passwordPart,
  }),
];
