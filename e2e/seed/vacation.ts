// `vacationAgo` (ms): the vacation mode started that long ago (issue #223).
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 30,
  fields: ['vacationAgo'],
  apply({ store, d, user }) {
    if (!d.vacationAgo) return;
    store.db
      .prepare('UPDATE users SET vacation = ? WHERE id = ?')
      .run(Date.now() - d.vacationAgo, user.id);
  },
};
