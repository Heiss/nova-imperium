// `activeAgo` (ms): the account and every place of the player were last
// active that long ago (issue #229).
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 57,
  fields: ['activeAgo'],
  apply({ store, d, user }) {
    if (d.activeAgo === undefined) return;
    const at = Date.now() - d.activeAgo;
    store.db
      .prepare('UPDATE users SET active_at = ? WHERE id = ?')
      .run(at, user.id);
    store.db
      .prepare('UPDATE planets SET active_at = ? WHERE owner = ?')
      .run(at, user.id);
  },
};
