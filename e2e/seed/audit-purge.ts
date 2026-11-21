// `auditPurged` (true): the audit rows of the player are gone, as the purge of
// the audit log (30 days, src/server/audit.ts) deletes them. Nothing else
// changes, so the journal of the round is what is left of the actions.
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 58,
  fields: ['auditPurged'],
  apply({ store, d, user }) {
    if (!d.auditPurged) return;
    const { changes } = store.db
      .prepare('DELETE FROM audit_events WHERE actor = ?')
      .run(user.id);
    if (changes === 0)
      throw new Error(`auditPurged: ${user.name} has no audit rows to purge`);
  },
};
