// Moves the planned starts of the player's attack unions forward (#478):
// `startPlanned` makes every start he planned due now, so the tick of the
// server starts the fleet within a second.
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 10,
  fields: ['startPlanned'],
  apply({ store, d, user }) {
    if (d.startPlanned)
      store.db
        .prepare(
          'UPDATE attack_unions SET start_at = ? WHERE leader = ? AND start_at IS NOT NULL',
        )
        .run(Date.now(), user.id);
  },
};
