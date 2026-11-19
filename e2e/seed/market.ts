// `marketReset` (true): every price of the marketplace is back at the base and
// nobody has given anything today (issue #171).
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 58,
  fields: ['marketReset'],
  apply({ store, d }) {
    if (d.marketReset) store.repos.market.clear();
  },
};
