// „Optionen“: the deletion of the account (#191); its data is in
// logic/options/delete-account.ts.
import { deleteAccountPart } from '../../logic/options/delete-account.ts';
import DeleteAccountBox from './DeleteAccountBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'deleteAccount',
    order: 130,
    section: 'account',
    component: DeleteAccountBox,
    data: deleteAccountPart,
  }),
];
