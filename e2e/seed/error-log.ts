// `serverError` (a message): an unexpected server error of this player in the
// error log (issue #126).
import { recordServerError } from '../../src/server/error-log.ts';
import { createCtx } from '../../src/server/game/context.ts';
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 60,
  fields: ['serverError'],
  apply({ store, d, user }) {
    if (d.serverError)
      recordServerError(createCtx(store), {
        action: 'POST /api/action',
        error: new Error(d.serverError),
        player: user.id,
      });
  },
};
