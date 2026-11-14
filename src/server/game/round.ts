import type { RoundRules } from '../../core/achievements.ts';
import { type Ctx, fail } from './context.ts';

export function roundRules(ctx: Ctx): RoundRules {
  const rows = ctx.admin.roundSettings();
  const settings = new Map(rows.map(({ key, value }) => [key, value]));
  return {
    number: settings.get('round') ?? 1,
    achievements: settings.get('roundAchievements') !== 0,
    daily: settings.get('roundDaily') !== 0,
  };
}

export function startRoundRules(ctx: Ctx, options: unknown): RoundRules {
  const current = roundRules(ctx);
  const selected =
    options === undefined ? current : (options as Partial<RoundRules> | null);
  if (
    typeof selected?.achievements !== 'boolean' ||
    typeof selected.daily !== 'boolean'
  )
    return fail(
      'Bitte beide Belohnungseinstellungen für die neue Runde auswählen.',
    );
  const next = {
    number: current.number + 1,
    achievements: selected.achievements,
    daily: selected.daily,
  };
  ctx.admin.putSettings([
    ['round', next.number],
    ['roundAchievements', Number(next.achievements)],
    ['roundDaily', Number(next.daily)],
  ]);
  return next;
}
