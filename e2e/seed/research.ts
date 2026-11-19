// `research`: the research levels of the player.
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 20,
  fields: ['research'],
  apply({ store, d, user }) {
    if (d.research) store.saveUser({ ...user, research: d.research });
  },
};
