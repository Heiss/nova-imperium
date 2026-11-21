// `serverError` (a message): an unexpected server error of this player in the
// error log (issue #126).
import type { SeedPart } from './lib/types.ts';

type Game = {
  createCtx: typeof import('../../src/server/game/context.ts').createCtx;
  recordServerError: typeof import('../../src/server/error-log.ts').recordServerError;
};
let game: Game;

export const part: SeedPart = {
  order: 60,
  fields: ['serverError'],
  async prepare() {
    game = {
      ...(await import('../../src/server/game/context.ts')),
      ...(await import('../../src/server/error-log.ts')),
    };
  },
  apply({ store, d, user }) {
    if (d.serverError)
      game.recordServerError(game.createCtx(store), {
        action: 'POST /api/action',
        error: new Error(d.serverError),
        player: user.id,
      });
  },
};
