// The admin actions of the round archive (#235): „Runde abschließen“ (D1) and
// „Runde löschen“ (Lifetime: an archive stays until the admin deletes it). The
// close itself is `closeActiveRound` in round-archive.ts, which „Neue Runde“
// uses too.
import type { Action } from './actions.ts';
import { requireAdmin } from './admin.ts';
import { fail, int } from './context.ts';
import type { ServerFeature } from './feature.ts';
import { closeActiveRound, ensureRound } from './round-archive.ts';

/** „Runde abschließen“ (D1): archives the running round now; the game goes on until „Neue Runde“. */
const closeRound: Action = (ctx, u, _d, event) => {
  requireAdmin(u);
  if (ensureRound(ctx).status === 'closed')
    return fail('Diese Runde ist schon abgeschlossen.');
  const round = closeActiveRound(ctx);
  if (event)
    event.detail = {
      round: round.number,
      participants: ctx.rounds.participants(round.number).length,
    };
  return `Runde ${round.number} abgeschlossen: ihr Bericht steht den Teilnehmern im Rundenarchiv bereit.`;
};

/** „Runde löschen“: the archive of a closed round stays until the admin deletes it (Lifetime). */
const deleteRound: Action = (ctx, u, d, event) => {
  requireAdmin(u);
  const number = int(d.round, 0, Number.MAX_SAFE_INTEGER);
  const round = ctx.rounds.get(number);
  if (!round) return fail('Diese Runde gibt es nicht im Archiv.');
  if (round.status !== 'closed')
    return fail('Nur eine abgeschlossene Runde lässt sich löschen.');
  ctx.rounds.delete(number);
  // The accepted intervals of #232 are kept until the admin deletes the round.
  ctx.playtime.deleteRound(number);
  if (event) event.detail = { round: number };
  return `Runde ${number} aus dem Archiv gelöscht.`;
};

export const serverFeature = {
  adminActions: { closeRound, deleteRound },
} satisfies ServerFeature;
