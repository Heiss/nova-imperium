// `loginCodeAge` (ms): the code of the sign-in under way was sent that long
// ago, as the server sees it; its ten minutes end that much earlier. The
// server takes its time from its own clock, which the clock of the page does
// not move, so „Code erneut senden“ is tested without waiting 30 s (101b).
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 59,
  fields: ['loginCodeAge'],
  apply({ store, d, user }) {
    if (d.loginCodeAge === undefined) return;
    const { changes } = store.db
      .prepare(
        "UPDATE account_tokens SET expires = expires - ? WHERE user_id = ? AND purpose = 'login'",
      )
      .run(Number(d.loginCodeAge), user.id);
    if (changes === 0)
      throw new Error(`loginCodeAge: ${user.name} has no sign-in under way`);
  },
};
