import type { RoundRules } from '../../core/achievements.ts';
import { type RoundError, roundChoice, roundError } from '../../core/round.ts';
import { type Ctx, fail } from './context.ts';

export function roundRules(ctx: Ctx): RoundRules {
  const rows = ctx.admin.roundSettings();
  const settings = new Map(rows.map(({ key, value }) => [key, value]));
  return {
    number: settings.get('round') ?? 1,
    achievements: settings.get('roundAchievements') !== 0,
    daily: settings.get('roundDaily') !== 0,
    // Existing universes start with guilds on, as before (#191).
    guilds: settings.get('roundGuilds') !== 0,
  };
}

/**
 * When the current round started (#220): set by every new round; the
 * migration of #220 gave a running round the creation time of its first
 * planet, or the time of the migration without one. Without the setting
 * the round starts now.
 */
export const roundStart = (ctx: Ctx): number =>
  ctx.admin.setting('roundStart') ?? ctx.now();

/** The refusal of every guild action while guilds are off (#191, owner). */
export const GUILDS_OFF = 'Gilden sind in dieser Runde abgeschaltet.';

/**
 * Whether guilds, with their chat (#169), are on in this round (#191). The
 * one switch: the guild actions, the guild data of the state and the chat
 * all follow it.
 */
export const guildsOn = (ctx: Ctx): boolean => roundRules(ctx).guilds;

/** Refuses with GUILDS_OFF while guilds are off (#191). */
export function requireGuilds(ctx: Ctx): void {
  if (!guildsOn(ctx)) fail(GUILDS_OFF);
}

/** The refusals of `roundError` (#214). */
const ROUND_ERROR: Readonly<Record<RoundError, string>> = {
  rewards: 'Bitte beide Belohnungseinstellungen für die neue Runde auswählen.',
  guilds: 'Bitte auswählen, ob Gilden in der neuen Runde an sind.',
};

export function startRoundRules(
  ctx: Ctx,
  options: unknown,
  guilds?: unknown,
): RoundRules {
  const current = roundRules(ctx);
  const error = roundError(current, options, guilds);
  if (error) fail(ROUND_ERROR[error]);
  const next = {
    number: current.number + 1,
    ...roundChoice(current, options, guilds),
  };
  ctx.admin.putSettings([
    ['round', next.number],
    ['roundAchievements', Number(next.achievements)],
    ['roundDaily', Number(next.daily)],
    ['roundGuilds', Number(next.guilds)],
    ['roundStart', ctx.now()],
  ]);
  return next;
}
