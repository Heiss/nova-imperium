// Whether a view is offered (#373): the one rule, from the `offered` of the
// views' own modules (contract.ts), for the menu and the tabs (index.ts), the
// address (navigation.ts) and the fallback of the mount (mount.ts).
import type { RoundRules } from '../../core/round.ts';
import { assembleOffered } from './assemble.ts';
import { CLIENT_VIEWS } from './views.gen.ts';

const OFFERED = assembleOffered(CLIENT_VIEWS);

/** Whether `view` is offered in the round to an admin or a player; a view without a rule always is. */
export const offered = (
  view: string,
  round: RoundRules,
  admin: boolean,
): boolean => OFFERED[view]?.(round, admin) ?? true;
