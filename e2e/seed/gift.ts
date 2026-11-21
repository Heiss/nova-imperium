// `gift` (minutes): a gift fleet of the „Endzeit“ to the home planet that
// arrives in that time, without the trigger for every player (issue #161).
import type { SeedPart } from './lib/types.ts';

type Game = {
  createCtx: typeof import('../../src/server/game/context.ts').createCtx;
  giftFleet: typeof import('../../src/server/game/endzeit.ts').giftFleet;
};
let game: Game;

export const part: SeedPart = {
  order: 56,
  fields: ['gift'],
  async prepare() {
    game = {
      ...(await import('../../src/server/game/context.ts')),
      ...(await import('../../src/server/game/endzeit.ts')),
    };
  },
  apply({ store, d, planet }) {
    if (!d.gift) return;
    const now = Date.now();
    const ctx = game.createCtx(store);
    ctx.fleets.save(game.giftFleet(ctx, planet, now, now + d.gift * 60000));
  },
};
