import type { RoundRules } from '../../core/achievements.ts';
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

function rewardRules(
  current: RoundRules,
  options: unknown,
): Pick<RoundRules, 'achievements' | 'daily'> {
  const selected =
    options === undefined ? current : (options as Partial<RoundRules> | null);
  if (
    typeof selected?.achievements !== 'boolean' ||
    typeof selected.daily !== 'boolean'
  )
    return fail(
      'Bitte beide Belohnungseinstellungen für die neue Runde auswählen.',
    );
  return { achievements: selected.achievements, daily: selected.daily };
}

/** The guild switch of the new round (#191); without a choice the current one. */
function guildRule(current: RoundRules, guilds: unknown): boolean {
  const selected = guilds === undefined ? current.guilds : guilds;
  if (typeof selected !== 'boolean')
    return fail('Bitte auswählen, ob Gilden in der neuen Runde an sind.');
  return selected;
}

export function startRoundRules(
  ctx: Ctx,
  options: unknown,
  guilds?: unknown,
): RoundRules {
  const current = roundRules(ctx);
  const next = {
    number: current.number + 1,
    ...rewardRules(current, options),
    guilds: guildRule(current, guilds),
  };
  ctx.admin.putSettings([
    ['round', next.number],
    ['roundAchievements', Number(next.achievements)],
    ['roundDaily', Number(next.daily)],
    ['roundGuilds', Number(next.guilds)],
  ]);
  return next;
}
