// What only the admin gets in the state: the settings specification and the
// „Endzeit“ (#161). It is not in admin.ts because the Endzeit imports that
// file for `requireAdmin`.
import { freshValues } from '../../core/round.ts';
import { UNIVERSE_SPECS } from '../../core/universe.ts';
import type { User } from '../db/repos/players.ts';
import type { Ctx } from './context.ts';
import { endzeitState } from './endzeit.ts';
import type { ServerFeature } from './feature.ts';

/**
 * What only the admin gets: the settings specification, the „Endzeit“ and the
 * values a new round starts with where the running one has none of its own
 * (`fresh`, #237: the dialog „Neue Runde“ offers them).
 */
export const adminStateOf = (ctx: Ctx, u: User) =>
  u.admin
    ? {
        specs: UNIVERSE_SPECS,
        endzeit: endzeitState(ctx),
        fresh: freshValues((key) => ctx.admin.setting(key)),
      }
    : null;

export const serverFeature = {
  state: {
    order: 190,
    keys: ['admin'],
    build: (ctx, u) => ({ admin: adminStateOf(ctx, u) }),
  },
} satisfies ServerFeature;
