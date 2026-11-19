// The handlers of „Zurückbauen“ (#202, okf/features/demolition.md): the
// button of a building row and the confirmation. They and their tests are in
// logic/demolition.ts; this is where they register.
import { demolitionActs } from '../logic/demolition.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  acts: ({ act, modal }) =>
    demolitionActs({ act, modal, view: () => client.view }),
} satisfies ClientFeature;
