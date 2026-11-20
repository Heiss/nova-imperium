// The own places whose build queue is empty (#189, D5; owner, 2026-11-20): the
// line „Bauschleife leer“ of the card „Bereit“ on the phone overview. The
// browser knows the queue of the shown place only, so the state carries the
// ids of the other own planets and moons without a running building; the
// browser words them from the galaxy (name and position). Nothing of the
// places' own state is sent.
import type { User } from '../db/repos/players.ts';
import type { Ctx } from './context.ts';
import type { ServerFeature } from './feature.ts';

/**
 * The ids of the player's places but the shown one that have no building
 * under construction at `now` (a queue that ended counts as empty), in the
 * order of the planets of the player.
 */
export const idleQueues = (
  ctx: Ctx,
  uid: string,
  shown: { id: string } | null,
): string[] => {
  const now = ctx.now();
  return ctx.planets
    .ofOwner(uid)
    .filter((p) => p.id !== shown?.id && (p.bq === null || p.bq.end <= now))
    .map((p) => p.id);
};

export const serverFeature = {
  state: {
    order: 220,
    keys: ['idle'],
    build: (ctx, u: User, view) => ({
      idle: idleQueues(ctx, u.id, view.planet),
    }),
  },
} satisfies ServerFeature;
