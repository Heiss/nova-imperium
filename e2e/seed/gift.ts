// `gift` (minutes): a gift fleet of the „Endzeit“ to the home planet that
// arrives in that time, without the trigger for every player (issue #161).
import { createCtx } from '../../src/server/game/context.ts';
import { giftFleet } from '../../src/server/game/endzeit.ts';
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 56,
  fields: ['gift'],
  apply({ store, d, planet }) {
    if (!d.gift) return;
    const now = Date.now();
    const ctx = createCtx(store);
    ctx.fleets.save(giftFleet(ctx, planet, now, now + d.gift * 60000));
  },
};
