// The state of the two forms of the page „Admin“ that are no filter (#332):
// the address to invite and the message to all players, as typed. The
// component Admin shows them, so the redraw of the poll, which mounts the page
// anew, keeps them; a fresh render (the invitation renders anew) and a logout
// drop them (form-state.svelte.ts). The filters keep theirs in
// logic/admin-panels.svelte.ts; features/admin.ts reads the fields by id.
import { formState } from './form-state.svelte.ts';

export interface AdminDraft {
  invite?: string;
  announce?: string;
}

export const adminForm = formState((): AdminDraft => ({}));
