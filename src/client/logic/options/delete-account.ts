// „Optionen“, the data of the box „Account löschen“ (#191).
import { deleteAccountText } from '../delete-account.ts';
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface DeleteAccountPart {
  deleteAccount: string;
}

/** The sentence of the box, which names a guild only in a round with guilds. */
export const deleteAccountPart = ({ s }: OptionsState): DeleteAccountPart => ({
  deleteAccount: deleteAccountText(s.round),
});
