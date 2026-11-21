// The check for control by an AI or a program, per player (#181; owner,
// 2026-11-14: D1, the admin switches it on for one player; 2026-11-21: D2 to
// D5, only hints for the admin, from the server, not retroactive, 30 days,
// on until the admin turns it off, no message to the player). The switch is
// a row of `bot_checks`; the hints are worked out when the admin opens the
// player record (src/core/bot-hints.ts) and are never stored. Nothing of it
// reaches the player: not the state, not an answer.
import type { AuditEntry } from '../audit.ts';
import { botHints, type BotDay, hintsFrom } from '../../core/bot-hints.ts';
import { type Ctx, fail, str } from './context.ts';

/** The check of a player as the admin's player record shows it. */
export interface BotCheck {
  /** Since when the check is on, or null (off). */
  since: number | null;
  /** The days with actions since then, newest first; empty while off. */
  days: BotDay[];
}

/** The check of `uid` with its hints, for the admin's player record. */
export function botCheckOf(ctx: Ctx, uid: string): BotCheck {
  const since = ctx.admin.botCheckSince(uid);
  if (since === null) return { since, days: [] };
  const now = ctx.now();
  const from = hintsFrom(since, now);
  return {
    since,
    days: botHints(
      ctx.admin.gameActions(uid, from),
      ctx.playtime.active(uid, from, now),
      since,
      now,
    ),
  };
}

/**
 * „Automatisierung prüfen“ on or off for the player of `body.player`; the
 * audit entry names who and when, `detail` says on or off. Switching on
 * again starts a new period (Q39).
 */
export function switchBotCheck(
  ctx: Ctx,
  body: Record<string, unknown>,
  entry: AuditEntry,
): BotCheck {
  const target =
    ctx.players.get(str(body.player, 40)) ?? fail('Spieler nicht gefunden.');
  if (typeof body.on !== 'boolean') fail('Bitte an oder aus wählen.');
  entry.target = target.id;
  entry.detail = { on: body.on };
  ctx.admin.setBotCheck(target.id, body.on ? ctx.now() : null);
  return botCheckOf(ctx, target.id);
}
