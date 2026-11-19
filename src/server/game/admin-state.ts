// What only the admin gets in the state: the settings specification and the
// „Endzeit“ (#161). It is not in admin.ts because the Endzeit imports that
// file for `requireAdmin`.
import { UNIVERSE_SPECS } from '../../core/universe.ts';
import type { User } from '../db/repos/players.ts';
import type { Ctx } from './context.ts';
import { endzeitState } from './endzeit.ts';
import type { ServerFeature } from './feature.ts';

/** What only the admin gets: the settings specification and the „Endzeit“. */
const adminState = (ctx: Ctx, u: User) =>
  u.admin ? { specs: UNIVERSE_SPECS, endzeit: endzeitState(ctx) } : null;

export const serverFeature = {
  state: {
    order: 190,
    keys: ['admin'],
    build: (ctx, u) => ({ admin: adminState(ctx, u) }),
  },
} satisfies ServerFeature;
