// The state of the forms of „Optionen“ (#332): the choices, the passwords
// and the text of „Problem melden“ as the player typed or chose them. The
// component Options shows them, so the redraw of the poll, which mounts the
// view anew, keeps them; a field nobody touched (absent) shows the page. A
// fresh render and a logout drop them (form-state.svelte.ts). The handlers
// read the fields by their ids, which show this state.
import { formState } from './form-state.svelte.ts';

export interface OptionsDraft {
  probes?: string;
  explain?: string;
  levels?: string;
  main?: string;
  pwCurrent?: string;
  pwNext?: string;
  pwConfirm?: string;
  passkey?: string;
  report?: string;
}

export const optionsForm = formState((): OptionsDraft => ({}));
